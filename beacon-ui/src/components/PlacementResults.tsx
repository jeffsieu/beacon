import { useParams, useLocation, Link } from 'react-router'
import { useState, useMemo } from 'react'
import type { PlacementProposed } from '../types'
import ProgressRing from './ProgressRing'
import { useCourseProgress } from '../hooks/useCourseProgress'
import { useCoursesQuery } from '../hooks/queries'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { encodeCourseId, decodeCourseId, API } from '../api'
import { courseColor } from '../lib/course-color'

interface LocationState {
  proposed: PlacementProposed
  sessionId: string
}

export default function PlacementResults() {
  const { course: encodedCourse } = useParams<{ course: string }>()
  const course = decodeCourseId(encodedCourse!)
  const location = useLocation()
  const state = location.state as LocationState | null
  const { progress } = useCourseProgress(course!)
  const { data: courses } = useCoursesQuery()

  const courseTitle = useMemo(() => {
    if (course && courses) {
      const found = courses.find(c => c.course === course)
      if (found?.title) return found.title
    }
    return course || ''
  }, [course, courses])

  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!state?.proposed) {
    return (
      <div className="max-w-xl mx-auto px-8 py-12">
        <p className="text-sm" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>
          No results to show. <Link to={`/${encodeCourseId(course)}/placement`} className="underline">Start a placement test.</Link>
        </p>
      </div>
    )
  }

  const { proposed, sessionId } = state
  const color = courseColor(course!)

  const total = progress?.stats.total ?? 0
  const beforePct = progress ? Math.round(((progress.stats.learned + progress.stats.partial * 0.5) / Math.max(1, total)) * 100) : 0
  const afterLearned = (progress?.stats.learned ?? 0) + proposed.learned.length
  const afterPartial = (progress?.stats.partial ?? 0) + proposed.learnedPartial.length
  const afterPct = total > 0 ? Math.round(((afterLearned + afterPartial * 0.5) / total) * 100) : 0

  function handleAccept() {
    setAccepting(true)
    fetch(`${API}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'placement:accept' }),
    })
      .then(r => r.ok ? void 0 : Promise.reject(`${r.status}`))
      .then(() => setAccepted(true))
      .catch((e: unknown) => { setError(String(e)); setAccepting(false) })
  }

  return (
    <div className="max-w-xl mx-auto px-8 py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-family-ui)' }}>
          {courseTitle}
        </p>
        <h1 style={{ fontFamily: 'var(--font-family-display)', fontWeight: 600, fontSize: '1.75rem', color: 'var(--c-text)' }}>
          Placement Results
        </h1>
      </div>

      {/* Before / After rings */}
      <Card className="flex items-center justify-center gap-12 mb-10 py-6">
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center mb-2">
            <ProgressRing percent={beforePct} size={80} strokeWidth={6} color="var(--c-border-strong)" />
            <span className="absolute font-semibold text-sm" style={{ fontFamily: 'var(--font-family-ui)', color: 'var(--c-muted)' }}>{beforePct}%</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>Before</p>
        </div>
        <span style={{ color: 'var(--c-muted)', fontSize: '1.5rem' }}>→</span>
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center mb-2">
            <ProgressRing percent={afterPct} size={80} strokeWidth={6} color={color} />
            <span className="absolute font-semibold text-sm" style={{ fontFamily: 'var(--font-family-ui)', color: 'var(--c-text)' }}>{afterPct}%</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>After</p>
        </div>
      </Card>

      {/* Proposed changes */}
      {proposed.learned.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--c-green)', fontFamily: 'var(--font-family-ui)' }}>
            Learned ({proposed.learned.length})
          </h2>
          <ul className="grid gap-1.5">
            {proposed.learned.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ fontFamily: 'var(--font-family-ui)', color: 'var(--c-text)' }}>
                <span style={{ color: 'var(--c-green)', flexShrink: 0 }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposed.learnedPartial.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-family-ui)' }}>
            Partially learned ({proposed.learnedPartial.length})
          </h2>
          <ul className="grid gap-2">
            {proposed.learnedPartial.map((entry, i) => (
              <li key={i}>
                <p className="text-sm" style={{ fontFamily: 'var(--font-family-ui)', color: 'var(--c-text)' }}>
                  <span style={{ color: 'var(--c-accent)' }}>◑</span> {entry.item}
                </p>
                {entry.gaps.length > 0 && (
                  <ul className="ml-4 mt-1 grid gap-1">
                    {entry.gaps.map((gap, j) => (
                      <li key={j} className="text-xs" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>
                        · {gap}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposed.misunderstandings.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--c-red)', fontFamily: 'var(--font-family-ui)' }}>
            Misunderstandings ({proposed.misunderstandings.length})
          </h2>
          <ul className="grid gap-1.5">
            {proposed.misunderstandings.map((m, i) => (
              <li key={i} className="text-sm" style={{ fontFamily: 'var(--font-family-ui)', color: 'var(--c-text)' }}>
                <span style={{ color: 'var(--c-red)' }}>⚠</span> {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Accept / Discard */}
      {!accepted ? (
        <div className="flex items-center gap-3 mt-8">
          <Button onClick={handleAccept} disabled={accepting} size="sm">{accepting ? <><span className="spinner" /> Saving…</> : 'Accept results'}</Button>
          <Link to={`/${encodeCourseId(course)}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Discard</Link>
          {error && <span className="text-xs" style={{ color: 'var(--c-red)', fontFamily: 'var(--font-family-mono)' }}>{error}</span>}
        </div>
      ) : (
        <div className="mt-8 rounded-xl p-4 border" style={{ background: 'var(--c-green-sub)', borderColor: 'var(--c-green-border)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--c-green)', fontFamily: 'var(--font-family-ui)' }}>Progress saved</p>
          <p className="text-xs" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>
            KNOWLEDGE.md has been updated.{' '}
            <Link to={`/${encodeCourseId(course)}`} className="underline" style={{ color: 'var(--c-green)' }}>Back to {courseTitle}</Link>
          </p>
        </div>
      )}
    </div>
  )
}
