/* oxlint-disable no-underscore-dangle */

import { api } from '../../convex/_generated/api'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import {
  ArrowLeft,
  CircleAlert,
  Clock3,
  FileJson2,
  FileText,
} from 'lucide-react'
import { DocumentStatus } from '../components/document-status'
import { formatBytes, formatDateTime, formatMoney } from '../lib/document-files'

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
  const result = useQuery(api.documents.get, {
    documentId,
  })

  if (result === undefined) {
    return (
      <main
        className="mx-auto max-w-6xl p-5 sm:p-8"
        aria-label="Loading document"
      >
        <div className="h-72 animate-pulse rounded-3xl border bg-white dark:bg-neutral-950" />
      </main>
    )
  }

  if (result === null) {
    return (
      <main className="mx-auto max-w-xl p-5 py-16 text-center sm:p-8">
        <FileText className="mx-auto size-10 text-neutral-400" />
        <h2 className="mt-4 text-2xl font-semibold">Document not found</h2>
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

  const { document, latestJob, latestExtraction } = result
  const extraction = document.structuredResult
  const isProcessing =
    document.status === 'queued' || document.status === 'processing'

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
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
            <DocumentStatus
              status={document.status}
              stage={document.processingStage}
              showStage
            />
          </div>
        </header>

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
                  This page updates automatically. You can safely leave and
                  return later.
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

        {extraction ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]">
            <div className="space-y-6">
              <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6 dark:bg-neutral-950">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-emerald-600" />
                  <h3 className="text-lg font-semibold">Extracted details</h3>
                </div>
                <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <Field
                    label="Document type"
                    value={extraction.documentType}
                  />
                  <Field
                    label="Document number"
                    value={extraction.documentNumber}
                  />
                  <Field
                    label="Supplier"
                    value={extraction.merchantOrSupplierName}
                  />
                  <Field
                    label="Supplier tax ID"
                    value={extraction.supplierTaxIdentifier}
                  />
                  <Field
                    label="Issue date"
                    value={
                      extraction.issueDate.iso || extraction.issueDate.printed
                    }
                  />
                  <Field
                    label="Due date"
                    value={extraction.dueDate.iso || extraction.dueDate.printed}
                  />
                  <Field
                    label="Subtotal"
                    value={formatMoney(
                      extraction.subtotalMinor ?? undefined,
                      extraction.currency ?? undefined,
                    )}
                  />
                  <Field
                    label="Tax"
                    value={formatMoney(
                      extraction.taxMinor ?? undefined,
                      extraction.currency ?? undefined,
                    )}
                  />
                  <Field
                    label="Total"
                    value={formatMoney(
                      extraction.totalMinor ?? undefined,
                      extraction.currency ?? undefined,
                    )}
                    prominent
                  />
                  <Field
                    label="Payment status"
                    value={extraction.paymentStatus}
                  />
                </dl>
              </section>

              <section className="overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-neutral-950">
                <div className="border-b px-5 py-4 sm:px-6">
                  <h3 className="text-lg font-semibold">Line items</h3>
                </div>
                {extraction.lineItems.length === 0 ? (
                  <p className="p-6 text-sm text-neutral-500">
                    No line items were detected.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-sm">
                      <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-900">
                        <tr>
                          <th className="px-6 py-3 font-medium">Description</th>
                          <th className="px-4 py-3 font-medium">Qty</th>
                          <th className="px-4 py-3 font-medium">Unit price</th>
                          <th className="px-6 py-3 text-right font-medium">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {extraction.lineItems.map((item, index) => (
                          <tr key={`${item.description}-${index}`}>
                            <td className="px-6 py-3 font-medium">
                              {item.description}
                            </td>
                            <td className="px-4 py-3 text-neutral-500">
                              {item.quantity ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              {formatMoney(
                                item.unitPriceMinor ?? undefined,
                                extraction.currency ?? undefined,
                              )}
                            </td>
                            <td className="px-6 py-3 text-right font-medium">
                              {formatMoney(
                                item.totalMinor ?? undefined,
                                extraction.currency ?? undefined,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <details className="rounded-2xl border bg-white p-5 dark:bg-neutral-950">
                <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                  <FileJson2 className="size-4" />
                  Validated structured result
                </summary>
                <pre className="mt-4 max-h-[34rem] overflow-auto rounded-xl bg-neutral-950 p-4 text-xs text-neutral-100">
                  {JSON.stringify(extraction, null, 2)}
                </pre>
              </details>
            </div>

            <aside className="space-y-4">
              <section className="rounded-2xl border bg-white p-5 dark:bg-neutral-950">
                <h3 className="font-semibold">Processing</h3>
                <dl className="mt-4 space-y-4 text-sm">
                  <Field label="Model" value={document.model} />
                  <Field
                    label="Latency"
                    value={
                      document.latencyMs === undefined
                        ? undefined
                        : `${(document.latencyMs / 1000).toFixed(2)} seconds`
                    }
                  />
                  <Field
                    label="Tokens"
                    value={document.usage?.totalTokens?.toLocaleString()}
                  />
                  <Field
                    label="Estimated cost"
                    value={
                      document.estimatedCostUsd === undefined
                        ? undefined
                        : `$${document.estimatedCostUsd.toFixed(6)}`
                    }
                  />
                  <Field label="Pages" value={document.pageCount?.toString()} />
                  <Field
                    label="Attempt"
                    value={latestJob?.attempt.toString()}
                  />
                </dl>
              </section>

              {(document.validationErrors.length > 0 ||
                extraction.warnings.length > 0) && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
                  <h3 className="font-semibold text-amber-950 dark:text-amber-200">
                    Review notes
                  </h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-900 dark:text-amber-300">
                    {[...document.validationErrors, ...extraction.warnings].map(
                      (message, index) => (
                        <li key={`${message}-${index}`}>{message}</li>
                      ),
                    )}
                  </ul>
                </section>
              )}

              {latestExtraction && (
                <p className="px-1 text-xs text-neutral-500">
                  Result schema v{latestExtraction.schemaVersion} · confidence{' '}
                  {Math.round(
                    latestExtraction.normalizedOutput.confidence * 100,
                  )}
                  %
                </p>
              )}
            </aside>
          </div>
        ) : (
          !isProcessing &&
          !document.safeErrorMessage && (
            <section className="rounded-2xl border bg-white p-6 text-sm text-neutral-500 dark:bg-neutral-950">
              No structured result is available for this document.
            </section>
          )
        )}
      </div>
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

function Field({
  label,
  value,
  prominent = false,
}: {
  label: string
  value: string | number | null | undefined
  prominent?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd
        className={`mt-1 break-words capitalize ${prominent ? 'text-lg font-semibold' : 'font-medium'}`}
      >
        {value ?? '—'}
      </dd>
    </div>
  )
}
