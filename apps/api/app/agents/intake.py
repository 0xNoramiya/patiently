"""Intake Agent + multi-agent coordinator.

For each patient turn we run two LLM calls in parallel:
  - Intake Agent  → conversational reply + extracted fields
  - Triage Agent  → red-flag classifier

The orchestrator merges the results, persists state, and on triage hits
bumps the ticket priority. Latency = max(intake, triage) instead of sum.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.context import (
    previous_visit_for,
    render_patient_block,
    render_previous_visit_block,
)
from app.agents.gemini_client import generate_json
from app.agents.schemas import INTAKE_RESPONSE_SCHEMA
from app.agents.triage_agent import classify_turn
from app.models.intake import IntakeMessage, IntakeSession, IntakeStatus, MessageRole
from app.models.queue_ticket import QueueTicket
from app.services import queue as queue_service

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "intake_system.txt")
with open(_PROMPT_PATH, "r", encoding="utf-8") as f:
    INTAKE_SYSTEM_PROMPT = f.read()


@dataclass
class AgentTurn:
    reply_text: str
    extracted_fields: dict[str, Any]
    triage_flags: list[str]
    triage_reasoning: str
    is_complete: bool


def _merge_structured(
    current: dict[str, Any], new: dict[str, Any]
) -> dict[str, Any]:
    """Accumulate fields across turns. Lists union, scalars latest-wins-if-non-null."""
    out = dict(current or {})
    for k, v in (new or {}).items():
        if v is None or v == "":
            continue
        if isinstance(v, list):
            existing = out.get(k) or []
            seen = set()
            merged = []
            for item in existing + v:
                if item not in seen:
                    seen.add(item)
                    merged.append(item)
            out[k] = merged
        else:
            out[k] = v
    return out


async def _build_emr_context(db: AsyncSession, ticket: QueueTicket) -> str:
    patient_block = render_patient_block(ticket.patient)
    is_followup = ticket.is_followup
    prev = await previous_visit_for(db, ticket) if is_followup else None
    parts = [
        "=== PATIENT CONTEXT ===",
        patient_block,
        f"Clinic department today: {ticket.poli.value}",
        f"is_followup: {str(is_followup).lower()}",
    ]
    if is_followup and prev:
        parts.append("=== PREVIOUS VISIT (within 30 days) ===")
        parts.append(render_previous_visit_block(prev))
    else:
        parts.append("=== PREVIOUS VISIT ===")
        parts.append("No related visits within the last 30 days.")
    return "\n".join(parts)


def _to_gemini_history(messages: list[IntakeMessage]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for m in messages:
        if m.role == MessageRole.system:
            continue
        if m.role == MessageRole.patient:
            out.append({"role": "user", "parts": [{"text": m.content}]})
        elif m.role == MessageRole.agent:
            out.append(
                {
                    "role": "model",
                    "parts": [{"text": json.dumps({"reply_text": m.content, "is_complete": False})}],
                }
            )
    return out


def _render_plain_history(messages: list[IntakeMessage]) -> str:
    lines = []
    for m in messages:
        if m.role == MessageRole.system:
            continue
        speaker = "Agent" if m.role == MessageRole.agent else "Patient"
        lines.append(f"{speaker}: {m.content}")
    return "\n".join(lines)


async def start_session(
    db: AsyncSession, ticket: QueueTicket
) -> tuple[IntakeSession, IntakeMessage]:
    """Create the session and emit the agent's greeting."""
    existing = await db.execute(
        select(IntakeSession).where(IntakeSession.ticket_id == ticket.id)
    )
    session = existing.scalar_one_or_none()
    if session is None:
        session = IntakeSession(
            ticket_id=ticket.id,
            status=IntakeStatus.active,
            structured_data={},
            triage_flags=[],
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

    emr_context = await _build_emr_context(db, ticket)
    db.add(
        IntakeMessage(
            session_id=session.id,
            role=MessageRole.system,
            content=emr_context,
        )
    )

    contents = [
        {
            "role": "user",
            "parts": [
                {
                    "text": (
                        f"{emr_context}\n\n"
                        "=== TASK ===\n"
                        "Open the intake conversation. Greet the patient warmly using "
                        "their name. If is_followup=true, acknowledge the previous visit "
                        "and ask about their symptoms now. Otherwise, ask what brings "
                        "them in today."
                    )
                }
            ],
        }
    ]
    result = await generate_json(
        system_instruction=INTAKE_SYSTEM_PROMPT,
        contents=contents,
        response_schema=INTAKE_RESPONSE_SCHEMA,
        temperature=0.5,
    )
    reply = (result.get("reply_text") or "Hello — I'm Patiently. What brings you in today?").strip()
    msg = IntakeMessage(
        session_id=session.id,
        role=MessageRole.agent,
        content=reply,
        extracted_fields=result.get("extracted_fields") or {},
    )
    db.add(msg)
    await queue_service.mark_intake_started(db, ticket)
    await db.commit()
    await db.refresh(session)
    await db.refresh(msg)
    return session, msg


async def respond(
    db: AsyncSession,
    session_id: uuid.UUID,
    patient_text: str,
) -> AgentTurn:
    """Process a single patient turn. Runs Intake + Triage agents in parallel."""
    stmt = (
        select(IntakeSession)
        .where(IntakeSession.id == session_id)
        .options(
            selectinload(IntakeSession.messages),
            selectinload(IntakeSession.ticket).selectinload(QueueTicket.patient),
        )
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None:
        raise ValueError("session not found")

    ticket = session.ticket
    emr_context = await _build_emr_context(db, ticket)
    already_raised = list(session.triage_flags or [])

    patient_msg = IntakeMessage(
        session_id=session.id,
        role=MessageRole.patient,
        content=patient_text,
    )
    db.add(patient_msg)
    await db.flush()

    history_msgs = sorted(
        list(session.messages) + [patient_msg], key=lambda m: m.created_at or m.id.bytes
    )
    gemini_history = _to_gemini_history(history_msgs)
    plain_history = _render_plain_history(history_msgs[:-1])  # without current turn

    intake_contents = [
        {
            "role": "user",
            "parts": [{"text": emr_context + "\n\n=== CONVERSATION ==="}],
        },
        *gemini_history,
    ]

    # === RUN AGENTS IN PARALLEL ===
    intake_task = generate_json(
        system_instruction=INTAKE_SYSTEM_PROMPT,
        contents=intake_contents,
        response_schema=INTAKE_RESPONSE_SCHEMA,
        temperature=0.5,
    )
    triage_task = classify_turn(
        emr_context=emr_context,
        prior_conversation=plain_history,
        patient_message=patient_text,
        already_raised=already_raised,
    )
    intake_result, triage_verdict = await asyncio.gather(intake_task, triage_task)

    reply_text = (intake_result.get("reply_text") or "").strip() or "Sorry, could you say that again?"
    extracted = intake_result.get("extracted_fields") or {}
    is_complete = bool(intake_result.get("is_complete"))
    flags_this_turn = list(triage_verdict.flags)

    # Update session aggregates
    session.structured_data = _merge_structured(session.structured_data, extracted)
    merged_flags = list(session.triage_flags or [])
    for f in flags_this_turn:
        if f not in merged_flags:
            merged_flags.append(f)
    session.triage_flags = merged_flags

    db.add(
        IntakeMessage(
            session_id=session.id,
            role=MessageRole.agent,
            content=reply_text,
            extracted_fields={
                **extracted,
                "_triage_reasoning": triage_verdict.reasoning,
                "_triage_flags_this_turn": flags_this_turn,
            },
        )
    )

    if is_complete and session.status == IntakeStatus.active:
        from datetime import datetime, timezone

        session.status = IntakeStatus.completed
        session.completed_at = datetime.now(timezone.utc)
        await queue_service.mark_intake_complete(db, ticket)

    await db.commit()

    if flags_this_turn:
        await queue_service.bump_priority(db, ticket.id, merged_flags)

    return AgentTurn(
        reply_text=reply_text,
        extracted_fields=extracted,
        triage_flags=flags_this_turn,
        triage_reasoning=triage_verdict.reasoning,
        is_complete=is_complete,
    )
