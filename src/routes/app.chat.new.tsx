import { api } from '../../convex/_generated/api'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { Landmark, MessageSquareText, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { ChatComposer } from '../components/chat-interface'

export const Route = createFileRoute('/app/chat/new')({
  component: NewChatRoute,
})

const suggestions = [
  'How much did I spend this month?',
  'Which invoices are still outstanding?',
  'Summarize tax recorded in my documents.',
]

function NewChatRoute() {
  const createChat = useMutation(api.chats.create)
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  async function send(prompt: string) {
    setSending(true)
    try {
      const chatId = await createChat({ prompt })
      await navigate({ to: '/app/chat/$chatId', params: { chatId } })
    } finally {
      setSending(false)
    }
  }
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col px-5 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <MessageSquareText className="size-7" />
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight">
            Ask about your finances
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500">
            Answers use read-only tools over your validated receipts and
            invoices, with links back to the source documents.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              className="rounded-2xl border bg-white p-4 text-left text-sm leading-5 shadow-sm hover:border-neutral-400 dark:bg-neutral-950"
              disabled={sending}
              onClick={() => send(suggestion)}
            >
              {index === 0 ? (
                <Landmark className="mb-3 size-4 text-emerald-600" />
              ) : (
                <ReceiptText className="mb-3 size-4 text-emerald-600" />
              )}
              {suggestion}
            </button>
          ))}
        </div>
        <div className="mt-6">
          <ChatComposer onSend={send} disabled={sending} autoFocus />
        </div>
      </div>
    </main>
  )
}
