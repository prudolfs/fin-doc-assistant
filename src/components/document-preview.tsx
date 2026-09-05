import { ExternalLink, FileQuestion } from 'lucide-react'

export function DocumentPreview({
  fileUrl,
  mimeType,
  filename,
}: {
  fileUrl: string | null
  mimeType: string
  filename: string
}) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-neutral-950">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h3 className="font-semibold">Original document</h3>
        {fileUrl && (
          <a
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-950 dark:hover:text-white"
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open original
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      <div className="flex min-h-[34rem] items-center justify-center bg-neutral-100 dark:bg-neutral-900">
        {!fileUrl ? (
          <div className="p-8 text-center text-neutral-500">
            <FileQuestion className="mx-auto size-9" />
            <p className="mt-3 text-sm">The stored file is unavailable.</p>
          </div>
        ) : mimeType === 'application/pdf' ? (
          <iframe
            className="h-[70vh] min-h-[34rem] w-full bg-white"
            src={fileUrl}
            title={`Preview of ${filename}`}
          />
        ) : (
          <img
            className="max-h-[75vh] w-full object-contain"
            src={fileUrl}
            alt={`Preview of ${filename}`}
          />
        )}
      </div>
    </section>
  )
}
