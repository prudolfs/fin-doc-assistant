/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import {
  DOCUMENT_PROMPT_VERSION,
  DOCUMENT_SCHEMA_VERSION,
} from '../../shared/constants'
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
    const status =
      args.validationErrors.length > 0 ? 'needs_review' : 'completed'
    await ctx.db.insert('documentExtractions', {
      ownerTokenIdentifier: document.ownerTokenIdentifier,
      documentId: args.documentId,
      attempt: job.attempt,
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      promptVersion: DOCUMENT_PROMPT_VERSION,
      model: args.model,
      rawStructuredOutput: args.extraction,
      normalizedOutput: args.extraction,
      warnings: args.extraction.warnings,
      validationErrors: args.validationErrors,
      usage: args.usage,
      latencyMs: args.latencyMs,
      ...(args.estimatedCostUsd === undefined
        ? {}
        : { estimatedCostUsd: args.estimatedCostUsd }),
      createdAt: now,
    })
    await ctx.db.patch(args.documentId, {
      documentType: args.extraction.documentType,
      status,
      processingStage: 'completed',
      pageCount: args.pageCount,
      ...(args.extraction.merchantOrSupplierName
        ? { merchantOrSupplierName: args.extraction.merchantOrSupplierName }
        : {}),
      ...(args.extraction.documentNumber
        ? { documentNumber: args.extraction.documentNumber }
        : {}),
      ...(args.extraction.issueDate.iso
        ? { issueDate: args.extraction.issueDate.iso }
        : {}),
      ...(args.extraction.dueDate.iso
        ? { dueDate: args.extraction.dueDate.iso }
        : {}),
      ...(args.extraction.currency
        ? { currency: args.extraction.currency }
        : {}),
      ...(args.extraction.subtotalMinor === null
        ? {}
        : { subtotalMinor: args.extraction.subtotalMinor }),
      ...(args.extraction.taxMinor === null
        ? {}
        : { taxMinor: args.extraction.taxMinor }),
      ...(args.extraction.totalMinor === null
        ? {}
        : { totalMinor: args.extraction.totalMinor }),
      structuredResult: args.extraction,
      validationErrors: args.validationErrors,
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
    await ctx.db.patch(args.documentId, {
      status: 'failed',
      processingStage: 'failed',
      needsReview: true,
      safeErrorMessage: args.safeErrorMessage,
      updatedAt: now,
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
