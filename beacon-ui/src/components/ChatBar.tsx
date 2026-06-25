import { useState, useRef, forwardRef, useImperativeHandle, KeyboardEvent, ChangeEvent, RefObject } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface ChatBarHandle {
  setValue: (text: string) => void
}

interface ChatBarProps {
  placeholder?: string
  onSend: (content: string) => void
  disabled?: boolean
  loading?: boolean
  className?: string
  inputRef?: RefObject<HTMLTextAreaElement | null>
}

const ChatBar = forwardRef<ChatBarHandle, ChatBarProps>(function ChatBar(
  { placeholder = 'What do you wish to learn?', onSend, disabled = false, loading = false, className, inputRef: externalRef },
  ref
) {
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = externalRef || internalRef
  const [value, setValue] = useState('')
  const hasContent = value.trim().length > 0

  useImperativeHandle(ref, () => ({
    setValue(text: string) {
      setValue(text)
      // Auto-resize after setting value
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`
          textareaRef.current.focus()
        }
      })
    },
  }))

  function handleSend() {
    const text = value.trim()
    if (!text || disabled || loading) return
    onSend(text)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`
  }

  return (
    <div
      className={cn(
        'flex items-end rounded-xl overflow-hidden transition-colors duration-150',
        className,
      )}
      style={{
        border: `1px solid var(--c-border)`,
        background: 'var(--c-bg)',
      }}
    >
      <Textarea
        ref={textareaRef}
        className="flex-1 px-3 py-2.5 text-[0.83rem] resize-none leading-snug bg-transparent border-0 focus-visible:ring-0 focus-visible:border-0 rounded-none min-h-[36px] max-h-[100px]"
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        value={value}
        rows={1}
        placeholder={placeholder}
        disabled={disabled || loading}
      />
      <Button
        variant={hasContent && !disabled && !loading ? "default" : "ghost"}
        size="icon-xs"
        className="flex-shrink-0 self-end mb-1.5 mr-1.5"
        style={hasContent && !disabled && !loading ? { background: 'var(--c-accent)', color: '#221E17' } : undefined}
        onClick={handleSend}
        disabled={!hasContent || disabled || loading}
        title="Send"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
      </Button>
    </div>
  )
})

export default ChatBar
