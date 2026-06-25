import { useCoursesQuery } from './queries'

// Thin re-export for backward compatibility
export function useCourses() {
  const { data: courses, error } = useCoursesQuery()
  return {
    courses: courses ?? null,
    error: error ? String(error) : null,
  }
}
