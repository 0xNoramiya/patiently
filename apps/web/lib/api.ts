import type {
  AgentResponse,
  IntakeSession,
  Poli,
  QueueState,
  TicketDetail,
} from './types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';

async function http<T>(
  path: string,
  init: RequestInit = {},
  baseOverride?: string
): Promise<T> {
  const base = baseOverride ?? API_BASE;
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export const api = {
  getQueue: (poli: Poli) => http<QueueState>(`/api/queue/${poli}`),
  getTicket: (id: string) => http<TicketDetail>(`/api/tickets/${id}`),
  cancelTicket: (id: string) =>
    http<TicketDetail>(`/api/tickets/${id}/cancel`, { method: 'POST' }),
  startIntake: (id: string) =>
    http<IntakeSession>(`/api/intake/${id}/start`, { method: 'POST' }),
  getSession: (id: string) => http<IntakeSession>(`/api/intake/${id}/session`),
  sendMessage: (id: string, content: string) =>
    http<AgentResponse>(`/api/intake/${id}/message`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  completeIntake: (id: string) =>
    http<IntakeSession>(`/api/intake/${id}/complete`, { method: 'POST' }),
  callNext: (id: string, password: string) =>
    http<TicketDetail>(`/api/admin/tickets/${id}/call`, {
      method: 'POST',
      headers: { 'X-Admin-Password': password },
    }),
  completeTicket: (id: string, password: string) =>
    http<TicketDetail>(`/api/admin/tickets/${id}/complete`, {
      method: 'POST',
      headers: { 'X-Admin-Password': password },
    }),
  verifyAdmin: (password: string) =>
    http<{ ok: boolean }>(`/api/admin/dashboard/auth`, {
      headers: { 'X-Admin-Password': password },
    }),

  listReminders: (password: string) =>
    http<import('./types').AppointmentReminder[]>(`/api/admin/reminders`, {
      headers: { 'X-Admin-Password': password },
    }),
  fireReminder: (reminderId: string, password: string) =>
    http<import('./types').AppointmentReminder>(
      `/api/admin/reminders/${reminderId}/fire`,
      { method: 'POST', headers: { 'X-Admin-Password': password } }
    ),
  runDueReminders: (password: string) =>
    http<{ fired: number }>(`/api/admin/reminders/run-due`, {
      method: 'POST',
      headers: { 'X-Admin-Password': password },
    }),

  generateTranscript: (ticketId: string, password: string) =>
    http<import('./types').ConsultationTranscriptOut>(
      `/api/admin/tickets/${ticketId}/transcript`,
      { method: 'POST', headers: { 'X-Admin-Password': password } }
    ),
  getTranscript: (ticketId: string, password: string) =>
    http<import('./types').ConsultationTranscriptOut | null>(
      `/api/admin/tickets/${ticketId}/transcript`,
      { headers: { 'X-Admin-Password': password } }
    ),
};

export function streamUrl(path: string): string {
  return `${API_BASE}${path}`;
}
