import { useState } from 'react'
import type { PlacementQuestion as PQ } from '../types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  question: PQ
  onAnswer: (questionId: string, type: PQ['type'], answer: string | string[]) => void
  disabled?: boolean
}

export default function PlacementQuestion({ question, onAnswer, disabled = false }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [text, setText] = useState('')

  function handleMcSelect(opt: string) {
    if (disabled) return
    setSelected([opt])
    onAnswer(question.id, question.type, opt)
  }

  function handleMultiToggle(opt: string) {
    if (disabled) return
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]
    setSelected(next)
  }

  function handleMultiSubmit() {
    if (disabled || selected.length === 0) return
    onAnswer(question.id, question.type, selected)
  }

  function handleTextSubmit() {
    if (disabled || !text.trim()) return
    onAnswer(question.id, question.type, text.trim())
    setText('')
  }

  return (
    <div className="mb-[4.5rem]">
      <p className="font-medium mb-4" style={{ fontFamily: 'var(--font-family-display)', color: 'var(--c-text)', lineHeight: 1.5, fontSize: '1.1rem' }}>
        {question.title}
      </p>

      {(question.type === 'mc') && question.options && (
        <div className="grid gap-2">
          {question.options.map(opt => (
            <button
              key={opt}
              onClick={() => handleMcSelect(opt)}
              disabled={disabled}
              className={`question-option text-left${selected.includes(opt) ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
            >
              {opt}
            </button>
          ))}
          <button
            onClick={() => handleMcSelect('__dont_know__')}
            disabled={disabled}
            className={`question-option text-left${selected.includes('__dont_know__') ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
            style={{ opacity: 0.65, fontStyle: 'italic' }}
          >
            I don't know
          </button>
        </div>
      )}

      {question.type === 'multi-select' && question.options && (
        <div className="grid gap-2">
          {question.options.map(opt => (
            <button
              key={opt}
              onClick={() => handleMultiToggle(opt)}
              disabled={disabled}
              className={`question-option text-left${selected.includes(opt) ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
            >
              <span className="mr-2 text-xs" style={{ color: 'var(--c-accent)' }}>{selected.includes(opt) ? '✓' : '○'}</span>
              {opt}
            </button>
          ))}
          <Button onClick={handleMultiSubmit} disabled={disabled || selected.length === 0} size="sm" className="mt-2 self-start">Submit</Button>
        </div>
      )}

      {question.type === 'free-text' && (
        <div className="flex flex-col gap-2">
          <Textarea value={text} onChange={e => setText(e.target.value)} disabled={disabled} rows={3} placeholder="Type your answer…" className="resize-none bg-[var(--c-surface-2)] text-sm" onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleTextSubmit() }} />
          <div className="flex items-center gap-2">
            <Button onClick={handleTextSubmit} disabled={disabled || !text.trim()} size="sm">Submit</Button>
            <Button onClick={() => onAnswer(question.id, 'free-text', '__dont_know__')} disabled={disabled} variant="outline" size="sm" style={{ opacity: 0.55, fontStyle: 'italic' }}>I don't know</Button>
          </div>
        </div>
      )}
    </div>
  )
}
