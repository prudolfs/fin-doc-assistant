/* oxlint-disable no-underscore-dangle */

import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { v } from 'convex/values'
import { DOCUMENT_SCHEMA_VERSION } from '../shared/constants'
import { validateDocumentExtraction } from '../shared/documentValidation'
import {
  changedDocumentFields,
  editableDocumentFields,
} from '../shared/documentReview'
import { financeDocumentExtractionSchema } from '../shared/financeSchemas'
import { internal } from './_generated/api'
import { env, mutation, query } from './_generated/server'
import {
  acceptedMimeTypeValidator,
  financeDocumentExtractionValidator,
} from './documentValidators'
import { resolveDocumentLimits } from './lib/documentConfig'
import schema from './schema'
import type { MutationCtx, QueryCtx } from './_generated/server'

const allowedExtensions = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
} as const

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Authentication required')
  return identity
}

function limits() {
  return resolveDocumentLimits({
    maxAcceptedFiles: env.DOCUMENT_MAX_ACCEPTED_FILES,
    maxAcceptedFileBytes: env.DOCUMENT_MAX_ACCEPTED_FILE_BYTES,
    maxPages: env.DOCUMENT_MAX_PAGES,
  })
}

export const getUploadConfiguration = query({
  args: {},
  returns: v.object({
    maxAcceptedFiles: v.number(),
    maxAcceptedFileBytes: v.number(),
    maxPages: v.number(),
    acceptedMimeTypes: v.array(v.string()),
  }),
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return {
      ...limits(),
      acceptedMimeTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
      ],
    }
  },
})

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const registerDocument = mutation({
  args: {
    storageId: v.id('_storage'),
    originalFilename: v.string(),
    mimeType: acceptedMimeTypeValidator,
  },
  returns: v.id('documents'),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const filename = args.originalFilename.trim()
    if (!filename || filename.length > 240) {
      throw new Error('Filename must contain between 1 and 240 characters')
    }

    const lowercaseFilename = filename.toLowerCase()
    if (
      !allowedExtensions[args.mimeType].some((ext) =>
        lowercaseFilename.endsWith(ext),
      )
    ) {
      throw new Error(
        'Filename extension does not match the selected file type',
      )
    }

    const metadata = await ctx.db.system.get('_storage', args.storageId)
    if (!metadata) throw new Error('Uploaded file was not found')
    if (metadata.size > limits().maxAcceptedFileBytes) {
      throw new Error('Uploaded file exceeds the configured size limit')
    }
    if (metadata.contentType && metadata.contentType !== args.mimeType) {
      throw new Error('Uploaded file content type does not match its metadata')
    }

    const existing = await ctx.db
      .query('documents')
      .withIndex('by_storageId', (q) => q.eq('storageId', args.storageId))
      .unique()
    if (existing) {
      if (existing.ownerTokenIdentifier !== identity.tokenIdentifier) {
        throw new Error('Uploaded file is already registered')
      }
      return existing._id
    }

    const duplicate = await ctx.db
      .query('documents')
      .withIndex('by_ownerTokenIdentifier_and_sha256_and_schemaVersion', (q) =>
        q
          .eq('ownerTokenIdentifier', identity.tokenIdentifier)
          .eq('sha256', metadata.sha256)
          .eq('schemaVersion', DOCUMENT_SCHEMA_VERSION),
      )
      .first()
    if (duplicate) {
      await ctx.storage.delete(args.storageId)
      await ctx.db.insert('documentAuditEvents', {
        ownerTokenIdentifier: identity.tokenIdentifier,
        documentId: duplicate._id,
        action: 'duplicate_detected',
        detail: filename,
        createdAt: Date.now(),
      })
      return duplicate._id
    }

    const now = Date.now()
    const documentId = await ctx.db.insert('documents', {
      ownerTokenIdentifier: identity.tokenIdentifier,
      storageId: args.storageId,
      originalFilename: filename,
      mimeType: args.mimeType,
      byteSize: metadata.size,
      sha256: metadata.sha256,
      status: 'queued',
      processingStage: 'queued',
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      validationErrors: [],
      needsReview: false,
      createdAt: now,
      updatedAt: now,
    })
    const jobId = await ctx.db.insert('documentJobs', {
      ownerTokenIdentifier: identity.tokenIdentifier,
      documentId,
      status: 'queued',
      stage: 'queued',
      attempt: 1,
      idempotencyKey: `${args.storageId}:${DOCUMENT_SCHEMA_VERSION}`,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('documentAuditEvents', {
      ownerTokenIdentifier: identity.tokenIdentifier,
      documentId,
      action: 'uploaded',
      attempt: 1,
      createdAt: now,
    })

    await ctx.scheduler.runAfter(
      0,
      internal.documentProcessing.processDocument,
      {
        documentId,
        jobId,
      },
    )
    return documentId
  },
})

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc('documents')),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    return await ctx.db
      .query('documents')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', identity.tokenIdentifier),
      )
      .order('desc')
      .paginate(args.paginationOpts)
  },
})

