/* oxlint-disable no-underscore-dangle */

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { EditableDocumentField } from '../../shared/documentReview'
import type { FinanceDocumentExtraction } from '../../shared/financeSchemas'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft, CircleAlert, Clock3, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DocumentPreview } from '../components/document-preview'
import { DocumentReviewForm } from '../components/document-review-form'
import { DocumentStatus } from '../components/document-status'
import { formatBytes, formatDateTime } from '../lib/document-files'

export const Route = createFileRoute('/app/documents/$documentId')({
  component: DocumentDetailRoute,
})

const stages = [
  'queued',
  'downloading',
  'extracting',
  'validating',
  'completed',
]

function DocumentDetailRoute() {
  const { documentId } = Route.useParams()
  const navigate = useNavigate()
  const retryDocument = useMutation(api.documents.retry)
  const removeDocument = useMutation(api.documents.remove)
  const result = useQuery(api.documents.get, { documentId })
  const [action, setAction] = useState<'retry' | 'delete' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function retry(id: Id<'documents'>) {
    setAction('retry')
    setActionError(null)
    try {
      await retryDocument({ documentId: id })
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Retry failed.')
    } finally {
      setAction(null)
    }
  }

  async function remove(id: Id<'documents'>, filename: string) {
    const confirmed = window.confirm(
      `Permanently delete ${filename}, its stored file, and extraction history?`,
    )
    if (!confirmed) return
    setAction('delete')
    setActionError(null)
    try {
      await removeDocument({ documentId: id })
      await navigate({ to: '/app/documents' })
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Delete failed.')
      setAction(null)
    }
  }

  if (result === undefined) return <LoadingDocument />
  if (result === null) return <MissingDocument />

  const { document, latestJob, latestExtraction, fileUrl, auditEvents } = result
  const extraction = document.structuredResult
    ? ({
        ...document.structuredResult,
        evidence: document.structuredResult.evidence ?? [],
      } satisfies FinanceDocumentExtraction)
    : null
  const isProcessing =
    document.status === 'queued' || document.status === 'processing'
  const canRetry =
    (document.status === 'failed' || document.status === 'needs_review') &&
    (latestJob?.attempt ?? 0) < 3

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <header>
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950 dark:hover:text-white"
            to="/app/documents"
          >
            <ArrowLeft className="size-4" />
            Finance documents
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {document.merchantOrSupplierName || document.originalFilename}
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                {document.originalFilename} · {formatBytes(document.byteSize)} ·{' '}
                uploaded {formatDateTime(document.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <DocumentStatus
                status={document.status}
                stage={document.processingStage}
                showStage
              />
              {canRetry && (
                <button
                  className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-neutral-950"
                  disabled={action !== null}
                  onClick={() => retry(document._id)}
                >
                  <RotateCcw className="size-4" />
                  {action === 'retry' ? 'Queuing…' : 'Retry extraction'}
                </button>
              )}
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50 dark:border-red-900 dark:bg-neutral-950 dark:text-red-300"
                disabled={action !== null || isProcessing}
                onClick={() => remove(document._id, document.originalFilename)}
              >
                <Trash2 className="size-4" />
                {action === 'delete' ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </header>

        {actionError && (
          <p
            className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            {actionError}
          </p>
        )}

        {isProcessing && (
          <section
            className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 size-5 text-blue-700 dark:text-blue-300" />
              <div>
                <h3 className="font-semibold">Extraction is running</h3>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  This page updates automatically. Confirmed fields will not be
                  overwritten by this extraction attempt.
                </p>
              </div>
            </div>
            <StageProgress current={document.processingStage} />
          </section>
        )}

        {document.safeErrorMessage && (
          <section className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <h3 className="font-semibold">Processing failed</h3>
              <p className="mt-1 text-sm">{document.safeErrorMessage}</p>
            </div>
          </section>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="xl:sticky xl:top-24">
            <DocumentPreview
              fileUrl={fileUrl}
              mimeType={document.mimeType}
              filename={document.originalFilename}
            />
          </div>
          <div className="space-y-6">
            {extraction ? (
              <DocumentReviewForm
                key={`${document._id}:${document.updatedAt}`}
                documentId={document._id}
                extraction={extraction}
                confirmedFields={
                  (document.confirmedFields ??
                    []) as Array<EditableDocumentField>
                }
                pageCount={document.pageCount ?? 1}
              />
            ) : (
              !isProcessing && (
                <section className="rounded-2xl border bg-white p-6 text-sm text-neutral-500 dark:bg-neutral-950">
                  No structured result is available. Retry extraction when the
                  failure is recoverable.
                </section>
              )
            )}

            {extraction && extraction.evidence.length > 0 && (
              <section className="rounded-2xl border bg-white p-5 dark:bg-neutral-950">
                <h3 className="font-semibold">Extraction evidence</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Printed values and their one-based source pages.
                </p>
                <ul className="mt-4 divide-y">
                  {extraction.evidence.map((evidence, index) => (
                    <li
                      key={`${evidence.field}-${index}`}
                      className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_1.5fr_auto] sm:gap-3"
                    >
                      <span className="font-medium capitalize">
                        {evidence.field.replaceAll('_', ' ')}
                      </span>
                      <span className="text-neutral-600 dark:text-neutral-300">
                        “{evidence.printedValue}”
                      </span>
                      <span className="text-xs text-neutral-500">
                        Page {evidence.sourcePage}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {document.validationErrors.length > 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
                <h3 className="font-semibold text-amber-950 dark:text-amber-200">
                  Validation warnings
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-900 dark:text-amber-300">
                  {document.validationErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </section>
            )}

            <ProcessingMetadata
              document={document}
              attempt={latestJob?.attempt}
              confidence={latestExtraction?.normalizedOutput.confidence}
            />
            <AuditTrail events={auditEvents} />
          </div>
        </div>
      </div>
    </main>
  )
}

function LoadingDocument() {
  return (
    <main
      className="mx-auto max-w-6xl p-5 sm:p-8"
      aria-label="Loading document"
    >
      <div className="h-72 animate-pulse rounded-3xl border bg-white dark:bg-neutral-950" />
    </main>
  )
}

function MissingDocument() {
  return (
    <main className="mx-auto max-w-xl p-5 py-16 text-center sm:p-8">
      <h2 className="text-2xl font-semibold">Document not found</h2>
      <p className="mt-2 text-sm text-neutral-500">
        It may have been removed, or it does not belong to this account.
      </p>
      <Link
        className="mt-6 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold"
        to="/app/documents"
      >
        Back to documents
      </Link>
    </main>
  )
}

function StageProgress({ current }: { current: string }) {
  const currentIndex = stages.indexOf(current)
  return (
    <ol
      className="mt-5 grid grid-cols-5 gap-1"
      aria-label="Processing progress"
    >
      {stages.map((stage, index) => (
        <li key={stage} className="min-w-0">
          <div
            className={`h-1.5 rounded-full ${index <= currentIndex ? 'bg-blue-600' : 'bg-blue-200 dark:bg-blue-900'}`}
          />
          <span className="mt-1.5 block truncate text-[10px] text-neutral-500 capitalize">
            {stage}
          </span>
        </li>
      ))}
    </ol>
  )
}

function ProcessingMetadata({
  document,
  attempt,
  confidence,
}: {
  document: {
    updatedAt: number
    lastReviewedAt?: number
    model?: string
    latencyMs?: number
    usage?: { totalTokens?: number }
    estimatedCostUsd?: number
    pageCount?: number
  }
  attempt?: number
  confidence?: number
}) {
  const entries = [
    ['Last processed', formatDateTime(document.updatedAt)],
    [
      'Last reviewed',
      document.lastReviewedAt ? formatDateTime(document.lastReviewedAt) : '—',
    ],
    ['Attempt', attempt?.toString() ?? '—'],
    ['Pages', document.pageCount?.toString() ?? '—'],
    ['Model', document.model ?? '—'],
    [
      'Confidence',
      confidence === undefined ? '—' : `${Math.round(confidence * 100)}%`,
    ],
    [
      'Latency',
      document.latencyMs === undefined
        ? '—'
        : `${(document.latencyMs / 1000).toFixed(2)} s`,
    ],
    ['Tokens', document.usage?.totalTokens?.toLocaleString() ?? '—'],
    [
      'Estimated cost',
      document.estimatedCostUsd === undefined
        ? '—'
        : `$${document.estimatedCostUsd.toFixed(6)}`,
    ],
  ]
  return (
    <section className="rounded-2xl border bg-white p-5 dark:bg-neutral-950">
      <h3 className="font-semibold">Processing metadata</h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {entries.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-neutral-500">{label}</dt>
            <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function AuditTrail({
  events,
}: {
  events: Array<{
    _id: string
    action: string
    attempt?: number
    detail?: string
    changedFields?: Array<string>
    createdAt: number
  }>
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 dark:bg-neutral-950">
      <h3 className="font-semibold">Audit history</h3>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No audit events recorded yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {events.map((event) => (
            <li
              key={event._id}
              className="border-l-2 border-neutral-200 pl-4 dark:border-neutral-700"
            >
              <p className="text-sm font-medium capitalize">
                {event.action.replaceAll('_', ' ')}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {formatDateTime(event.createdAt)}
                {event.attempt ? ` · attempt ${event.attempt}` : ''}
                {event.changedFields?.length
                  ? ` · ${event.changedFields.length} confirmed field${event.changedFields.length === 1 ? '' : 's'}`
                  : ''}
                {event.detail ? ` · ${event.detail}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
