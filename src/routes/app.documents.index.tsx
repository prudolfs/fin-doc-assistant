/* oxlint-disable no-underscore-dangle */

import { api } from '../../convex/_generated/api'
import { Link, createFileRoute } from '@tanstack/react-router'
import { usePaginatedQuery } from 'convex/react'
import { ChevronRight, FileText, Plus, ReceiptText } from 'lucide-react'
import { DocumentStatus } from '../components/document-status'
import { formatBytes, formatDateTime, formatMoney } from '../lib/document-files'

export const Route = createFileRoute('/app/documents/')({
  component: DocumentsIndexRoute,
})

function DocumentsIndexRoute() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.list,
    {},
    { initialNumItems: 20 },
  )

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Document collection
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              Finance documents
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Uploads and processing results update here in realtime.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950"
            to="/app/documents/new"
          >
            <Plus className="size-4" />
            Add documents
          </Link>
        </header>

        {status === 'LoadingFirstPage' ? (
          <div className="grid gap-3" aria-label="Loading documents">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl border bg-white dark:bg-neutral-950"
              />
            ))}
          </div>
        ) : results.length === 0 ? (
          <section className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm dark:bg-neutral-950">
            <FileText className="mx-auto size-10 text-neutral-400" />
            <h3 className="mt-5 text-xl font-semibold">No documents yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
              Upload your first receipt or invoice to create a structured,
              searchable finance record.
            </p>
            <Link
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
              to="/app/documents/new"
            >
              <Plus className="size-4" />
              Upload a document
            </Link>
          </section>
        ) : (
          <section className="space-y-3" aria-label="Finance documents">
            {results.map((document) => (
              <Link
                key={document._id}
                className="group grid gap-4 rounded-2xl border bg-white p-4 shadow-sm transition hover:border-neutral-400 hover:shadow-md sm:grid-cols-[minmax(0,1.5fr)_minmax(9rem,0.7fr)_minmax(8rem,0.6fr)_auto] sm:items-center sm:p-5 dark:bg-neutral-950 dark:hover:border-neutral-600"
                to="/app/documents/$documentId"
                params={{ documentId: document._id }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    <ReceiptText className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {document.merchantOrSupplierName ||
                        document.originalFilename}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {document.merchantOrSupplierName
                        ? document.originalFilename
                        : `${formatBytes(document.byteSize)} · ${document.mimeType}`}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Uploaded</p>
                  <p className="mt-1 text-sm">
                    {formatDateTime(document.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Total</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatMoney(document.totalMinor, document.currency)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <DocumentStatus
                    status={document.status}
                    stage={document.processingStage}
                  />
                  <ChevronRight className="size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
            {status === 'CanLoadMore' && (
              <button
                className="mt-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                onClick={() => loadMore(20)}
              >
                Load more
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
