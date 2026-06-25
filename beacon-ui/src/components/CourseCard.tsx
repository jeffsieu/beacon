import { Link } from 'react-router'
import type { CourseSummary } from '../types'
import { encodeCourseId } from '../api'
import { courseColor } from '../lib/course-color'

interface Props {
  summary: CourseSummary
}

export default function CourseCard({ summary }: Props) {
  const { course, title, description, totalItems, learnedCount, partialCount } = summary
  const pct = totalItems > 0 ? Math.round(((learnedCount + partialCount * 0.5) / totalItems) * 100) : 0
  const color = courseColor(course)
  const filledDots = Math.round(pct / 20)
  const displayTitle = title ?? course

  return (
    <Link
      to={`/${encodeCourseId(course)}`}
      className="block no-underline rounded-xl border transition-all duration-200 overflow-hidden"
      style={{
        background: 'var(--c-surface)',
        borderColor: 'var(--c-border)',
        borderTopWidth: '3px',
        borderTopColor: color,
        boxShadow: '0 1px 3px rgba(56,42,18,.06)',
        color: 'inherit',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 4px 12px rgba(56,42,18,.1)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = ''
        el.style.boxShadow = '0 1px 3px rgba(56,42,18,.06)'
      }}
    >
      <div className="px-5 py-5 flex flex-col gap-3">
        <div>
          <div className="font-semibold mb-1" style={{ fontFamily: 'var(--font-family-display)', fontSize: '1.1rem', color: 'var(--c-text)' }}>
            {displayTitle}
          </div>
          {description && (
            <div className="text-xs leading-snug" style={{ fontFamily: 'var(--font-family-ui)', color: 'var(--c-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {description}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: i < filledDots ? color : 'var(--c-border)' }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-family-ui)', color: 'var(--c-muted)' }}>
            {totalItems > 0 ? `${pct}%` : 'No progress'}
          </span>
        </div>
      </div>
    </Link>
  )
}
