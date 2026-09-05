import type { Id } from '../../convex/_generated/dataModel'

export const acceptedDocumentMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type AcceptedDocumentMimeType =
  (typeof acceptedDocumentMimeTypes)[number]

export function validateDocumentFile(
  file: Pick<File, 'name' | 'size' | 'type'>,
  maxBytes: number,
  serverAcceptedTypes: ReadonlyArray<string> = acceptedDocumentMimeTypes,
): string | null {
  if (
    !acceptedDocumentMimeTypes.includes(
      file.type as AcceptedDocumentMimeType,
    ) ||
    !serverAcceptedTypes.includes(file.type)
  ) {
    return `${file.name} is not a supported PDF, JPEG, PNG, or WebP file.`
  }
  if (file.size > maxBytes) {
    return `${file.name} exceeds the ${formatBytes(maxBytes)} limit.`
  }
  return null
}

export function uploadToConvex(
  uploadUrl: string,
  file: File,
  onProgress: (percentage: number) => void,
): Promise<Id<'_storage'>> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', uploadUrl)
    request.setRequestHeader('Content-Type', file.type)
    request.responseType = 'json'
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })
    request.addEventListener('load', () => {
      const payload: unknown = request.response
      if (
        request.status < 200 ||
        request.status >= 300 ||
        !payload ||
        typeof payload !== 'object' ||
        !('storageId' in payload) ||
        typeof payload.storageId !== 'string'
      ) {
        reject(new Error(`Upload failed for ${file.name}.`))
        return
      }
      onProgress(100)
      resolve(payload.storageId as Id<'_storage'>)
    })
    request.addEventListener('error', () => {
      reject(new Error(`Network error while uploading ${file.name}.`))
    })
    request.addEventListener('abort', () => {
      reject(new Error(`Upload cancelled for ${file.name}.`))
    })
    request.send(file)
  })
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

export function formatMoney(minor: number | undefined, currency?: string) {
  if (minor === undefined) return '—'
  if (!currency) return (minor / 100).toFixed(2)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(minor / 100)
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`
  }
}
