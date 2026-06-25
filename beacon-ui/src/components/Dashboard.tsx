import { useEffect, useRef, useState } from 'react'
import { useCourses } from '../hooks/useCourses'
import { useLessonsQuery, useDashboardSuggestionsQuery } from '../hooks/queries'
import { useSession } from '../hooks/useSession'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import CourseCard from './CourseCard'
import ContinueLearning from './ContinueLearning'
import LessonList from './LessonList'
import { sendSessionMessage } from '../api'

export default function Dashboard() {
  const { courses } = useCourses()
  const { data: lessons } = useLessonsQuery()
  const { ensureSession, subscribe } = useSession()
  const queryClient = useQueryClient()
  const hasAutoRequested = useRef(false)
  const [waiting, setWaiting] = useState(false)
  const { data: suggestionsData, isFetching } = useDashboardSuggestionsQuery()
  const suggestions = suggestionsData?.suggestions?.length ? suggestionsData.suggestions : null
  const chips = suggestionsData?.chips?.length ? suggestionsData.chips : null
  const rationale = suggestionsData?.rationale || null

  const learnMutation = useMutation({
    mutationFn: async (content: string) => {
      setWaiting(true)
      const sid = await ensureSession()
      if (!sid) throw new Error('no session')
      await sendSessionMessage(sid, { type: 'lesson:suggestion', content, source: 'dashboard' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardSuggestions'] })
    },
  })

  useEffect(() => {
    return subscribe('lesson:suggestion:success', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardSuggestions'] })
      setWaiting(false)
    })
  }, [subscribe, queryClient])

  // Auto-request on page load
  useEffect(() => {
    if (hasAutoRequested.current || isFetching) return
    hasAutoRequested.current = true
    if (!suggestionsData?.suggestions?.length) learnMutation.mutate('')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="mb-10" style={{ fontFamily: 'var(--font-family-display)', fontWeight: 600, fontSize: '2.25rem', letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--c-text)' }}>
        Welcome back!
      </h1>

      <ContinueLearning
        suggestions={suggestions}
        chips={chips}
        rationale={rationale}
        loading={waiting || learnMutation.isPending || isFetching}
        recentLesson={null}
        onSend={(content) => learnMutation.mutate(content)}
      />

      <div className="mt-10">
        <h2 className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>
          Your Courses
        </h2>
        {!courses ? (
          <div className="text-sm" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>Loading…</div>
        ) : courses.length === 0 ? (
          <div className="rounded-xl p-8 text-center border" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
            <p className="text-sm" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>No courses yet. Run <code style={{ fontFamily: 'var(--font-family-mono)' }}>/learn</code> to start.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {courses.map(t => <CourseCard key={t.course} summary={t} />)}
          </div>
        )}
      </div>

      {lessons && lessons.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>
            Recent Lessons
          </h2>
          <LessonList lessons={lessons.slice(0, 5)} showCourse />
        </div>
      )}
    </div>
  )
}
