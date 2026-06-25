import { Link } from 'react-router'
import type { LessonMeta } from '../types'
import { encodeCourseId } from '../api'
import { CheckCheck, CheckCircle2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  lessons: LessonMeta[]
  /** Show the course name as a tag next to the title (for cross-course lists like the dashboard) */
  showCourse?: boolean
}

export default function LessonList({ lessons, showCourse = false }: Props) {
  if (lessons.length === 0) return null

  return (
    <div className="grid gap-2">
      {lessons.map(lesson => (
        <div
          key={lesson.slug}
          className="flex items-center gap-4 px-5 py-3.5 rounded-[18px] border border-solid transition-colors duration-150"
          style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-surface-2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-surface)' }}
        >
          <Link
            to={`/${encodeCourseId(lesson.course)}/lessons/${lesson.slug}`}
            className="flex-1 min-w-0 flex items-center gap-2.5 text-sm font-medium no-underline"
            style={{ fontFamily: 'var(--font-family-ui)', color: 'var(--c-text)' }}
          >
            {lesson.status === 'completed' ? (
              <CheckCheck size={15} className="flex-shrink-0" style={{ color: 'var(--c-green)' }} />
            ) : lesson.status === 'completed_partial' ? (
              <CheckCircle2 size={15} className="flex-shrink-0" style={{ color: 'var(--c-accent)' }} />
            ) : null}
            <span>{lesson.title || lesson.slug}</span>
            {showCourse && (
              <span
                className="ml-2 text-xs capitalize px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'var(--c-surface-2)', color: 'var(--c-muted)', fontFamily: 'var(--font-family-mono)' }}
              >
                {lesson.course}
              </span>
            )}
          </Link>
          <Link
            to={`/${encodeCourseId(lesson.course)}/lessons/${lesson.slug}`}
            className={cn(
              buttonVariants({
                variant: lesson.status === 'completed' ? 'ghost' : 'outline',
                size: 'sm',
              }),
              'text-xs flex-shrink-0'
            )}
          >
            {lesson.status === 'completed' ? 'Review' : 'Continue'}
          </Link>
        </div>
      ))}
    </div>
  )
}
