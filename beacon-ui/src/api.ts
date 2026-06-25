// API base URL — override via ?api=http://... param (default: localhost:4646)
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
export const API = params?.get('api') || 'http://localhost:4646'

// ── Path-safe course ID encoding ──
// Course IDs like "local/ai" contain "/" which breaks React Router paths.
// Encode "/" → "~" for URLs, decode back when reading.

export function encodeCourseId(id: string): string {
  return id.replace(/\//g, '~')
}

export function decodeCourseId(encoded: string): string {
  return encoded.replace(/~/g, '/')
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`server error ${res.status}`)
  return res.json() as Promise<T>
}

// ── Session mutations ──

export async function createSession(courseId?: string | null): Promise<{ sessionId: string; inboxPath: string }> {
  return fetchJson(`${API}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId: courseId || null }),
  })
}

export async function sendSessionMessage(sessionId: string, payload: Record<string, unknown>): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function pushSessionState(sessionId: string, state: Record<string, unknown>): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })
}

export function fetchSessionMessages(sessionId: string): Promise<{ messages: unknown[] }> {
  return fetchJson(`${API}/sessions/${sessionId}/messages`)
}
