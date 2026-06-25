import { useEffect, useCallback, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useEventListener } from 'usehooks-ts'
import { useSession } from '../hooks/useSession.tsx'
import { useLessonQuery, useLessonProgressQuery } from '../hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import { pushSessionState, encodeCourseId, decodeCourseId } from '../api'
import KnowledgeCheck from './KnowledgeCheck.tsx'
import MarkdownRenderer from './MarkdownRenderer.tsx'
import type { KnowledgeQuestion } from '../types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function LessonPage() {
  const { course: encodedCourse, slug } = useParams<{ course: string; slug: string }>()
  const course = decodeCourseId(encodedCourse!)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setLessonTitle, session, setSelectedText, replies, mcAnswers, sendMessage, subscribe } = useSession()
  const { data: lesson, isLoading, error } = useLessonQuery(course!, slug!)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const { data: savedProgress = null } = useLessonProgressQuery(course!, slug!);
  const sectionsReadRef = useRef<Set<string>>(new Set())
  const bodyRef = useRef<HTMLDivElement>(null)

  const questions: KnowledgeQuestion[] = lesson?.knowledgeCheck ?? []

  // Merge session-based answers with saved progress to compute answered state
  const answeredCount = questions.filter((q: KnowledgeQuestion) => {
    if (q.type === 'free-text') return !!replies[q.id] || (savedProgress?.questions?.[q.id]?.grade != null)
    return !!mcAnswers[q.id]
  }).length
  const allAnswered = questions.length === 0 ? false : answeredCount === questions.length

  function doFinish() {
    setFinishing(true)
    setShowFinishModal(false)
    // Listen for agent confirmation
    const unsub = subscribe('lesson:committed', () => {
      unsub()
      queryClient.invalidateQueries({ queryKey: ['courseProgress', course] })
      navigate(`/${encodeCourseId(course)}`)
    })
    // Timeout fallback — redirect even if agent doesn't respond
    const timeout = setTimeout(() => {
      unsub()
      navigate(`/${encodeCourseId(course)}`)
    }, 12000)
    // Tell the agent to finalize KNOWLEDGE.md
    sendMessage({ type: 'lesson:finish', courseId: course, lessonId: slug }).catch(() => {
      clearTimeout(timeout)
      unsub()
      navigate(`/${encodeCourseId(course)}`)
    })
  }

  function handleFinish() {
    if (allAnswered) {
      doFinish()
    } else {
      setShowFinishModal(true)
    }
  }

  function confirmFinish() {
    doFinish()
  }

  // Sync lesson title when data loads
  useEffect(() => {
    if (lesson) setLessonTitle(lesson.title || slug || '')
  }, [lesson, slug, setLessonTitle])

  const pushState = useCallback((currentSection: string) => {
    if (!session?.sessionId || !course || !slug) return
    pushSessionState(session.sessionId, { lessonId: slug, course, currentSection, sectionsRead: [...sectionsReadRef.current] })
  }, [session, slug, course])

  // Watch H2 headings in the rendered markdown for section tracking
  useEffect(() => {
    if (!lesson || !bodyRef.current) return
    const headings = bodyRef.current.querySelectorAll<HTMLElement>('h2')
    if (!headings.length) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const text = entry.target.textContent ?? ''
        if (entry.isIntersecting && text) {
          sectionsReadRef.current.add(text)
          if (entry.intersectionRatio > 0.3) pushState(text)
        }
      }
    }, { threshold: [0.1, 0.3, 0.6] })
    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [lesson, pushState])

  useEventListener('mouseup', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-sidebar]')) return
    setSelectedText(window.getSelection()?.toString().trim() ?? '')
  })

  if (error) return (
    <div className="max-w-[680px] mx-auto px-6 py-10">
      <div className="rounded-md px-4 py-3 text-sm" style={{ background: 'var(--c-red-sub)', border: '1px solid var(--c-red-border)', color: 'var(--c-red)' }}>
        Failed to load lesson: {String(error)}
      </div>
    </div>
  )

  if (isLoading || !lesson) return (
    <div className="max-w-[680px] mx-auto px-6 py-10">
      <div className="text-center py-16 text-sm" style={{ color: 'var(--c-muted)' }}>Loading…</div>
    </div>
  )

  return (
    <article className="max-w-[680px] mx-auto px-6 pb-24 pt-10">
      <div className="mb-3">
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-family-ui)', color: 'var(--c-accent)' }}>
          {course}
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-family-display)',
            fontWeight: 600,
            fontSize: '2.5rem',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            color: 'var(--c-text)',
            marginBottom: '2.5rem',
          }}
        >
          {lesson.title}
        </h1>
      </div>

      <div ref={bodyRef}>
        <MarkdownRenderer
          content={lesson.body}
          className="prose dark:prose-invert max-w-none teaching-body"
        />
      </div>

      {lesson.knowledgeCheck && lesson.knowledgeCheck.length > 0 && (
        <KnowledgeCheck questions={lesson.knowledgeCheck} lessonId={slug ?? ''} courseId={course ?? ''} savedProgress={savedProgress} />
      )}

      {lesson.sources && lesson.sources.length > 0 && (
        <div className="mt-12 pt-6 border-t" style={{ borderColor: 'var(--c-border)' }}>
          <div className="text-[0.72rem] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--c-muted)' }}>Sources</div>
          <ul className="list-none">
            {lesson.sources.map((s, i) => (
              <li key={i} className="mb-1.5">
                <a href={s.url} target="_blank" rel="noreferrer" className="text-sm no-underline hover:underline" style={{ color: 'var(--c-accent)' }}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Finish lesson */}
      <div className="mt-16 pt-8 border-t" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>
              {questions.length > 0
                ? `${answeredCount} of ${questions.length} questions answered`
                : 'No questions in this lesson'}
            </p>
          </div>
          <Button
            variant={allAnswered ? 'default' : 'outline'}
            size="sm"
            onClick={handleFinish}
            disabled={finishing}
          >
            {finishing ? 'Finishing…' : 'Finish lesson'}
          </Button>
        </div>
      </div>

      <Dialog open={showFinishModal} onOpenChange={setShowFinishModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish lesson early?</DialogTitle>
            <DialogDescription>
              You&rsquo;ve answered {answeredCount} of {questions.length} questions.
              You can always come back later to finish the rest.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowFinishModal(false)}>
              Keep going
            </Button>
            <Button variant="default" size="sm" onClick={confirmFinish}>
              Finish anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
