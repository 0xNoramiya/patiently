import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
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
            <div className="text-xs text-ink-500">Demo clinic queue system</div>
          </div>
        </div>
        <Link href="/dashboard" className="btn-secondary text-sm">
          Clinician sign-in
        </Link>
      </header>

      <section className="flex-1 grid place-items-center px-6 md:px-12 py-10">
        <div className="max-w-3xl text-center">
          <span className="pill-brand mb-6 inline-flex">Demo · AI Agent Olympics 2026</span>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight text-ink-900">
            Patient queues that
            <br />
            <span className="text-brand-700">do something while you wait.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-500 max-w-2xl mx-auto">
            Scan the QR code on your queue ticket to see your live position, your wait time,
            and chat with the Patiently intake assistant. By the time the doctor calls you,
            the chart is already half-written.
          </p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="card-padded">
              <div className="pill-brand">1</div>
              <h3 className="font-display font-semibold text-ink-900 mt-3">Wait, smartly</h3>
              <p className="text-sm text-ink-500 mt-2">
                Watch your queue position update live. No more standing in the corridor.
              </p>
            </div>
            <div className="card-padded">
              <div className="pill-brand">2</div>
              <h3 className="font-display font-semibold text-ink-900 mt-3">A three-agent intake</h3>
              <p className="text-sm text-ink-500 mt-2">
                Our Intake, Triage, and Summarizer agents work in parallel — gathering history,
                catching red flags, writing the chart.
              </p>
            </div>
            <div className="card-padded">
              <div className="pill-brand">3</div>
              <h3 className="font-display font-semibold text-ink-900 mt-3">Doctor reads the room</h3>
              <p className="text-sm text-ink-500 mt-2">
                When you're called in, your physician already has your HPI, follow-up delta,
                and differentials in front of them.
              </p>
            </div>
          </div>
          <p className="mt-12 text-sm text-ink-400">
            For the demo, receptionists can issue tickets at the{' '}
            <Link href="/receptionist" className="underline hover:text-brand-700">
              reception console
            </Link>
            .
          </p>
        </div>
      </section>

      <footer className="px-6 md:px-12 py-6 text-xs text-ink-400 text-center">
        Patiently · Prototype · Not a substitute for medical advice. All clinical decisions remain with the attending physician.
      </footer>
    </main>
  );
}
