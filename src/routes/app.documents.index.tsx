import { Link, createFileRoute } from '@tanstack/react-router'
import { FileText, Plus } from 'lucide-react'

export const Route = createFileRoute('/app/documents/')({
  component: DocumentsIndexRoute,
})

function DocumentsIndexRoute() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center justify-center p-6">
      <div className="w-full rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm dark:bg-neutral-950">
        <FileText className="mx-auto size-10 text-neutral-400" />
        <h1 className="mt-5 text-2xl font-semibold">Finance documents</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          The collection view arrives in Phase 2. Your Phase 0 extraction
          results remain available on the upload screen.
        </p>
        <Link
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950"
          to="/app/documents/new"
        >
          <Plus className="size-4" />
          New finance document
        </Link>
      </div>
    </section>
  )
}
