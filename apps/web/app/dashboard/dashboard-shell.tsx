'use client';

import { useEffect, useState } from 'react';

import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';
import { DashboardMain } from './dashboard-main';

const STORAGE_KEY = 'patiently:admin';

export function DashboardShell() {
  const [password, setPassword] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (cached) {
      api
        .verifyAdmin(cached)
        .then(() => setPassword(cached))
        .catch(() => sessionStorage.removeItem(STORAGE_KEY));
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.verifyAdmin(draft);
      sessionStorage.setItem(STORAGE_KEY, draft);
      setPassword(draft);
    } catch {
      setError('Wrong password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword(null);
    setDraft('');
  }

  if (!password) {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-ink-50">
        <form
          onSubmit={handleSubmit}
          className="card-padded w-full max-w-sm space-y-4"
        >
          <Logo />
          <div>
            <h1 className="font-display text-xl font-bold text-ink-900">
              Clinician dashboard
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Enter the clinic password to view the live queue.
            </p>
          </div>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Admin password"
            autoFocus
            className="w-full rounded-2xl border border-ink-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none px-4 py-3"
          />
          {error && <div className="text-sm text-alert-700">{error}</div>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Verifying...' : 'Sign in'}
          </button>
        </form>
      </main>
    );
  }

  return <DashboardMain adminPassword={password} onLogout={logout} />;
}
