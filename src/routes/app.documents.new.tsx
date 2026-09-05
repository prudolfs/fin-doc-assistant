/* oxlint-disable no-underscore-dangle */

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { FileCheck2, FileUp, LoaderCircle, UploadCloud, X } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  acceptedDocumentMimeTypes,
  formatBytes,
  uploadToConvex,
  validateDocumentFile,
} from '../lib/document-files'
import type { AcceptedDocumentMimeType } from '../lib/document-files'
import type { ChangeEvent, DragEvent } from 'react'

export const Route = createFileRoute('/app/documents/new')({
  component: NewDocumentRoute,
})

type UploadState = 'ready' | 'uploading' | 'uploaded' | 'queued' | 'failed'

type UploadItem = {
  key: string
  file: File
  state: UploadState
  progress: number
  error?: string
  documentId?: Id<'documents'>
}

function NewDocumentRoute() {
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const configuration = useQuery(api.documents.getUploadConfiguration)
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl)
  const registerDocument = useMutation(api.documents.registerDocument)
  const [items, setItems] = useState<Array<UploadItem>>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxFiles = configuration?.maxAcceptedFiles ?? 5
  const maxBytes = configuration?.maxAcceptedFileBytes ?? 10 * 1024 * 1024

  function selectFiles(selected: Array<File>) {
    setError(null)
    if (selected.length > maxFiles) {
      setError(`Choose at most ${maxFiles} files at a time.`)
      return
    }
    setItems(
      selected.map((file) => {
        const validationError = validateDocumentFile(
          file,
          maxBytes,
          configuration?.acceptedMimeTypes,
        )
        return {
          key: crypto.randomUUID(),
          file,
          state: validationError ? 'failed' : 'ready',
          progress: 0,
          error: validationError ?? undefined,
        }
      }),
    )
  }

  function updateItem(key: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    )
  }

  async function processItem(item: UploadItem) {
    updateItem(item.key, { state: 'uploading', progress: 0, error: undefined })
    try {
      const uploadUrl = await generateUploadUrl({})
      const storageId = await uploadToConvex(uploadUrl, item.file, (progress) =>
        updateItem(item.key, { progress }),
      )
      updateItem(item.key, { state: 'uploaded', progress: 100 })
      const documentId = await registerDocument({
        storageId,
        originalFilename: item.file.name,
        mimeType: item.file.type as AcceptedDocumentMimeType,
      })
      updateItem(item.key, { state: 'queued', documentId })
      return documentId
    } catch (cause) {
      updateItem(item.key, {
        state: 'failed',
        error: cause instanceof Error ? cause.message : 'Upload failed.',
      })
      return null
    }
  }

  async function upload() {
    const ready = items.filter((item) => item.state === 'ready')
    if (ready.length === 0) return
    setUploading(true)
    const documentIds = await Promise.all(ready.map(processItem))
    setUploading(false)
    const completedIds = documentIds.filter(
      (id): id is Id<'documents'> => id !== null,
    )
    if (ready.length === 1 && completedIds[0]) {
      await navigate({
        to: '/app/documents/$documentId',
        params: { documentId: completedIds[0] },
      })
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    selectFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (!uploading) selectFiles(Array.from(event.dataTransfer.files))
  }

  const readyCount = items.filter((item) => item.state === 'ready').length

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-7">
        <header>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            New finance document
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            Upload receipts and invoices
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            We’ll extract the key fields, totals, and line items. Processing
            continues in the background and updates live.
          </p>
        </header>

        <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6 dark:bg-neutral-950">
          <div
            className={`flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-neutral-300 bg-neutral-50/70 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/60'}`}
            onDragEnter={(event) => {
              event.preventDefault()
              if (!uploading) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <UploadCloud className="size-7" />
            </span>
            <h3 className="mt-5 text-lg font-semibold">
              Drop finance documents here
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              or choose from your device
            </p>
            <button
              className="mt-5 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-950"
              disabled={uploading || !configuration}
              onClick={() => inputRef.current?.click()}
            >
              Choose files
            </button>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              multiple
              accept={acceptedDocumentMimeTypes.join(',')}
              disabled={uploading}
              onChange={handleInput}
            />
            <p className="mt-4 text-xs text-neutral-500">
              PDF, JPEG, PNG, or WebP · up to {maxFiles} files ·{' '}
              {formatBytes(maxBytes)} each · PDFs up to{' '}
              {configuration?.maxPages ?? 50} pages
            </p>
          </div>

          {error && (
            <p
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}

          {items.length > 0 && (
            <div className="mt-5 space-y-3" aria-live="polite">
              {items.map((item) => (
                <UploadRow
                  key={item.key}
                  item={item}
                  disabled={uploading}
                  onRemove={() =>
                    setItems((current) =>
                      current.filter((candidate) => candidate.key !== item.key),
                    )
                  }
                />
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-neutral-500">
                  Files upload directly to private Convex storage.
                </p>
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uploading || readyCount === 0}
                  onClick={upload}
                >
                  {uploading ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <FileUp className="size-4" />
                  )}
                  {uploading
                    ? 'Uploading…'
                    : `Upload ${readyCount || ''} ${readyCount === 1 ? 'document' : 'documents'}`}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function UploadRow({
  item,
  disabled,
  onRemove,
}: {
  item: UploadItem
  disabled: boolean
  onRemove: () => void
}) {
  const label =
    item.state === 'ready'
      ? 'Ready'
      : item.state === 'uploading'
        ? `Uploading ${item.progress}%`
        : item.state === 'uploaded'
          ? 'Registering…'
          : item.state === 'queued'
            ? 'Queued for extraction'
            : 'Needs attention'

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-neutral-100 p-2 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          {item.state === 'queued' ? (
            <FileCheck2 className="size-5 text-emerald-600" />
          ) : (
            <FileUp className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.file.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {formatBytes(item.file.size)} · {label}
          </p>
          {item.error && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
              {item.error}
            </p>
          )}
          {item.state === 'uploading' && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          )}
        </div>
        {(item.state === 'ready' || item.state === 'failed') && (
          <button
            aria-label={`Remove ${item.file.name}`}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40 dark:hover:bg-neutral-800"
            disabled={disabled}
            onClick={onRemove}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
