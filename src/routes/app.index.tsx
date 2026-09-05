/* oxlint-disable no-underscore-dangle */

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

export const Route = createFileRoute('/app/')({ component: AppIndexRoute })

const acceptedTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const
type AcceptedType = (typeof acceptedTypes)[number]

function AppIndexRoute() {
  return <Navigate to="/app/documents/new" replace />
}

export function PhaseZeroDocumentSpike() {
  const inputRef = useRef<HTMLInputElement>(null)
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl)
  const registerDocument = useMutation(api.documents.registerDocument)
  const uploadConfiguration = useQuery(api.documents.getUploadConfiguration)
  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.list,
    {},
    { initialNumItems: 20 },
  )
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    const maxFiles = uploadConfiguration?.maxAcceptedFiles ?? 5
    const maxBytes =
      uploadConfiguration?.maxAcceptedFileBytes ?? 10 * 1024 * 1024
    if (files.length > maxFiles) {
      setError(`Choose at most ${maxFiles} files.`)
      return
    }
    setUploading(true)
    setError(null)
    try {
      for (const [index, file] of files.entries()) {
        if (
          !acceptedTypes.includes(file.type as AcceptedType) ||
          (uploadConfiguration &&
            !uploadConfiguration.acceptedMimeTypes.includes(file.type))
        ) {
          throw new Error(`${file.name} is not a supported PDF or image.`)
        }
        if (file.size > maxBytes) {
          throw new Error(
            `${file.name} exceeds the ${formatBytes(maxBytes)} limit.`,
          )
        }
        setProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`)
        const uploadUrl = await generateUploadUrl({})
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!response.ok) throw new Error(`Upload failed for ${file.name}.`)
        const payload: unknown = await response.json()
        if (
          !payload ||
          typeof payload !== 'object' ||
          !('storageId' in payload) ||
          typeof payload.storageId !== 'string'
        ) {
          throw new Error(
            `Upload returned an invalid response for ${file.name}.`,
          )
        }
        await registerDocument({
          storageId: payload.storageId as Id<'_storage'>,
          originalFilename: file.name,
          mimeType: file.type as AcceptedType,
        })
      }
      setProgress('Uploaded. Convex is processing asynchronously.')
      if (inputRef.current) inputRef.current.value = ''
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="px-5 py-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <header>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Phase 0 validation spike
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            Document extraction
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Upload PDF, PNG, JPEG, or WebP files. Results, status, latency,
            token usage, and estimated model cost update in realtime.
          </p>
        </header>

        <section className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-neutral-950">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-neutral-300 p-8 text-center hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500">
            <span className="block font-medium">
              Choose up to {uploadConfiguration?.maxAcceptedFiles ?? 5} finance
              documents
            </span>
            <span className="mt-1 block text-sm text-neutral-500">
              {formatBytes(
                uploadConfiguration?.maxAcceptedFileBytes ?? 10 * 1024 * 1024,
              )}{' '}
              each · PDFs up to {uploadConfiguration?.maxPages ?? 50} pages
            </span>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={upload}
            />
          </label>
          {progress && (
            <p className="mt-3 text-sm text-neutral-600">{progress}</p>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Realtime results</h2>
          {results.length === 0 && (
            <p className="rounded-xl border bg-white p-6 text-sm text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
              No documents uploaded yet. Synthetic fixtures are in{' '}
              <code>tests/fixtures/phase0</code>.
            </p>
          )}
          {results.map((document) => (
            <article
              key={document._id}
              className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-neutral-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{document.originalFilename}</h3>
                  <p className="text-sm text-neutral-500">
                    {formatBytes(document.byteSize)} ·{' '}
                    {document.pageCount ?? '—'} page(s)
                  </p>
                </div>
                <Status
                  value={document.status}
                  stage={document.processingStage}
                />
              </div>
              {document.safeErrorMessage && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  {document.safeErrorMessage}
                </p>
              )}
              {document.validationErrors.length > 0 && (
                <ul className="mt-4 list-disc rounded-lg bg-amber-50 p-4 pl-8 text-sm text-amber-900">
                  {document.validationErrors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {document.structuredResult && (
                <>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                    <Metric label="Model" value={document.model ?? '—'} />
                    <Metric
                      label="Latency"
                      value={
                        document.latencyMs === undefined
                          ? '—'
                          : `${(document.latencyMs / 1000).toFixed(2)} s`
                      }
                    />
                    <Metric
                      label="Tokens"
                      value={
                        document.usage?.totalTokens?.toLocaleString() ?? '—'
                      }
                    />
                    <Metric
                      label="Est. cost"
                      value={
                        document.estimatedCostUsd === undefined
                          ? '—'
                          : `$${document.estimatedCostUsd.toFixed(6)}`
                      }
                    />
                  </dl>
                  <details className="mt-4" open>
                    <summary className="cursor-pointer text-sm font-medium">
                      Validated JSON result
                    </summary>
                    <pre className="mt-2 max-h-[32rem] overflow-auto rounded-xl bg-neutral-950 p-4 text-xs text-neutral-100">
                      {JSON.stringify(document.structuredResult, null, 2)}
                    </pre>
                  </details>
                </>
              )}
            </article>
          ))}
          {status === 'CanLoadMore' && (
            <button
              className="rounded-lg border bg-white px-4 py-2 text-sm dark:bg-neutral-950"
              onClick={() => loadMore(20)}
            >
              Load more
            </button>
          )}
        </section>
      </div>
    </section>
  )
}

function Status({ value, stage }: { value: string; stage: string }) {
  const color =
    value === 'completed'
      ? 'bg-emerald-100 text-emerald-800'
      : value === 'failed'
        ? 'bg-red-100 text-red-800'
        : value === 'needs_review'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-blue-100 text-blue-800'
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${color}`}>
      {value.replace('_', ' ')} · {stage}
    </span>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="mt-1 font-medium break-words">{value}</dd>
    </div>
  )
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KiB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}
