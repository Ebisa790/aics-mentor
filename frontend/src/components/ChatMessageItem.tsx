import { useState } from 'react'
import type { ChatMessage } from '../api/types'

interface ChatMessageItemProps {
  message: ChatMessage
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'bg-primary text-white rounded-br-none'
            : 'bg-canvas text-ink border border-border rounded-bl-none'
        }`}
      >
        <MessageContent content={message.content} />
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  // Parse code blocks tagged with ```lang ... ```
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <div className="space-y-3 whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n')
          const language = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : ''
          const codeText = language ? lines.slice(1).join('\n') : lines.join('\n')

          return <CodeBlock key={index} code={codeText} language={language} />
        }

        return (
          <span key={index} className="inline-block w-full">
            {part}
          </span>
        )
      })}
    </div>
  )
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2 rounded-xl border border-border bg-slate-900 text-slate-100 overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/50 text-[11px] text-slate-400">
        <span className="font-semibold uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="hover:text-white transition-colors bg-slate-700/50 hover:bg-slate-700 px-2 py-0.5 rounded text-[10px]"
        >
          {copied ? ' Copied' : ' Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}