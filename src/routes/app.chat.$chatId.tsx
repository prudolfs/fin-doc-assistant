import {
  optimisticallySendMessage,
  useUIMessages,
} from '@convex-dev/agent/react'
import { api } from '../../convex/_generated/api'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { MessageSquareText, Plus } from 'lucide-react'
import { ChatComposer, ChatMessages } from '../components/chat-interface'

export const Route = createFileRoute('/app/chat/$chatId')({
  component: ChatRoute,
})

function ChatRoute() {
  const { chatId } = Route.useParams()
  const chat = useQuery(api.chats.get, { chatId })
  const messages = useUIMessages(
    api.chats.listMessages,
    chat ? { threadId: chat.threadId } : 'skip',
    { initialNumItems: 30, stream: true },
  )
  const sendMessage = useMutation(api.chats.send).withOptimisticUpdate(
    (store, args) => {
      if (!chat) return
      optimisticallySendMessage(api.chats.listMessages)(store, {
        threadId: chat.threadId,
        prompt: args.prompt,
      })
    },
  )

  if (chat === undefined) {
    return (
      <main className="mx-auto max-w-3xl p-8" aria-label="Loading conversation">
        <div className="h-64 animate-pulse rounded-3xl border bg-white dark:bg-neutral-950" />
      </main>
    )
  }
  if (chat === null) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center p-6 text-center">
        <div className="w-full">
          <MessageSquareText className="mx-auto size-10 text-neutral-400" />
          <h2 className="mt-4 text-2xl font-semibold">
            Conversation not found
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            It may have been removed, or it does not belong to this account.
          </p>
          <Link
            className="mt-6 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold"
            to="/app/chat/new"
          >
            Start a new chat
          </Link>
        </div>
      </main>
    )
  }

  const responding = chat.status === 'responding'
  const { _id: selectedChatId } = chat
  return (
    <main className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b bg-white/70 px-5 py-3 backdrop-blur-sm sm:px-8 dark:bg-neutral-950/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{chat.title}</h2>
            <p className="text-xs text-neutral-500">
              Grounded in your finance documents
            </p>
          </div>
          <Link
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
            to="/app/chat/new"
          >
            <Plus className="size-3.5" /> New chat
          </Link>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-8">
        <ChatMessages
          messages={messages.results}
          responding={responding}
          canLoadMore={messages.status === 'CanLoadMore'}
          onLoadMore={() => messages.loadMore(30)}
        />
      </div>
      <div className="border-t bg-neutral-50/90 px-5 py-4 backdrop-blur-sm sm:px-8 dark:bg-neutral-900/90">
        <ChatComposer
          disabled={responding}
          onSend={async (prompt) => {
            await sendMessage({ chatId: selectedChatId, prompt })
          }}
        />
        {chat.safeErrorMessage && (
          <p className="mx-auto mt-2 max-w-3xl px-2 text-xs text-red-700 dark:text-red-300">
            {chat.safeErrorMessage}
          </p>
        )}
      </div>
    </main>
  )
}
