import type { UIMessage } from '@convex-dev/agent/react'
import { Link } from '@tanstack/react-router'
import {
  ArrowUp,
  Bot,
  FileText,
  LoaderCircle,
  Search,
  User,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { extractChartSpecs } from '../../shared/chartSpec'
import { FinanceChart } from './finance-chart'
import type { FormEvent, ReactNode } from 'react'

export function ChatComposer({
  onSend,
  disabled,
  autoFocus = false,
}: {
  onSend: (prompt: string) => Promise<void>
  disabled: boolean
  autoFocus?: boolean
}) {
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = prompt.trim()
    if (!value || disabled) return
    setError(null)
    try {
      await onSend(value)
      setPrompt('')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not send message.',
      )
    }
  }
  return (
    <form className="mx-auto w-full max-w-3xl" onSubmit={submit}>
      <div className="rounded-2xl border bg-white p-2 shadow-lg shadow-neutral-950/5 focus-within:border-neutral-400 dark:bg-neutral-950">
        <textarea
          className="max-h-48 min-h-14 w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-400"
          value={prompt}
          placeholder="Ask about your receipts, invoices, totals, suppliers, or tax…"
          maxLength={4_000}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={2}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-1">
          <span className="text-[11px] text-neutral-400">
            Read-only finance tools · Shift+Enter for a new line
          </span>
          <button
            aria-label="Send message"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-950"
            disabled={disabled || !prompt.trim()}
            type="submit"
          >
            {disabled ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </div>
      </div>
      {error && (
        <p
          className="mt-2 px-2 text-xs text-red-700 dark:text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  )
}

export function ChatMessages({
  messages,
  responding,
  canLoadMore,
  onLoadMore,
}: {
  messages: Array<UIMessage>
  responding: boolean
  canLoadMore: boolean
  onLoadMore: () => void
}) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, responding])
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-8">
      {canLoadMore && (
        <button
          className="mx-auto block rounded-xl border bg-white px-3 py-2 text-xs font-medium dark:bg-neutral-950"
          onClick={onLoadMore}
        >
          Load older messages
        </button>
      )}
      {messages.map((message) => (
        <ChatMessage key={message.key} message={message} />
      ))}
      {responding &&
        !messages.some(
          (message) =>
            message.role === 'assistant' && message.status === 'streaming',
        ) && (
          <div
            className="flex items-center gap-3 text-sm text-neutral-500"
            aria-live="polite"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Bot className="size-4" />
            </span>
            <LoaderCircle className="size-4 animate-spin" />
            Checking your finance documents…
          </div>
        )}
      <div ref={endRef} />
    </div>
  )
}

function ChatMessage({ message }: { message: UIMessage }) {
  if (message.role === 'system') return null
  const isUser = message.role === 'user'
  return (
    <article className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Bot className="size-4" />
        </span>
      )}
      <div
        className={
          isUser
            ? 'max-w-[85%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-3 text-sm leading-6 text-white dark:bg-neutral-100 dark:text-neutral-950'
            : 'max-w-[calc(100%-2.75rem)] min-w-0 flex-1 space-y-3 text-sm leading-6'
        }
      >
        {message.parts.map((part, index) => (
          <MessagePart key={index} part={part} />
        ))}
        {message.status === 'streaming' && !isUser && (
          <span className="inline-block h-4 w-1 animate-pulse rounded-full bg-emerald-500" />
        )}
      </div>
      {isUser && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          <User className="size-4" />
        </span>
      )}
    </article>
  )
}

function MessagePart({ part }: { part: UIMessage['parts'][number] }) {
  if (part.type === 'text')
    return (
      <p className="whitespace-pre-wrap">{renderInternalLinks(part.text)}</p>
    )
  if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool')
    return null
  const record = part as unknown as Record<string, unknown>
  const state = typeof record.state === 'string' ? record.state : 'working'
  const toolName =
    typeof record.toolName === 'string'
      ? record.toolName
      : part.type.replace('tool-', '')
  const sources = sourceDocuments(record.output)
  const charts =
    toolName === 'getChartData' ? extractChartSpecs(record.output) : []
  const finished = state === 'output-available'
  return (
    <div className="rounded-2xl border bg-neutral-50 p-3 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-xs font-semibold">
        {finished ? (
          <Search className="size-3.5 text-emerald-600" />
        ) : (
          <LoaderCircle className="size-3.5 animate-spin text-neutral-500" />
        )}
        {humanizeToolName(toolName)}
        <span className="ml-auto font-normal text-neutral-500">
          {finished ? 'Complete' : 'Running'}
        </span>
      </div>
      {charts.map((spec) => (
        <FinanceChart key={`${spec.title}-${spec.currency}`} spec={spec} />
      ))}
      {sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sources.map((source) => (
            <Link
              key={source.documentId}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium hover:border-neutral-400 dark:bg-neutral-950"
              to="/app/documents/$documentId"
              params={{ documentId: source.documentId }}
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">{source.originalFilename}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function renderInternalLinks(text: string): Array<ReactNode> {
  const pattern = /\[([^\]]+)]\((\/app\/documents\/([^\s)]+))\)/g
  const nodes: Array<ReactNode> = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push(text.slice(cursor, index))
    nodes.push(
      <Link
        key={`${index}-${match[3]}`}
        className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 dark:text-emerald-400"
        to="/app/documents/$documentId"
        params={{ documentId: match[3] }}
      >
        {match[1]}
      </Link>,
    )
    cursor = index + match[0].length
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function humanizeToolName(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function sourceDocuments(value: unknown) {
  const found = new Map<
    string,
    { documentId: string; originalFilename: string }
  >()
  function visit(candidate: unknown, depth: number) {
    if (depth > 5 || candidate === null || candidate === undefined) return
    if (Array.isArray(candidate)) {
      for (const item of candidate.slice(0, 50)) visit(item, depth + 1)
      return
    }
    if (typeof candidate !== 'object') return
    const record = candidate as Record<string, unknown>
    if (
      typeof record.documentId === 'string' &&
      typeof record.originalFilename === 'string'
    ) {
      found.set(record.documentId, {
        documentId: record.documentId,
        originalFilename: record.originalFilename,
      })
    }
    for (const nested of Object.values(record).slice(0, 50))
      visit(nested, depth + 1)
  }
  visit(value, 0)
  return [...found.values()].slice(0, 10)
}
