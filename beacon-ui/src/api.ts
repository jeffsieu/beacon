import type { CourseSummary, CourseProgress, LessonMeta, Lesson, LearnSuggestionItem } from './types'

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

// Encode a course ID for use in API URLs (replaces "/" with "~")
function encCourse(id: string): string {
  return id.replace(/\//g, '~')
}

// ── GET queries ──

export function fetchCourses(): Promise<CourseSummary[]> {
  return fetchJson<CourseSummary[]>(`${API}/courses`)
}

export function fetchCourseProgress(course: string): Promise<CourseProgress> {
  return fetchJson<CourseProgress>(`${API}/courses/${encCourse(course)}/progress`)
}

export function fetchLessons(): Promise<LessonMeta[]> {
  return fetchJson<LessonMeta[]>(`${API}/lessons`)
}

export function fetchLesson(course: string, slug: string): Promise<Lesson> {
  return fetchJson<Lesson>(`${API}/lessons/${encCourse(course)}/${encodeURIComponent(slug)}`)
}

export function fetchLessonProgress(course: string, slug: string): Promise<{ questions: Record<string, any>; status: string }> {
  return fetchJson<{ questions: Record<string, any>; status: string }>(`${API}/lessons/${encCourse(course)}/${encodeURIComponent(slug)}/progress`)
}

export async function updateLessonProgress(course: string, slug: string, progress: { answers?: Record<string, string>; status?: string }): Promise<void> {
  await fetch(`${API}/lessons/${encCourse(course)}/${encodeURIComponent(slug)}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress),
  })
}

export function fetchCourseSuggestions(course: string): Promise<{ suggestions: LearnSuggestionItem[]; chips: LearnSuggestionItem[]; rationale: string }> {
  return fetchJson<{ suggestions: LearnSuggestionItem[]; chips: LearnSuggestionItem[]; rationale: string }>(`${API}/courses/${encCourse(course)}/suggestions`)
}

export function fetchDashboardSuggestions(): Promise<{ suggestions: LearnSuggestionItem[]; chips: LearnSuggestionItem[]; rationale: string }> {
  return fetchJson<{ suggestions: LearnSuggestionItem[]; chips: LearnSuggestionItem[]; rationale: string }>(`${API}/dashboard/suggestions`)
}

export function fetchHealth(): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>(`${API}/health`)
}

// ── Session mutations (imperative, not cached) ──

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

export function fetchLatestSession(): Promise<{ sessionId: string }> {
  return fetchJson(`${API}/sessions/latest`)
}

export interface SessionSummary {
  id: string
  course: string | null
  title: string | null
  createdAt: string | null
  messageCount: number
  lastMessage: { role: string; content?: string; timestamp?: string } | null
}

export function fetchSessions(): Promise<{ sessions: SessionSummary[] }> {
  return fetchJson(`${API}/sessions`)
}
