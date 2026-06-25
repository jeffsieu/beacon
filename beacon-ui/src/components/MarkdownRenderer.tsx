import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import { useState } from 'react'
import { Copy, CheckCircle2 } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import type { Components } from 'react-markdown'
import MermaidDiagram from './MermaidDiagram.tsx'

interface Props {
  content: string
  className?: string
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)
  function doCopy() {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group my-3">
      <button
        onClick={doCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md z-10"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
        title="Copy"
      >
        {copied
          ? <CheckCircle2 size={14} style={{ color: 'var(--c-green)' }} />
          : <Copy size={14} style={{ color: 'var(--c-muted)' }} />
        }
      </button>
      <SyntaxHighlighter
        language={language}
        PreTag="div"
        useInlineStyles={false}
        style={{}}
        codeTagProps={{
          style: {
            fontFamily: 'var(--font-family-mono)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          },
        }}
        customStyle={{
          background: 'var(--c-surface-2)',
          border: '1px solid var(--c-border)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          paddingRight: '3rem',
          margin: 0,
          overflow: 'auto',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '')
    if (match && match[1] === 'mermaid') {
      return <MermaidDiagram chart={String(children).trim()} />
    }
    // Fenced code block
    if (match) {
      return (
        <CodeBlock language={match[1]}>
          {String(children).replace(/\n$/, '')}
        </CodeBlock>
      )
    }
    // Inline code
    return (
      <code
        style={{
          background: 'var(--c-surface-2)',
          color: 'var(--c-accent-h)',
          padding: '0.15em 0.35em',
          borderRadius: '3px',
          fontSize: '0.9em',
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
        }}
        {...props}
      >
        {children}
      </code>
    )
  },
}

export default function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
