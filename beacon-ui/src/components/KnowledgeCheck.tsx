import Question from './Question.tsx'
import type { KnowledgeQuestion } from '../types'

interface Props {
  questions: KnowledgeQuestion[]
  lessonId: string
  courseId: string
  savedProgress: { questions: Record<string, { grade?: string; feedback?: string; pointer?: { status: string; feedback: string }; questionText?: string }>; status: string } | null
}

export default function KnowledgeCheck({ questions, lessonId, courseId, savedProgress }: Props) {
  if (!questions.length) return null

  return (
    <div className="mt-14 pt-8 border-t" style={{ borderColor: 'var(--c-border)' }}>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[0.68rem] font-semibold tracking-widest uppercase" style={{ color: 'var(--c-accent-h)', fontFamily: 'var(--font-family-ui)' }}>
          Knowledge Check
        </span>
        <span className="flex-1 h-px" style={{ background: 'var(--c-accent-border)' }} />
      </div>
      {questions.map(q => (
        <Question key={q.id} question={q} lessonId={lessonId} courseId={courseId} savedProgress={savedProgress} />
      ))}
    </div>
  )
}
