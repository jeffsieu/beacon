import { useQuery } from '@tanstack/react-query'
import * as api from '../api'

// ── Courses ──

export function useCoursesQuery() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: api.fetchCourses,
    staleTime: 30_000,
  })
}

// ── Course progress ──

export function useCourseProgressQuery(course: string) {
  return useQuery({
    queryKey: ['courseProgress', course],
    queryFn: () => api.fetchCourseProgress(course),
    enabled: !!course,
    staleTime: 10_000,
  })
}

// ── Lessons list ──

export function useLessonsQuery() {
  return useQuery({
    queryKey: ['lessons'],
    queryFn: api.fetchLessons,
    staleTime: 30_000,
  })
}

// ── Single lesson ──

export function useLessonQuery(course: string, slug: string) {
  return useQuery({
    queryKey: ['lesson', course, slug],
    queryFn: () => api.fetchLesson(course, slug),
    enabled: !!course && !!slug,
    staleTime: 60_000,
  })
}

// ── Course suggestions ──

export function useCourseSuggestionsQuery(course: string) {
  return useQuery({
    queryKey: ['courseSuggestions', course],
    queryFn: () => api.fetchCourseSuggestions(course),
    enabled: !!course,
    staleTime: Infinity,
  })
}

// ── Dashboard suggestions ──

export function useDashboardSuggestionsQuery() {
  return useQuery({
    queryKey: ['dashboardSuggestions'],
    queryFn: () => api.fetchDashboardSuggestions(),
    staleTime: Infinity,
  })
}

// ── Server health ──

export function useServerStatusQuery() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.fetchHealth,
    refetchInterval: 5_000,
    staleTime: 4_000,
    retry: 1,
  })
}