export const get = query({
  args: { documentId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      document: schema.doc('documents'),
      latestJob: v.union(v.null(), schema.doc('documentJobs')),
      latestExtraction: v.union(v.null(), schema.doc('documentExtractions')),
      fileUrl: v.union(v.null(), v.string()),
      auditEvents: v.array(schema.doc('documentAuditEvents')),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const documentId = ctx.db.normalizeId('documents', args.documentId)
    if (!documentId) return null
    const document = await ctx.db.get('documents', documentId)
    if (
      !document ||
      document.ownerTokenIdentifier !== identity.tokenIdentifier
    ) {
      return null
    }

    const [latestJob, latestExtraction, fileUrl, auditEvents] =
      await Promise.all([
        ctx.db
          .query('documentJobs')
          .withIndex('by_documentId', (q) => q.eq('documentId', documentId))
          .order('desc')
          .first(),
        ctx.db
          .query('documentExtractions')
          .withIndex('by_documentId_and_attempt', (q) =>
            q.eq('documentId', documentId),
          )
          .order('desc')
          .first(),
        ctx.storage.getUrl(document.storageId),
        ctx.db
          .query('documentAuditEvents')
          .withIndex('by_documentId', (q) => q.eq('documentId', documentId))
          .order('desc')
          .take(20),
      ])

    return { document, latestJob, latestExtraction, fileUrl, auditEvents }
  },
})

