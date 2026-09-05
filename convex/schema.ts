import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  acceptedMimeTypeValidator,
  documentStatusValidator,
  financeDocumentExtractionValidator,
  processingStageValidator,
  usageValidator,
} from './documentValidators'

export default defineSchema({
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
    safeErrorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_ownerTokenIdentifier_and_createdAt', [
      'ownerTokenIdentifier',
      'createdAt',
    ])
    .index('by_storageId', ['storageId']),

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
    .index('by_idempotencyKey', ['idempotencyKey']),

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
    createdAt: v.number(),
  }).index('by_documentId_and_attempt', ['documentId', 'attempt']),
})
