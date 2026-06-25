import { useState, useEffect } from 'react'
import { useSession } from '../hooks/useSession.tsx'
import type { KnowledgeQuestion } from '../types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'

interface Props {
  question: KnowledgeQuestion
  lessonId: string
  courseId: string
  savedProgress: { questions: Record<string, { grade?: string; feedback?: string; pointer?: { status: string; feedback: string }; questionText?: string; clarification?: string }>; status: string } | null
}

export default function Question({ question, lessonId, courseId, savedProgress }: Props) {
  const { session, sendMessage, replies, mcAnswers, submittedAnswers, clarifications } = useSession()
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Auto-reopen when clarification arrives (via SSE)
  useEffect(() => {
    if (clarifications[question.id]) {
      setSubmitted(false)
      setFreeText('')
    }
  }, [clarifications, question.id])

  // Restore persisted clarification from saved progress
  const persistedClarification = savedProgress?.questions?.[question.id]?.clarification || clarifications[question.id] || null

  const reply = replies[question.id] || (savedProgress?.questions?.[question.id]?.pointer?.status ? {
    type: 'grade' as const,
    questionId: question.id,
    result: savedProgress.questions[question.id].pointer!.status as 'LEARNED' | 'LEARNED_PARTIAL' | 'NOT_LEARNED',
    feedback: savedProgress.questions[question.id].pointer!.feedback || '',
  } : null)
  const mcAnswer = mcAnswers[question.id]
  const sessionActive = session?.status === 'active'

  // Restore mc/tf state from persisted answers on mount
  useEffect(() => {
    if (mcAnswer && (question.type === 'mc' || question.type === 'tf')) {
      setSelected(mcAnswer.answer)
      setChecked(true)
    }
  }, [mcAnswer, question.type])

  // Restore free-text answer if already graded
  useEffect(() => {
    const savedAnswer = submittedAnswers[question.id]
    if (savedAnswer && question.type === 'free-text') {
      setFreeText(savedAnswer)
      setSubmitted(true)
    } else if (savedProgress?.questions?.[question.id]?.grade && question.type === 'free-text') {
      setFreeText(savedProgress.questions[question.id].questionText || '(saved answer)')
      setSubmitted(true)
    }
  }, [submittedAnswers, savedProgress, question.id, question.type])

  if (question.type === 'mc' || question.type === 'tf') {
    const options = question.type === 'tf' ? ['True', 'False'] : (question.options ?? [])

    async function handleMcCheck() {
      if (!selected || checked || !sessionActive) return
      setChecked(true)
      const isCorrect = selected === question.correct
      await sendMessage({
        type: 'lesson:answer-mc',
        questionId: question.id,
        questionTitle: question.title,
        answer: selected,
        answerType: question.type,
        correct: isCorrect,
        lessonId,
        courseId,
      })
    }

    return (
      <Card id={question.id} className="mb-8 px-5 [--card-spacing:--spacing(5)]">
        <p className="mb-4 leading-relaxed" style={{ fontFamily: 'var(--font-family-display)', fontSize: '1.05rem', fontWeight: 500, color: 'var(--c-text)' }}>
          {question.title}
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {options.map(opt => {
            let cls = 'question-option'
            if (opt === selected) cls += ' selected'
            if (checked) {
              cls += ' disabled'
              if (opt === question.correct) cls += ' correct'
              else if (opt === selected) cls += ' incorrect'
            }
            return (
              <label className={cls} key={opt}>
                <input
                  type="radio"
                  name={question.id}
                  value={opt}
                  checked={selected === opt}
                  onChange={() => !checked && setSelected(opt)}
                  disabled={checked}
                  style={{ accentColor: 'var(--c-accent)' }}
                />
                {opt}
                {checked && opt === question.correct && ' ✓'}
                {checked && opt === selected && opt !== question.correct && ' ✗'}
              </label>
            )
          })}
        </div>
        {!checked && (
          <Button variant="outline" size="sm" onClick={handleMcCheck} disabled={!selected}>Check</Button>
        )}
        {reply && (() => {
          const variant = ({ LEARNED: { bg: 'var(--c-green-sub)', border: 'var(--c-green-border)', text: 'var(--c-green)', label: 'LEARNED' },
                           LEARNED_PARTIAL: { bg: 'var(--c-amber-sub)', border: 'var(--c-amber-border)', text: 'var(--c-amber-text)', label: 'PARTIALLY LEARNED' },
                           NOT_LEARNED: { bg: 'var(--c-red-sub)', border: 'var(--c-red-border)', text: 'var(--c-red)', label: 'NOT LEARNED' } } as const)[reply.result]
          return variant ? (
            <div className="mt-3 px-4 py-3 rounded-md text-sm" style={{ background: variant.bg, border: `1px solid ${variant.border}`, color: variant.text }}>
              <div className="font-semibold text-[0.78rem] uppercase tracking-wider mb-1">{variant.label}</div>
              {reply.feedback}
            </div>
          ) : null
        })()}
      </Card>
    )
  }

  async function handleSubmit() {
    if (!freeText.trim() || submitted || !sessionActive) return
    setSubmitted(true)
    await sendMessage({ type: 'lesson:answer', questionId: question.id, questionTitle: question.title, answer: freeText.trim(), lessonId, courseId })
  }

  const feedbackVariant = reply
    ? ({ LEARNED: { bg: 'var(--c-green-sub)', border: 'var(--c-green-border)', text: 'var(--c-green)', label: 'LEARNED' },
         LEARNED_PARTIAL: { bg: 'var(--c-amber-sub)', border: 'var(--c-amber-border)', text: 'var(--c-amber-text)', label: 'PARTIALLY LEARNED' },
         NOT_LEARNED: { bg: 'var(--c-red-sub)', border: 'var(--c-red-border)', text: 'var(--c-red)', label: 'NOT LEARNED' } } as const)[reply.result]
    : null

  return (
    <Card id={question.id} className="mb-8 px-5 [--card-spacing:--spacing(5)]">
      <p className="mb-4 leading-relaxed" style={{ fontFamily: 'var(--font-family-display)', fontSize: '1.05rem', fontWeight: 500, color: 'var(--c-text)' }}>
        {question.title}
      </p>
      <Textarea
        className="mb-2 text-[0.95rem] leading-relaxed resize-y bg-[var(--c-bg)] font-[var(--font-family-ui)]"
        value={freeText}
        onChange={e => setFreeText(e.target.value)}
        disabled={submitted}
        placeholder="Write your answer…"
        rows={4}
      />
      {!submitted && (
        <Button
          variant="default"
          size="sm"
          onClick={handleSubmit}
          disabled={!freeText.trim() || !sessionActive}
          title={!sessionActive ? 'Start a session to submit' : undefined}
        >
          Submit
        </Button>
      )}
      {submitted && !reply && !persistedClarification && (
        <div className="mt-1.5 flex items-center gap-2 px-4 py-3 rounded-md text-sm border" style={{ background: 'var(--c-surface-2)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}>
          <span className="spinner" /> Grading…
        </div>
      )}
      {persistedClarification && (
        <div className="mt-1.5 px-4 py-3 rounded-md text-sm" style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
          <div className="font-semibold text-[0.78rem] uppercase tracking-wider mb-1" style={{ color: 'var(--c-accent)' }}>Clarification</div>
          {persistedClarification}
        </div>
      )}
      {reply && feedbackVariant && (
        <div className="mt-1.5 px-4 py-3 rounded-md text-sm" style={{ background: feedbackVariant.bg, border: `1px solid ${feedbackVariant.border}`, color: feedbackVariant.text }}>
          <div className="font-semibold text-[0.78rem] uppercase tracking-wider mb-1">{feedbackVariant.label}</div>
          {reply.feedback}
        </div>
      )}
      {(persistedClarification || (reply && reply.result !== 'LEARNED')) && (
        <div className="mt-2">
          <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setFreeText(''); }} disabled={!sessionActive}>
            Try again
          </Button>
        </div>
      )}
    </Card>
  )
}
