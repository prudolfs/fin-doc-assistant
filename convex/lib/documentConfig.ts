import {
  DEFAULT_AI_GATEWAY_CHAT_MODEL,
  DEFAULT_DOCUMENT_LIMITS,
} from '../../shared/constants'

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function resolveDocumentLimits(values: {
  maxAcceptedFiles?: string
  maxAcceptedFileBytes?: string
  maxPages?: string
}) {
  return {
    maxAcceptedFiles: positiveInteger(
      values.maxAcceptedFiles,
      DEFAULT_DOCUMENT_LIMITS.maxAcceptedFiles,
    ),
    maxAcceptedFileBytes: positiveInteger(
      values.maxAcceptedFileBytes,
      DEFAULT_DOCUMENT_LIMITS.maxAcceptedFileBytes,
    ),
    maxPages: positiveInteger(
      values.maxPages,
      DEFAULT_DOCUMENT_LIMITS.maxPages,
    ),
  }
}

export function resolveChatModel(value: string | undefined) {
  return value?.trim() || DEFAULT_AI_GATEWAY_CHAT_MODEL
}
