import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import mermaid from 'mermaid'

function useThemeAttribute(): string | null {
  return useSyncExternalStore(
    (callback) => {
      const observer = new MutationObserver(callback)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      return () => observer.disconnect()
    },
    () => document.documentElement.getAttribute('data-theme'),
  )
}

interface Props {
  chart: string
}

export default function MermaidDiagram({ chart }: Props) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useThemeAttribute()

  useEffect(() => {
    let cancelled = false
    const isDark = theme === 'dark'
    mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default', securityLevel: 'loose' })

    // Fresh ID every call — Mermaid v10+ silently fails if ID already exists in DOM
    const id = `mermaid-${Math.random().toString(36).slice(2)}`

    setSvg('')
    setError('')

    mermaid
      .render(id, chart)
      .then(({ svg: rendered }) => { if (!cancelled) setSvg(rendered) })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })

    return () => { cancelled = true }
  }, [chart, theme])

  if (error) {
    return (
      <pre className="rounded-lg p-3 my-4 text-xs overflow-x-auto" style={{ background: 'var(--c-red-sub)', color: 'var(--c-red)', fontFamily: 'var(--font-family-mono)' }}>
        Mermaid error: {error}
      </pre>
    )
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
