# AntriCare — Pre-visit Intake & Queue Agent for Puskesmas

> Submission for AI Agent Olympics Hackathon · Milan AI Week 2026
> Tracks: Vultr (deployment) · Gemini (agent)

AntriCare turns the puskesmas waiting room into productive time. Patients scan
the QR code on their paper queue ticket and:

1. See their live queue position and ETA.
2. Chat with an LLM-driven assistant **in Bahasa Indonesia** that gathers OPQRST,
   checks for red flags, and — for **follow-up visits** — pulls last week's EMR
   notes and prescriptions to ask targeted delta questions ("minggu lalu dikasih
   ambroxol, batuknya sekarang gimana?").
3. Get bumped to the front of the queue automatically if a red flag is detected.

By the time the physician calls them, the chart is already half-written.

## Why this matters

A typical puskesmas doctor in Indonesia sees ~40 patients in a half-day. That's
8 minutes per patient. AntriCare moves the cold-start interview into the waiting
room and surfaces follow-up context that today gets lost between paper records
and the patient's memory.

## Stack

- **Frontend** — Next.js 14 (App Router), TypeScript, Tailwind, shadcn-style primitives
- **Backend** — FastAPI 0.115, SQLAlchemy 2.0 async, Alembic, Pydantic v2
- **DB** — PostgreSQL 16
- **Clinical LLM (multi-agent)** — Gemini 2.5 Flash Lite with `response_schema`. Three independent agents:
  - **Intake Agent** — conversational pre-visit interview (OPQRST, follow-up delta)
  - **Triage Agent** — separate per-turn classifier that watches every patient message for red flags (defense in depth)
  - **Summarizer Agent** — writes the physician-facing chart once intake completes
- **Reminder LLM** — Featherless (OpenAI-compatible) generates short, personalized SMS reminders. Runs on an APScheduler cron (60s tick) — also exposed as a manual "Generate" button on the dashboard.
- **Speech-to-text** — Speechmatics batch ASR with speaker diarization. Mock consultation audio is synthesized with EdgeTTS so the demo doesn't require a real microphone.
- **Realtime** — Server-Sent Events
- **Deploy** — Single Vultr VM, Docker Compose, Caddy auto-TLS

## Architecture

```
┌─────────────┐    QR scan        ┌──────────────────┐
│  Patient    │ ────────────▶     │  Next.js Web     │
│  phone      │ ◀─ SSE live ─     │  /p/[ticket]     │
└─────────────┘                   │  /p/[ticket]/    │
                                  │   intake (chat)  │
                                  └────────┬─────────┘
                                           │
                                  REST + SSE
                                           │
┌──────────────┐                  ┌────────▼─────────┐
│  Physician   │ ◀──── SSE  ────▶ │  FastAPI         │
│  /dashboard  │                  │  - queue engine  │      ┌──────────────┐
└──────────────┘                  │  - intake agent  │ ───▶ │  Gemini 2.5  │
                                  │  - summarizer    │      │  Flash       │
                                  └────────┬─────────┘      └──────────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │  PostgreSQL 16   │
                                  │  patients/visits │
                                  │  /tickets/intake │
                                  └──────────────────┘
```

## Integrations

| Provider     | Used for                                       | Env var                 |
| ------------ | ---------------------------------------------- | ----------------------- |
| Gemini       | Intake, Triage, Summarizer agents              | `GEMINI_API_KEY`        |
| Featherless  | Appointment-reminder generator (scheduled job) | `FEATHERLESS_API_KEY`   |
| Speechmatics | Doctor–patient consultation transcription      | `SPEECHMATICS_API_KEY`  |
| EdgeTTS      | Mock consultation audio (no key needed)        | —                       |

Reminder lifecycle: a row in `appointment_reminders` with `status=pending` and a
`scheduled_for` in the past is picked up on the next scheduler tick, sent to
Featherless with patient + previous-visit context, and marked `sent`. The
dashboard's "Reminders" panel shows pending and sent reminders with the
generated message body.

Transcription lifecycle: clicking ▶ Play & transcribe in the dashboard ticket
detail synthesizes a scenario-appropriate dialogue with EdgeTTS (cardiac if the
Triage Agent fired CHEST_PAIN_CARDIAC, follow-up if the ticket is is_followup,
otherwise generic), saves the MP3 to `static/audio/{ticket_id}.mp3`, sends it
to Speechmatics batch ASR, polls until done, and renders the speaker-diarized
transcript next to an `<audio>` player.

## Project layout

```
apps/
  api/                 FastAPI service
    app/
      core/            config, db
      models/          SQLAlchemy ORM
      schemas/         Pydantic schemas
      services/        queue engine, ETA, triage, event bus
      agents/          intake + summarizer (Gemini)
        prompts/       Bahasa Indonesia system prompts
      api/v1/          REST routes + SSE
    alembic/           migrations
    seed/              demo data
  web/                 Next.js 14 App Router
    app/
      page.tsx                          landing
      p/[ticket]/page.tsx               patient queue view
      p/[ticket]/intake/page.tsx        chat UI
      dashboard/page.tsx                physician dashboard
      receptionist/page.tsx             ticket issuance console
infra/
  docker-compose.yml
  Caddyfile
  .env.example
```

## Local development

Requires Docker.

```bash
cp infra/.env.example infra/.env
# Edit infra/.env: paste your Gemini API key into GEMINI_API_KEY

cd infra
docker compose up --build
```

Once containers are healthy:

```bash
# seed demo data (8 patients, 3 follow-up scenarios, 8 active tickets)
docker compose exec api python -m seed.demo_scenarios
```

Then visit:

- `http://localhost:3000` — landing
- `http://localhost:3000/receptionist` — issue tickets (token: `demo-receptionist-token`)
- `http://localhost:3000/dashboard` — physician dashboard (password: `puskesmas2026`)
- `http://localhost:8000/docs` — FastAPI auto-docs

## Demo flow (5 minutes)

1. Open `/receptionist`, issue a ticket for **Sari Wulandari** to Poli Umum.
   The badge shows "Kontrol" because she visited 7 days ago for cough.
2. Click "Buka halaman pasien". Show the patient view with follow-up badge.
3. Tap "Mulai persiapan kunjungan". The agent greets her by name and
   references the ambroxol prescription. Walk through a short conversation
   (took all, cough mostly resolved, mild throat itch remains).
4. Open `/dashboard` in another window. Watch the ticket move from "Sedang intake"
   to "Siap dilihat" in real time. Open the pre-visit summary and follow-up
   delta cards — the system reports good response and suggests symptomatic care.
5. **The hero moment**: issue a ticket for **Budi Hartanto** (52) to Poli Umum.
   Start intake, describe substernal chest pressure radiating to left arm
   with diaphoresis. The `CHEST_PAIN_CARDIAC` flag fires, priority jumps to 100,
   the dashboard pops a red triase toast and Budi's row jumps to the top
   with a red border. Show the dashboard banner.

## Queue ordering & ETA

Tickets are sorted by `(-priority, issued_at)`. Default priority is 0.
Red flags map to:

| Flag                    | Priority |
| ----------------------- | -------- |
| CHEST_PAIN_CARDIAC      | 100      |
| STROKE_SYMPTOMS         | 100      |
| RESPIRATORY_DISTRESS    | 100      |
| ANAPHYLAXIS_SUSPECT     | 100      |
| PEDS_RED_FLAG           | 100      |
| SEVERE_DEHYDRATION      | 100      |
| OBSTETRIC_BLEEDING      | 50       |
| SUICIDAL_IDEATION       | 50       |

ETA is the rolling average of the last 20 completed consultations for that poli
today (called_at → completed_at). With fewer than 5 samples we fall back to
priors: Umum 8 min, Anak 12, KIA 15, Gigi 20, Lansia 10. ETA shown to patients
is `position × avg_min` with ±20% jitter for a friendly range.

## Red-flag detection

The intake agent operates with `response_mime_type="application/json"` and a
typed `response_schema` (see `apps/api/app/agents/schemas.py`). The Indonesian
system prompt enumerates each red-flag code with patient-facing cues. Flags
returned in any turn are accumulated on the session, persisted to JSONB, and
trigger an asynchronous priority bump + SSE `triage_alert` event.

The agent NEVER reveals it has classified anything as urgent — it stays calm
and tells the patient "Terima kasih sudah memberitahu. Saya akan beritahu
petugas supaya bisa segera dilihat dokter ya."

## Deploying to Vultr

1. Provision a Vultr Cloud Compute instance (4 GB RAM is plenty for a demo).
2. Install Docker + Compose (`curl https://get.docker.com | sh`).
3. Point a DNS A record at the instance, then in `infra/.env` set
   `DOMAIN=your.host`. Caddy will fetch a Let's Encrypt cert on boot.
4. `git clone`, `cd infra && docker compose up -d --build`.
5. `docker compose exec api python -m seed.demo_scenarios`.

## Demo credentials

- Receptionist token: `demo-receptionist-token` (X-Receptionist-Token header)
- Physician dashboard password: `puskesmas2026`
- Default Gemini model: `gemini-2.5-flash`

Override any of these via `infra/.env`.

## Disclaimer

AntriCare is a prototype for educational and demo purposes. It does not provide
medical advice or diagnosis. All clinical decisions remain with the attending
physician. The differentials and "suggested questions" in the dashboard are
clearly labelled as system suggestions, not diagnoses.