export const saveReview = mutation({
  args: {
    documentId: v.id('documents'),
    extraction: financeDocumentExtractionValidator,
    approve: v.boolean(),
  },
  returns: v.object({
    status: v.union(v.literal('completed'), v.literal('needs_review')),
    validationErrors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const document = await ctx.db.get('documents', args.documentId)
    if (
      !document ||
      document.ownerTokenIdentifier !== identity.tokenIdentifier
    ) {
      throw new Error('Document was not found')
    }
    if (!document.structuredResult) {
      throw new Error('The document has no extraction to review')
    }

    const previous = financeDocumentExtractionSchema.parse(
      document.structuredResult,
    )
    const reviewed = financeDocumentExtractionSchema.parse(args.extraction)
    const changedFields = changedDocumentFields(previous, reviewed)
    const confirmedFields = args.approve
      ? [...editableDocumentFields]
      : Array.from(
          new Set([...(document.confirmedFields ?? []), ...changedFields]),
        )
    const finalized = {
      ...reviewed,
      evidence: reviewed.evidence.filter(
        (item) => !changedFields.some((field) => field === item.field),
      ),
    }
    const validationErrors = validateDocumentExtraction(
      finalized,
      document.pageCount ?? 1,
    )
    if (args.approve && validationErrors.length > 0) {
      throw new Error('Resolve the validation warnings before approving')
    }

    const now = Date.now()
    const status: 'completed' | 'needs_review' = args.approve
      ? 'completed'
      : 'needs_review'
    await ctx.db.patch(args.documentId, {
      documentType: finalized.documentType,
      merchantOrSupplierName: finalized.merchantOrSupplierName ?? undefined,
      documentNumber: finalized.documentNumber ?? undefined,
      issueDate: finalized.issueDate.iso ?? undefined,
      dueDate: finalized.dueDate.iso ?? undefined,
      currency: finalized.currency ?? undefined,
      subtotalMinor: finalized.subtotalMinor ?? undefined,
      taxMinor: finalized.taxMinor ?? undefined,
      totalMinor: finalized.totalMinor ?? undefined,
      structuredResult: finalized,
      validationErrors,
      confirmedFields,
      lastReviewedAt: now,
      status,
      processingStage: 'completed',
      needsReview: !args.approve,
      updatedAt: now,
    })
    await ctx.db.insert('documentAuditEvents', {
      ownerTokenIdentifier: identity.tokenIdentifier,
      documentId: args.documentId,
      action: args.approve ? 'approved' : 'review_saved',
      changedFields,
      createdAt: now,
    })
    return { status, validationErrors }
  },
})

export const retry = mutation({
  args: { documentId: v.id('documents') },
  returns: v.id('documentJobs'),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const document = await ctx.db.get('documents', args.documentId)
    if (
      !document ||
      document.ownerTokenIdentifier !== identity.tokenIdentifier
    ) {
      throw new Error('Document was not found')
    }
    if (document.status !== 'failed' && document.status !== 'needs_review') {
      throw new Error('Only failed or review-required documents can be retried')
    }
    const latestJob = await ctx.db
      .query('documentJobs')
      .withIndex('by_documentId', (q) => q.eq('documentId', args.documentId))
      .order('desc')
      .first()
    const attempt = (latestJob?.attempt ?? 0) + 1
    if (attempt > 3) {
      throw new Error('This document has reached the three-attempt retry limit')
    }

    const now = Date.now()
    const jobId = await ctx.db.insert('documentJobs', {
      ownerTokenIdentifier: identity.tokenIdentifier,
      documentId: args.documentId,
      status: 'queued',
      stage: 'queued',
      attempt,
      idempotencyKey: `${document.storageId}:${DOCUMENT_SCHEMA_VERSION}:${attempt}`,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(args.documentId, {
      status: 'queued',
      processingStage: 'queued',
      safeErrorMessage: undefined,
      needsReview: false,
      updatedAt: now,
    })
    await ctx.db.insert('documentAuditEvents', {
      ownerTokenIdentifier: identity.tokenIdentifier,
      documentId: args.documentId,
      action: 'retry_queued',
      attempt,
      createdAt: now,
    })
    await ctx.scheduler.runAfter(
      0,
      internal.documentProcessing.processDocument,
      { documentId: args.documentId, jobId },
    )
    return jobId
  },
})

export const remove = mutation({
  args: { documentId: v.id('documents') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const document = await ctx.db.get('documents', args.documentId)
    if (
      !document ||
      document.ownerTokenIdentifier !== identity.tokenIdentifier
    ) {
      throw new Error('Document was not found')
    }
    if (document.status === 'processing') {
      throw new Error('Wait for processing to finish before deleting')
    }

    const [jobs, extractions, pages] = await Promise.all([
      ctx.db
        .query('documentJobs')
        .withIndex('by_documentId', (q) => q.eq('documentId', args.documentId))
        .take(10),
      ctx.db
        .query('documentExtractions')
        .withIndex('by_documentId_and_attempt', (q) =>
          q.eq('documentId', args.documentId),
        )
        .take(10),
      ctx.db
        .query('documentPages')
        .withIndex('by_documentId_and_pageNumber', (q) =>
          q.eq('documentId', args.documentId),
        )
        .take(51),
    ])
    const now = Date.now()
    await ctx.db.insert('documentAuditEvents', {
      ownerTokenIdentifier: identity.tokenIdentifier,
      documentId: args.documentId,
      action: 'deleted',
      detail: document.originalFilename,
      createdAt: now,
    })
    for (const job of jobs) await ctx.db.delete('documentJobs', job._id)
    for (const extraction of extractions) {
      await ctx.db.delete('documentExtractions', extraction._id)
    }
    for (const page of pages) await ctx.db.delete('documentPages', page._id)
    await ctx.storage.delete(document.storageId)
    await ctx.db.delete('documents', args.documentId)
    return null
  },
})
