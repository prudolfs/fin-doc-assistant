import { v } from 'convex/values'

export const retentionDaysValidator = v.union(
  v.literal(30),
  v.literal(90),
  v.literal(365),
  v.null(),
)

export const operationalEventKindValidator = v.union(
  v.literal('document_processing_failed'),
  v.literal('chat_response_failed'),
  v.literal('account_export_failed'),
)

export const operationalSeverityValidator = v.union(
  v.literal('warning'),
  v.literal('error'),
)

export const deletionPhaseValidator = v.union(
  v.literal('chartArtifacts'),
  v.literal('documentAuditEvents'),
  v.literal('documentPages'),
  v.literal('documentExtractions'),
  v.literal('documentJobs'),
  v.literal('documents'),
  v.literal('chats'),
  v.literal('dataExports'),
  v.literal('operationalEvents'),
  v.literal('accountSettings'),
  v.literal('accountUsage'),
)
