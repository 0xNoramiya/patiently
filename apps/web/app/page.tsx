import Link from 'next/link';

interface DemoTicket {
  id: string;
  ticket_number: string;
  patient_name: string;
  is_followup: boolean;
  poli: string;
}

async function pickDemoTickets(): Promise<{
  followup: DemoTicket | null;
  fresh: DemoTicket | null;
}> {
  const base = process.env.INTERNAL_API_URL || 'http://api:8000';
  const fallback = { followup: null, fresh: null };

  try {
    const polis = ['umum', 'anak', 'kia', 'gigi', 'lansia'] as const;
    const all: DemoTicket[] = [];
    for (const p of polis) {
      const res = await fetch(`${base}/api/queue/${p}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const q = (await res.json()) as {
        waiting: {
          ticket: { id: string; ticket_number: string; is_followup: boolean };
          patient: { name: string };
        }[];
      };
      for (const e of q.waiting) {
        all.push({
          id: e.ticket.id,
          ticket_number: e.ticket.ticket_number,
          patient_name: e.patient.name,
          is_followup: e.ticket.is_followup,
          poli: p,
        });
      }
    }
    return {
      followup: all.find((t) => t.is_followup) || null,
      fresh: all.find((t) => !t.is_followup) || null,
    };
  } catch {
    return fallback;
  }
}

const POLI_LABEL: Record<string, string> = {
  umum: 'General Clinic',
  anak: 'Pediatrics',
  kia: 'OB-GYN',
  gigi: 'Dental',
  lansia: 'Geriatrics',
};

export default async function Home() {
  const { followup, fresh } = await pickDemoTickets();
  const primaryPatient = followup || fresh;
  const altPatient = followup && fresh ? fresh : null;

  return (
    <main className="min-h-screen flex flex-col relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-ink-50 pointer-events-none" />
      <header className="px-6 md:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-600 grid place-items-center shadow-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21s-7-4.3-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.7-7 10-7 10h-4z"
                stroke="white"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M9 11h6M12 8v6" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="font-display font-bold text-lg text-ink-900">Patiently</div>
            <div className="text-xs text-ink-500">AI Agent Olympics · Milan 2026</div>
          </div>
        </div>
        <a
          href="https://github.com/0xNoramiya/patiently"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs"
        >
          GitHub ↗
        </a>
      </header>

      <section className="flex-1 grid place-items-center px-6 md:px-12 py-10">
        <div className="max-w-3xl text-center w-full">
          <span className="pill-brand mb-6 inline-flex">Live demo</span>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight text-ink-900">
            Pick a seat in the
            <br />
            <span className="text-brand-700">clinic floor.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-500 max-w-2xl mx-auto">
            Two views into the same queue. The clinician sees the multi-agent
            chart-prep dashboard. The patient holds a phone in the waiting
            room and chats with Patiently. Try either side — no sign-in.
          </p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <Link
              href="/dashboard"
              className="group relative card overflow-hidden p-6 hover:shadow-card transition-shadow"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand-50/0 to-brand-50/60 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-brand-700 font-bold">
                    Clinician
                  </span>
                  <span className="text-xs text-ink-400 group-hover:text-brand-700 transition-colors">
                    →
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-ink-900">
                  Demo as a Clinician
                </h2>
                <p className="text-sm text-ink-500 mt-2 leading-snug">
                  Live queue across 5 departments. Triage flags surface in
                  real time. SOAP notes and prescriptions drafted by Featherless.
                  Consultation transcripts via Speechmatics.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {[
                    'KPI strip',
                    '3-agent pipeline',
                    'Drug interactions',
                    'PDF export',
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-1 rounded-full bg-ink-100 text-ink-700 font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>

            {primaryPatient ? (
              <Link
                href={`/p/${primaryPatient.id}`}
                className="group relative card overflow-hidden p-6 hover:shadow-card transition-shadow"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand-50/0 to-brand-50/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-wider text-brand-700 font-bold">
                      Patient · {primaryPatient.ticket_number}
                    </span>
                    <span className="text-xs text-ink-400 group-hover:text-brand-700 transition-colors">
                      →
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-bold text-ink-900">
                    Demo as {primaryPatient.patient_name.split(' ')[0]}
                  </h2>
                  <p className="text-sm text-ink-500 mt-2 leading-snug">
                    {primaryPatient.is_followup
                      ? `${POLI_LABEL[primaryPatient.poli]} follow-up. The Intake Agent greets by name and references last week's prescription.`
                      : `${POLI_LABEL[primaryPatient.poli]} · new complaint. Walk through OPQRST, watch the triage classifier monitor every turn.`}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {[
                      'Live queue',
                      'Voice + photo',
                      'EN ↔ ID',
                      'Installable',
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-1 rounded-full bg-ink-100 text-ink-700 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="card overflow-hidden p-6 opacity-60">
                <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold mb-3">
                  Patient
                </div>
                <h2 className="font-display text-xl font-bold text-ink-900">
                  No queue ticket available
                </h2>
                <p className="text-sm text-ink-500 mt-2">
                  Issue one from the{' '}
                  <Link href="/receptionist" className="underline">
                    reception console
                  </Link>{' '}
                  to start.
                </p>
              </div>
            )}
          </div>

          {altPatient && (
            <div className="mt-3 text-xs text-ink-500">
              Or jump straight to a {altPatient.is_followup ? 'follow-up' : 'new-complaint'} ticket:{' '}
              <Link
                href={`/p/${altPatient.id}`}
                className="font-semibold text-brand-700 hover:underline"
              >
                {altPatient.ticket_number} · {altPatient.patient_name}
              </Link>
            </div>
          )}

          <p className="mt-10 text-xs text-ink-400">
            For the demo only · no auth gates · the reception console is at{' '}
            <Link href="/receptionist" className="underline hover:text-brand-700">
              /receptionist
            </Link>
            .
          </p>
        </div>
      </section>

      <footer className="px-6 md:px-12 py-6 text-xs text-ink-400 text-center">
        Patiently · prototype · multi-agent pre-visit intake & queue ·
        Gemini · Featherless · Speechmatics
      </footer>
    </main>
  );
}
