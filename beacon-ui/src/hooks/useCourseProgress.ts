import { useCourseProgressQuery } from './queries'

export function useCourseProgress(course: string) {
  const { data: progress, error } = useCourseProgressQuery(course)
  return {
    progress: progress ?? null,
    error: error ? String(error) : null,
  }
}
