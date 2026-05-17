'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';
import {
  RED_FLAG_LABELS,
  TICKET_STATUS_LABEL,
  type QueueState,
  type TicketDetail,
} from '@/lib/types';
import { cn, formatEta } from '@/lib/utils';

function flagLabel(code: string): string {
  return RED_FLAG_LABELS[code] || code;
}

export function TicketView({
  initial,
  poliLabel,
}: {
  initial: TicketDetail;
  poliLabel: string;
}) {
  const [ticket, setTicket] = useState<TicketDetail>(initial);
  const [queue, setQueue] = useState<QueueState | null>(null);

  useEffect(() => {
    let mounted = true;
    api.getQueue(ticket.poli).then((q) => mounted && setQueue(q));
    const es = new EventSource(`/api/queue/${ticket.poli}/stream`);
    es.onmessage = () => {
      api.getTicket(ticket.id).then((t) => mounted && setTicket(t)).catch(() => {});
      api.getQueue(ticket.poli).then((q) => mounted && setQueue(q)).catch(() => {});
    };
    es.onerror = () => es.close();
    return () => {
      mounted = false;
      es.close();
    };
  }, [ticket.poli, ticket.id]);

  const meEntry = useMemo(() => {
    if (!queue) return null;
    const all = [
      ...queue.waiting,
      ...queue.in_intake,
      ...queue.intake_complete,
      ...queue.in_consultation,
    ];
    return all.find((e) => e.ticket.id === ticket.id) || null;
  }, [queue, ticket.id]);

  const nowServing = queue?.now_serving?.ticket_number ?? '—';
  const ahead = meEntry ? Math.max(meEntry.position - 1, 0) : 0;
  const eta = meEntry ? formatEta(meEntry.eta_minutes_low, meEntry.eta_minutes_high) : '—';
  const isUrgent = ticket.priority >= 100 || ticket.triage_flags.length > 0;

  return (
    <main className="min-h-screen pb-24">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Logo />
        <span className="pill-ink text-[11px] uppercase tracking-wide">{poliLabel}</span>
      </header>

      <section className="px-5">
        {ticket.is_followup && (
          <div className="card-padded mb-4 bg-brand-50 border-brand-200">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-600 text-white grid place-items-center text-sm font-bold">
                ↩
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-brand-700 font-semibold">
                  Follow-up visit
                </div>
                <div className="text-sm text-ink-700 mt-1">
                  {ticket.previous_visit ? (
                    <>
                      Last visit on{' '}
                      <span className="font-semibold">
                        {new Date(ticket.previous_visit.visit_date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>{' '}
                      for: <span className="italic">{ticket.previous_visit.chief_complaint}</span>
                    </>
                  ) : (
                    <>This is a follow-up visit.</>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isUrgent && (
          <div className="card-padded mb-4 bg-alert-50 border-alert-100">
            <div className="text-xs uppercase tracking-wide text-alert-700 font-semibold">
              Priority escalated
            </div>
            <div className="text-sm text-ink-700 mt-1">
              The clinical team has been notified. You'll be seen shortly.
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-brand-700 to-brand-600 text-white">
            <div className="text-sm opacity-80">Your queue number</div>
            <div className="font-display text-7xl font-bold tracking-tight mt-1">
              {ticket.ticket_number}
            </div>
            <div className="mt-3 text-sm opacity-90">
              {ticket.patient.name} · {ticket.patient.age} y/o
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-ink-100 text-center">
            <div className="p-4">
              <div className="text-[11px] uppercase tracking-wide text-ink-400">Now serving</div>
              <div className="font-display text-2xl font-bold text-ink-900 mt-1">{nowServing}</div>
            </div>
            <div className="p-4">
              <div className="text-[11px] uppercase tracking-wide text-ink-400">Ahead of you</div>
              <div className="font-display text-2xl font-bold text-ink-900 mt-1">{ahead}</div>
            </div>
            <div className="p-4">
              <div className="text-[11px] uppercase tracking-wide text-ink-400">Est. wait</div>
              <div className="font-display text-2xl font-bold text-ink-900 mt-1">{eta}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span
            className={cn(
              'pill',
              ticket.status === 'in_consultation'
                ? 'bg-brand-100 text-brand-700'
                : ticket.status === 'intake_complete'
                  ? 'bg-warn-100 text-warn-600'
                  : ticket.status === 'in_intake'
                    ? 'bg-warn-100 text-warn-600'
                    : 'bg-ink-100 text-ink-700'
            )}
          >
            {TICKET_STATUS_LABEL[ticket.status]}
          </span>
          {ticket.triage_flags.length > 0 && (
            <span className="pill-alert">⚠ {flagLabel(ticket.triage_flags[0])}</span>
          )}
        </div>

        <div className="mt-6">
          {ticket.status === 'waiting' && !ticket.intake_complete && (
            <Link href={`/p/${ticket.id}/intake`} className="btn-primary w-full text-base">
              Start pre-visit intake
            </Link>
          )}
          {ticket.status === 'in_intake' && (
            <Link href={`/p/${ticket.id}/intake`} className="btn-primary w-full text-base">
              Continue intake
            </Link>
          )}
          {(ticket.status === 'intake_complete' || ticket.intake_complete) && (
            <div className="card-padded bg-brand-50 border-brand-100 text-center">
              <div className="text-3xl">✓</div>
              <div className="font-display font-semibold text-ink-900 mt-2">
                Intake complete
              </div>
              <p className="text-sm text-ink-500 mt-1">
                Your physician is reading your summary now. Please wait to be called.
              </p>
            </div>
          )}
          {ticket.status === 'in_consultation' && (
            <div className="card-padded bg-brand-50 border-brand-100 text-center">
              <div className="font-display font-semibold text-ink-900">Please proceed to the consultation room</div>
              <p className="text-sm text-ink-500 mt-1">Show this screen at the door.</p>
            </div>
          )}
        </div>

        <p className="text-xs text-ink-400 text-center mt-8">
          This page updates automatically. Keep it open.
        </p>
      </section>
    </main>
  );
}
