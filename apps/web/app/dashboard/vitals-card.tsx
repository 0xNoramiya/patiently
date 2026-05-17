'use client';

import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { VitalSignsIn, VitalSignsOut } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FieldDef {
  key: keyof VitalSignsIn;
  label: string;
  unit: string;
  step?: string;
  min?: number;
  max?: number;
  cols?: number;
}

const FIELDS: FieldDef[] = [
  { key: 'systolic_bp', label: 'SBP', unit: 'mmHg', min: 40, max: 300, cols: 1 },
  { key: 'diastolic_bp', label: 'DBP', unit: 'mmHg', min: 20, max: 200, cols: 1 },
  { key: 'heart_rate', label: 'HR', unit: 'bpm', min: 20, max: 300, cols: 1 },
  { key: 'respiratory_rate', label: 'RR', unit: '/min', min: 4, max: 60, cols: 1 },
  { key: 'temperature_c', label: 'Temp', unit: '°C', min: 30, max: 43, step: '0.1' },
  { key: 'spo2', label: 'SpO₂', unit: '%', min: 40, max: 100 },
  { key: 'pain_score', label: 'Pain', unit: '/10', min: 0, max: 10 },
];

export function VitalsCard({
  ticketId,
  adminPassword,
}: {
  ticketId: string;
  adminPassword: string;
}) {
  const [vitals, setVitals] = useState<VitalSignsOut | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const v = await api.getVitals(ticketId, adminPassword);
      setVitals(v);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  }, [ticketId, adminPassword]);

  useEffect(() => {
    setEditing(false);
    setDraft({});
    refresh().catch(() => {});
  }, [ticketId, refresh]);

  function startEdit() {
    const base: Record<string, string> = {};
    if (vitals) {
      for (const f of FIELDS) {
        const v = vitals[f.key as keyof VitalSignsOut];
        if (v !== null && v !== undefined) base[f.key as string] = String(v);
      }
    }
    setDraft(base);
    setEditing(true);
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const payload: VitalSignsIn = {};
      for (const f of FIELDS) {
        const raw = draft[f.key as string];
        if (raw === undefined || raw === '') {
          (payload as any)[f.key] = null;
          continue;
        }
        const n = f.step ? parseFloat(raw) : parseInt(raw, 10);
        if (Number.isNaN(n)) continue;
        (payload as any)[f.key] = n;
      }
      const v = await api.recordVitals(ticketId, payload, adminPassword);
      setVitals(v);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const hasFindings = (vitals?.critical_findings || []).length > 0;

  return (
    <div className="card-padded">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display font-semibold text-ink-900 text-sm uppercase tracking-wide">
            Vital signs
          </h3>
          <div className="text-[11px] text-ink-400 mt-0.5">
            Triage-nurse measurements · auto-flagged for critical thresholds
          </div>
        </div>
        {!editing ? (
          <button onClick={startEdit} className="btn-secondary text-xs py-1.5 px-3">
            {vitals ? 'Update' : 'Record'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="btn-ghost text-xs py-1.5 px-3"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="btn-primary text-xs py-1.5 px-3"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-alert-700 bg-alert-50 border border-alert-100 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {!editing && !vitals && (
        <div className="text-xs text-ink-400 italic">
          No vitals recorded. Click <span className="font-semibold">Record</span> to
          enter BP, HR, RR, Temp, SpO₂, and pain score.
        </div>
      )}

      {hasFindings && !editing && (
        <div className="mb-3 rounded-xl border border-alert-100 bg-alert-50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wider text-alert-700 font-bold mb-1">
            Critical findings
          </div>
          <ul className="text-xs text-alert-700 space-y-0.5">
            {vitals!.critical_labels.map((label) => (
              <li key={label}>• {label}</li>
            ))}
          </ul>
        </div>
      )}

      {!editing && vitals && (
        <div className="grid grid-cols-4 gap-2">
          <Reading
            label="BP"
            value={
              vitals.systolic_bp && vitals.diastolic_bp
                ? `${vitals.systolic_bp}/${vitals.diastolic_bp}`
                : null
            }
            unit="mmHg"
            critical={
              vitals.critical_findings.includes('HYPERTENSIVE_CRISIS') ||
              vitals.critical_findings.includes('HYPOTENSION')
            }
          />
          <Reading
            label="HR"
            value={vitals.heart_rate}
            unit="bpm"
            critical={
              vitals.critical_findings.includes('SEVERE_TACHYCARDIA') ||
              vitals.critical_findings.includes('BRADYCARDIA')
            }
          />
          <Reading
            label="RR"
            value={vitals.respiratory_rate}
            unit="/min"
            critical={vitals.critical_findings.includes('TACHYPNEA')}
          />
          <Reading
            label="Temp"
            value={vitals.temperature_c?.toFixed(1)}
            unit="°C"
            critical={
              vitals.critical_findings.includes('HIGH_FEVER') ||
              vitals.critical_findings.includes('HYPOTHERMIA')
            }
          />
          <Reading
            label="SpO₂"
            value={vitals.spo2}
            unit="%"
            critical={vitals.critical_findings.includes('HYPOXIA')}
          />
          <Reading
            label="Pain"
            value={vitals.pain_score}
            unit="/10"
            critical={vitals.critical_findings.includes('SEVERE_PAIN')}
          />
        </div>
      )}

      {editing && (
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key as string} className="block">
              <span className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">
                {f.label}{' '}
                <span className="text-ink-400 font-normal normal-case">
                  ({f.unit})
                </span>
              </span>
              <input
                type="number"
                step={f.step || '1'}
                min={f.min}
                max={f.max}
                value={draft[f.key as string] ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, [f.key as string]: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-ink-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Reading({
  label,
  value,
  unit,
  critical,
}: {
  label: string;
  value: number | string | null | undefined;
  unit: string;
  critical?: boolean;
}) {
  const display = value === null || value === undefined ? '—' : String(value);
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 bg-white',
        critical ? 'border-alert-200 bg-alert-50/40' : 'border-ink-100'
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </div>
      <div
        className={cn(
          'font-display text-lg font-bold mt-0.5',
          critical ? 'text-alert-700' : 'text-ink-900'
        )}
      >
        {display}
      </div>
      <div className="text-[10px] text-ink-400">{unit}</div>
    </div>
  );
}
