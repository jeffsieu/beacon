import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import type { PlacementQuestion as PQ, PlacementProposed } from '../types'
import PlacementQuestion from './PlacementQuestion'
import { Button } from '@/components/ui/button'
import { useSession } from '../hooks/useSession.tsx'
import { useCoursesQuery } from '../hooks/queries'
import { encodeCourseId, decodeCourseId } from '../api'

interface PendingAnswer {
  questionId: string
  type: PQ['type']
  answer: string | string[]
}

type Phase = 'waiting' | 'questioning' | 'submitting' | 'done' | 'error' | 'no-session'

export default function PlacementPage() {
  const { course: encodedCourse } = useParams<{ course: string }>()
  const course = decodeCourseId(encodedCourse!)
  const navigate = useNavigate()
  const { session, sendMessage, subscribe } = useSession()
  const { data: courses } = useCoursesQuery()

  const [phase, setPhase] = useState<Phase>('waiting')
  const [questions, setQuestions] = useState<PQ[]>([])
  const [answers, setAnswers] = useState<PendingAnswer[]>([])
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const courseTitle = useMemo(() => {
    if (course && courses) {
      const found = courses.find(c => c.course === course)
      if (found?.title) return found.title
    }
    return course || ''
  }, [course, courses])

  useEffect(() => {
    if (!session?.sessionId || !course) {
      if (!session) setPhase('no-session')
      return
    }
    sendMessage({ type: 'placement:request', courseId: course })
      .catch((e: unknown) => { setError(String(e)); setPhase('error') })
  }, [session?.sessionId, course, sendMessage])

  // Subscribe to placement events via session SSE
  useEffect(() => {
    const unsubQ = subscribe('placement:question', (data) => {
      const msg = data as { question: PQ }
      setQuestions(prev => {
        if (prev.find(x => x.id === msg.question.id)) return prev
        return [...prev, msg.question]
      })
      setPhase('questioning')
    })

    const unsubDone = subscribe('placement:done', (data) => {
      const msg = data as { proposed: PlacementProposed }
      navigate(`/${encodeCourseId(course)}/placement/results`, {
        state: { proposed: msg.proposed, sessionId: session?.sessionId },
      })
    })

    const unsubReset = subscribe('placement:reset', () => {
      setQuestions([])
      setAnswers([])
      setAnsweredIds(new Set())
      setPhase('waiting')
    })

    return () => { unsubQ(); unsubDone(); unsubReset() }
  }, [subscribe, navigate, course, session?.sessionId])

  function handleAnswer(questionId: string, type: PQ['type'], answer: string | string[]) {
    setAnsweredIds(prev => new Set([...prev, questionId]))
    setAnswers(prev => {
      const next = prev.filter(a => a.questionId !== questionId)
      return [...next, { questionId, type, answer }]
    })
  }

  function handleContinue() {
    if (!answers.length) return
    setPhase('submitting')
    sendMessage({
      type: 'placement:submit',
      answers: answers.map(a => ({ questionId: a.questionId, type: a.type, answer: a.answer })),
    })
      .then(() => { setAnswers([]); setPhase('waiting') })
      .catch((e: unknown) => { setError(String(e)); setPhase('error') })
  }

  const unanswered = questions.filter(q => !answeredIds.has(q.id))
  const allAnswered = questions.length > 0 && unanswered.length === 0

  if (phase === 'no-session') return (
    <div className="max-w-xl mx-auto px-8 py-12">
      <div className="rounded-xl px-5 py-4 border-l-4" style={{ background: 'var(--c-muted-sub)', borderLeftColor: 'var(--c-muted)' }}>
        <p className="font-semibold text-sm mb-1" style={{ color: 'var(--c-text)', fontFamily: 'var(--font-family-ui)' }}>No active session</p>
        <p className="text-xs" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-mono)' }}>
          Run <code>/learn</code> in your terminal and open the URL it gives you.
        </p>
      </div>
    </div>
  )

  if (phase === 'error') return (
    <div className="max-w-xl mx-auto px-8 py-12">
      <div className="rounded-xl px-5 py-4 border-l-4" style={{ background: 'var(--c-red-sub)', borderLeftColor: 'var(--c-red)' }}>
        <p className="font-semibold text-sm mb-1" style={{ color: 'var(--c-red)', fontFamily: 'var(--font-family-ui)' }}>Error</p>
        <p className="text-xs" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-mono)' }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-8 py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-family-ui)' }}>
          {courseTitle}
        </p>
        <h1 style={{ fontFamily: 'var(--font-family-display)', fontWeight: 600, fontSize: '1.75rem', color: 'var(--c-text)' }}>
          Placement Test
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>
          Answer each question, then hit Continue to submit the batch.
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="flex items-center gap-3 py-8" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>
          <span className="spinner" />
          <span className="text-sm">Preparing questions…</span>
        </div>
      ) : (
        <div className="grid gap-4 mb-6">
          {questions.map(q => (
            <PlacementQuestion
              key={q.id}
              question={q}
              onAnswer={handleAnswer}
              disabled={answeredIds.has(q.id) || phase === 'submitting'}
            />
          ))}
        </div>
      )}

      {questions.length > 0 && (
        <div className="flex items-center gap-4">
          <Button
            onClick={handleContinue}
            disabled={!allAnswered || phase === 'submitting' || phase === 'waiting'}
            size="sm"
          >
            {phase === 'submitting' ? (
              <><span className="spinner" /> Submitting…</>
            ) : phase === 'waiting' ? (
              <><span className="spinner" /> Waiting…</>
            ) : (
              'Continue →'
            )}
          </Button>
          {unanswered.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--c-muted)', fontFamily: 'var(--font-family-ui)' }}>
              {unanswered.length} question{unanswered.length > 1 ? 's' : ''} remaining
            </span>
          )}
        </div>
      )}
    </div>
  )
}
