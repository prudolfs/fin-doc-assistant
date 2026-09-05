import { createFileRoute } from '@tanstack/react-router'
import { MessageSquareText } from 'lucide-react'

export const Route = createFileRoute('/app/chat/new')({
  component: NewChatRoute,
})

function NewChatRoute() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center justify-center p-6">
      <div className="w-full rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm dark:bg-neutral-950">
        <MessageSquareText className="mx-auto size-10 text-neutral-400" />
        <h1 className="mt-5 text-2xl font-semibold">Start a conversation</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          Chat and grounded finance tools are planned for Phase 4. This route is
          protected and ready for that workflow.
        </p>
      </div>
    </section>
  )
}
