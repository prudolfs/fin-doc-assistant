export const DEFAULT_ACCOUNT_QUOTAS = {
  maxDocuments: 100,
  maxChats: 200,
  maxStorageBytes: 100 * 1024 * 1024,
} as const

export const DEFAULT_DATA_RETENTION_DAYS = 365
export const DEFAULT_EXPORT_RETENTION_HOURS = 24
export const DEFAULT_ALERT_FAILURE_THRESHOLD = 5

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function resolveAccountQuotas(values: {
  maxDocuments?: string
  maxChats?: string
  maxStorageBytes?: string
}) {
  return {
    maxDocuments: positiveInteger(
      values.maxDocuments,
      DEFAULT_ACCOUNT_QUOTAS.maxDocuments,
    ),
    maxChats: positiveInteger(values.maxChats, DEFAULT_ACCOUNT_QUOTAS.maxChats),
    maxStorageBytes: positiveInteger(
      values.maxStorageBytes,
      DEFAULT_ACCOUNT_QUOTAS.maxStorageBytes,
    ),
  }
}

export type RetentionDays = 30 | 90 | 365

export function resolveDefaultRetentionDays(value?: string): RetentionDays {
  const parsed = Number(value)
  return parsed === 30 || parsed === 90 || parsed === 365
    ? parsed
    : DEFAULT_DATA_RETENTION_DAYS
}

export function resolveExportRetentionHours(value?: string) {
  return positiveInteger(value, DEFAULT_EXPORT_RETENTION_HOURS)
}

export function resolveAlertFailureThreshold(value?: string) {
  return positiveInteger(value, DEFAULT_ALERT_FAILURE_THRESHOLD)
}

export function wantsZeroDataRetention(value?: string) {
  return value?.trim().toLocaleLowerCase() === 'true'
}

export function gatewayPrivacyProviderOptions(value?: string) {
  return {
    gateway: {
      disallowPromptTraining: true,
      ...(wantsZeroDataRetention(value) ? { zeroDataRetention: true } : {}),
    },
  }
}
