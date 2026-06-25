import { useQuery } from '@tanstack/react-query'
import { API } from '../api'
import type { SessionSummary } from '../types'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`server error ${res.status}`)
  return res.json() as Promise<T>
}

// ── Courses ──

export function useCoursesQuery() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: () => fetchJson<import('../types').CourseSummary[]>(`${API}/courses`),
    staleTime: 30_000,
  })
}

// ── Course progress ──

export function useCourseProgressQuery(course: string) {
  return useQuery({
    queryKey: ['courseProgress', course],
    queryFn: () => fetchJson<import('../types').CourseProgress>(`${API}/courses/${course.replace(/\//g, '~')}/progress`),
    enabled: !!course,
    staleTime: 10_000,
  })
}

// ── Lessons list ──

export function useLessonsQuery() {
  return useQuery({
    queryKey: ['lessons'],
    queryFn: () => fetchJson<import('../types').LessonMeta[]>(`${API}/lessons`),
    staleTime: 30_000,
  })
}

// ── Single lesson ──

export function useLessonQuery(course: string, slug: string) {
  return useQuery({
    queryKey: ['lesson', course, slug],
    queryFn: () => fetchJson<import('../types').Lesson>(`${API}/lessons/${course.replace(/\//g, '~')}/${encodeURIComponent(slug)}`),
    enabled: !!course && !!slug,
    staleTime: 60_000,
  })
}

// ── Lesson progress ──

export function useLessonProgressQuery(course: string, slug: string) {
  return useQuery({
    queryKey: ['lessonProgress', course, slug],
    queryFn: () => fetchJson<{ questions: Record<string, any>; status: string }>(`${API}/lessons/${course.replace(/\//g, '~')}/${encodeURIComponent(slug)}/progress`),
    enabled: !!course && !!slug,
    staleTime: 10_000,
  })
}

// ── Course suggestions ──

export function useCourseSuggestionsQuery(course: string) {
  return useQuery({
    queryKey: ['courseSuggestions', course],
    queryFn: () => fetchJson<{ suggestions: import('../types').LearnSuggestionItem[]; chips: import('../types').LearnSuggestionItem[]; rationale: string }>(`${API}/courses/${course.replace(/\//g, '~')}/suggestions`),
    enabled: !!course,
    staleTime: Infinity,
  })
}

// ── Dashboard suggestions ──

export function useDashboardSuggestionsQuery() {
  return useQuery({
    queryKey: ['dashboardSuggestions'],
    queryFn: () => fetchJson<{ suggestions: import('../types').LearnSuggestionItem[]; chips: import('../types').LearnSuggestionItem[]; rationale: string }>(`${API}/dashboard/suggestions`),
    staleTime: Infinity,
  })
}

// ── Server health ──

export function useServerStatusQuery() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => fetchJson<{ ok: boolean }>(`${API}/health`),
    refetchInterval: 5_000,
    staleTime: 4_000,
    retry: 1,
  })
}

// ── Sessions ──

export function useSessionsQuery() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => fetchJson<{ sessions: SessionSummary[] }>(`${API}/sessions`).then(d => d.sessions),
    staleTime: 10_000,
  })
}
