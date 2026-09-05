/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import {
  DOCUMENT_PROMPT_VERSION,
  DOCUMENT_SCHEMA_VERSION,
} from '../../shared/constants'
import { validateDocumentExtraction } from '../../shared/documentValidation'
import { mergeConfirmedDocumentFields } from '../../shared/documentReview'
import { financeDocumentExtractionSchema } from '../../shared/financeSchemas'
import { internalMutation, internalQuery } from '../_generated/server'
import {
  financeDocumentExtractionValidator,
  usageValidator,
} from '../documentValidators'
import schema from '../schema'

export const getForProcessing = internalQuery({
  args: {
    documentId: v.id('documents'),
    jobId: v.id('documentJobs'),
  },
  returns: v.union(
    v.null(),
    v.object({
      document: schema.doc('documents'),
      job: schema.doc('documentJobs'),
    }),
  ),
  handler: async (ctx, args) => {
    const [document, job] = await Promise.all([
      ctx.db.get('documents', args.documentId),
      ctx.db.get('documentJobs', args.jobId),
    ])
    if (!document || !job || job.documentId !== document._id) return null
    return { document, job }
  },
})

export const markProcessing = internalMutation({
  args: {
    documentId: v.id('documents'),
    jobId: v.id('documentJobs'),
    stage: v.union(
      v.literal('downloading'),
      v.literal('extracting'),
      v.literal('validating'),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const job = await ctx.db.get('documentJobs', args.jobId)
    if (!job || job.documentId !== args.documentId) {
      throw new Error('Document job was not found')
    }
    await ctx.db.patch(args.documentId, {
      status: 'processing',
      processingStage: args.stage,
      updatedAt: now,
    })
    await ctx.db.patch(args.jobId, {
      status: 'processing',
      stage: args.stage,
      ...(job.startedAt === undefined ? { startedAt: now } : {}),
      updatedAt: now,
    })
    if (args.stage === 'downloading' && job.status === 'queued') {
      await ctx.db.insert('documentAuditEvents', {
        ownerTokenIdentifier: job.ownerTokenIdentifier,
        documentId: args.documentId,
        action: 'processing_started',
        attempt: job.attempt,
        createdAt: now,
      })
    }
    return null
  },
})

export const complete = internalMutation({
  args: {
    documentId: v.id('documents'),
    jobId: v.id('documentJobs'),
    extraction: financeDocumentExtractionValidator,
    pageCount: v.number(),
    validationErrors: v.array(v.string()),
    model: v.string(),
    usage: usageValidator,
    latencyMs: v.number(),
    estimatedCostUsd: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const [document, job] = await Promise.all([
      ctx.db.get('documents', args.documentId),
      ctx.db.get('documentJobs', args.jobId),
    ])
    if (!document || !job || job.documentId !== document._id) {
      throw new Error('Document job was not found')
    }
    const generated = financeDocumentExtractionSchema.parse(args.extraction)
    const existing = document.structuredResult
      ? financeDocumentExtractionSchema.parse(document.structuredResult)
      : null
    const normalized =
      existing && document.confirmedFields?.length
        ? mergeConfirmedDocumentFields(
            generated,
            existing,
            document.confirmedFields,
          )
        : generated
    const validationErrors = validateDocumentExtraction(
      normalized,
      args.pageCount,
    )
    const status = validationErrors.length > 0 ? 'needs_review' : 'completed'
    await ctx.db.insert('documentExtractions', {
      ownerTokenIdentifier: document.ownerTokenIdentifier,
      documentId: args.documentId,
      attempt: job.attempt,
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      promptVersion: DOCUMENT_PROMPT_VERSION,
      model: args.model,
      rawStructuredOutput: generated,
      normalizedOutput: normalized,
      warnings: normalized.warnings,
      validationErrors,
      usage: args.usage,
      latencyMs: args.latencyMs,
      ...(args.estimatedCostUsd === undefined
        ? {}
        : { estimatedCostUsd: args.estimatedCostUsd }),
      createdAt: now,
    })
    await ctx.db.patch(args.documentId, {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      documentType: normalized.documentType,
      status,
      processingStage: 'completed',
      pageCount: args.pageCount,
      ...(normalized.merchantOrSupplierName
        ? { merchantOrSupplierName: normalized.merchantOrSupplierName }
        : {}),
      ...(normalized.documentNumber
        ? { documentNumber: normalized.documentNumber }
        : {}),
      ...(normalized.issueDate.iso
        ? { issueDate: normalized.issueDate.iso }
        : {}),
      ...(normalized.dueDate.iso ? { dueDate: normalized.dueDate.iso } : {}),
      ...(normalized.currency ? { currency: normalized.currency } : {}),
      ...(normalized.subtotalMinor === null
        ? {}
        : { subtotalMinor: normalized.subtotalMinor }),
      ...(normalized.taxMinor === null
        ? {}
        : { taxMinor: normalized.taxMinor }),
      ...(normalized.totalMinor === null
        ? {}
        : { totalMinor: normalized.totalMinor }),
      structuredResult: normalized,
      validationErrors,
      model: args.model,
      usage: args.usage,
      latencyMs: args.latencyMs,
      ...(args.estimatedCostUsd === undefined
        ? {}
        : { estimatedCostUsd: args.estimatedCostUsd }),
      needsReview: status === 'needs_review',
      updatedAt: now,
    })
    await ctx.db.patch(args.jobId, {
      status,
      stage: 'completed',
      completedAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('documentAuditEvents', {
      ownerTokenIdentifier: document.ownerTokenIdentifier,
      documentId: args.documentId,
      action: 'processing_completed',
      attempt: job.attempt,
      detail: status,
      createdAt: now,
    })
    return null
  },
})

export const fail = internalMutation({
  args: {
    documentId: v.id('documents'),
    jobId: v.id('documentJobs'),
    errorCode: v.string(),
    safeErrorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const document = await ctx.db.get('documents', args.documentId)
    const job = await ctx.db.get('documentJobs', args.jobId)
    if (!document || !job || job.documentId !== document._id) {
      throw new Error('Document job was not found')
    }
    await ctx.db.patch(args.documentId, {
      status: 'failed',
      processingStage: 'failed',
      needsReview: true,
      safeErrorMessage: args.safeErrorMessage,
      updatedAt: now,
    })
    await ctx.db.insert('documentAuditEvents', {
      ownerTokenIdentifier: document.ownerTokenIdentifier,
      documentId: args.documentId,
      action: 'processing_failed',
      attempt: job.attempt,
      detail: args.errorCode,
      createdAt: now,
    })
    await ctx.db.patch(args.jobId, {
      status: 'failed',
      stage: 'failed',
      errorCode: args.errorCode,
      safeErrorMessage: args.safeErrorMessage,
      completedAt: now,
      updatedAt: now,
    })
    return null
  },
})
