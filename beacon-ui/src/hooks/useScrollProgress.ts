import { useState } from 'react'
import { useEventListener } from 'usehooks-ts'

export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0)

  useEventListener('scroll', () => {
    const el = document.documentElement
    const total = el.scrollHeight - el.clientHeight
    setProgress(total > 0 ? el.scrollTop / total : 0)
  })

  return progress
}
