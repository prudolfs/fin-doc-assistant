import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  acceptedMimeTypeValidator,
  documentStatusValidator,
  financeDocumentExtractionValidator,
  documentAuditActionValidator,
  editableDocumentFieldValidator,
  pageExtractionSourceValidator,
  processingStageValidator,
  processingStrategyValidator,
  usageValidator,
} from './documentValidators'
import { chartSpecValidator } from './chartValidators'
import {
  deletionPhaseValidator,
  operationalEventKindValidator,
  operationalSeverityValidator,
  retentionDaysValidator,
} from './accountValidators'

export default defineSchema({
  chats: defineTable({
    ownerTokenIdentifier: v.string(),
    threadId: v.string(),
    title: v.string(),
    status: v.union(
      v.literal('idle'),
      v.literal('responding'),
      v.literal('failed'),
    ),
    safeErrorMessage: v.optional(v.string()),
    lastMessageAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_ownerTokenIdentifier_and_lastMessageAt', [
      'ownerTokenIdentifier',
      'lastMessageAt',
    ])
    .index('by_threadId', ['threadId']),

  chartArtifacts: defineTable({
    ownerTokenIdentifier: v.string(),
    chatId: v.id('chats'),
    messageId: v.string(),
    artifactKey: v.string(),
    spec: chartSpecValidator,
    createdAt: v.number(),
  })
    .index('by_chatId_and_createdAt', ['chatId', 'createdAt'])
    .index('by_artifactKey', ['artifactKey'])
    .index('by_ownerTokenIdentifier_and_createdAt', [
      'ownerTokenIdentifier',
      'createdAt',
    ]),

  documents: defineTable({
    ownerTokenIdentifier: v.string(),
    storageId: v.id('_storage'),
    originalFilename: v.string(),
    mimeType: acceptedMimeTypeValidator,
    byteSize: v.number(),
    sha256: v.string(),
    documentType: v.optional(
      v.union(v.literal('receipt'), v.literal('invoice')),
    ),
    status: documentStatusValidator,
    processingStage: processingStageValidator,
    schemaVersion: v.number(),
    pageCount: v.optional(v.number()),
    merchantOrSupplierName: v.optional(v.string()),
    documentNumber: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    currency: v.optional(v.string()),
    subtotalMinor: v.optional(v.number()),
    taxMinor: v.optional(v.number()),
    totalMinor: v.optional(v.number()),
    structuredResult: v.optional(financeDocumentExtractionValidator),
    validationErrors: v.array(v.string()),
    model: v.optional(v.string()),
    usage: v.optional(usageValidator),
    latencyMs: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    needsReview: v.boolean(),
    confirmedFields: v.optional(v.array(editableDocumentFieldValidator)),
    lastReviewedAt: v.optional(v.number()),
    safeErrorMessage: v.optional(v.string()),
    processingStrategy: v.optional(processingStrategyValidator),
    multipleDocumentsDetected: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_ownerTokenIdentifier_and_createdAt', [
      'ownerTokenIdentifier',
      'createdAt',
    ])
    .index('by_ownerTokenIdentifier_and_status', [
      'ownerTokenIdentifier',
      'status',
    ])
    .index('by_storageId', ['storageId'])
    .index('by_ownerTokenIdentifier_and_sha256_and_schemaVersion', [
      'ownerTokenIdentifier',
      'sha256',
      'schemaVersion',
    ]),

  documentJobs: defineTable({
    ownerTokenIdentifier: v.string(),
    documentId: v.id('documents'),
    status: documentStatusValidator,
    stage: processingStageValidator,
    attempt: v.number(),
    idempotencyKey: v.string(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    safeErrorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_documentId', ['documentId'])
    .index('by_idempotencyKey', ['idempotencyKey'])
    .index('by_ownerTokenIdentifier_and_createdAt', [
      'ownerTokenIdentifier',
      'createdAt',
    ]),

  documentExtractions: defineTable({
    ownerTokenIdentifier: v.string(),
    documentId: v.id('documents'),
    attempt: v.number(),
    schemaVersion: v.number(),
    promptVersion: v.string(),
    model: v.string(),
    rawStructuredOutput: financeDocumentExtractionValidator,
    normalizedOutput: financeDocumentExtractionValidator,
    warnings: v.array(v.string()),
    validationErrors: v.array(v.string()),
    usage: usageValidator,
    latencyMs: v.number(),
    estimatedCostUsd: v.optional(v.number()),
    processingStrategy: v.optional(processingStrategyValidator),
    multipleDocumentsDetected: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index('by_documentId_and_attempt', ['documentId', 'attempt'])
    .index('by_ownerTokenIdentifier_and_createdAt', [
      'ownerTokenIdentifier',
      'createdAt',
    ]),

  documentPages: defineTable({
    ownerTokenIdentifier: v.string(),
    documentId: v.id('documents'),
    pageNumber: v.number(),
    extractionSource: pageExtractionSourceValidator,
    text: v.optional(v.string()),
    ocrConfidence: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_documentId_and_pageNumber', ['documentId', 'pageNumber'])
    .index('by_ownerTokenIdentifier_and_createdAt', [
      'ownerTokenIdentifier',
      'createdAt',
    ]),

  documentAuditEvents: defineTable({
    ownerTokenIdentifier: v.string(),
    documentId: v.id('documents'),
    action: documentAuditActionValidator,
    attempt: v.optional(v.number()),
    changedFields: v.optional(v.array(editableDocumentFieldValidator)),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_documentId', ['documentId'])
    .index('by_ownerTokenIdentifier_and_createdAt', [
      'ownerTokenIdentifier',
      'createdAt',
    ]),

  accountSettings: defineTable({
    ownerTokenIdentifier: v.string(),
    retentionDays: retentionDaysValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_ownerTokenIdentifier', ['ownerTokenIdentifier']),

  accountUsage: defineTable({
    ownerTokenIdentifier: v.string(),
    documentCount: v.number(),
    chatCount: v.number(),
    storageBytes: v.number(),
    updatedAt: v.number(),
  }).index('by_ownerTokenIdentifier', ['ownerTokenIdentifier']),

  dataExports: defineTable({
    ownerTokenIdentifier: v.string(),
    storageId: v.id('_storage'),
    byteSize: v.number(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_ownerTokenIdentifier_and_createdAt', [
      'ownerTokenIdentifier',
      'createdAt',
    ])
    .index('by_expiresAt', ['expiresAt']),

  operationalEvents: defineTable({
    ownerTokenIdentifier: v.optional(v.string()),
    kind: operationalEventKindValidator,
    severity: operationalSeverityValidator,
    resourceId: v.optional(v.string()),
    safeMessage: v.string(),
    createdAt: v.number(),
  })
    .index('by_kind_and_createdAt', ['kind', 'createdAt'])
    .index('by_ownerTokenIdentifier_and_createdAt', [
      'ownerTokenIdentifier',
      'createdAt',
    ]),

  systemAlerts: defineTable({
    key: v.string(),
    kind: operationalEventKindValidator,
    status: v.union(v.literal('active'), v.literal('resolved')),
    eventCount: v.number(),
    windowStartedAt: v.number(),
    openedAt: v.number(),
    lastSeenAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index('by_key', ['key']),

  accountDeletionJobs: defineTable({
    ownerTokenIdentifier: v.string(),
    phase: deletionPhaseValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_ownerTokenIdentifier', ['ownerTokenIdentifier']),
})
