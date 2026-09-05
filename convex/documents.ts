/* oxlint-disable no-underscore-dangle */

import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { v } from 'convex/values'
import { DOCUMENT_SCHEMA_VERSION } from '../shared/constants'
import { internal } from './_generated/api'
import { env, mutation, query } from './_generated/server'
import { acceptedMimeTypeValidator } from './documentValidators'
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

    const [latestJob, latestExtraction] = await Promise.all([
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
    ])

    return { document, latestJob, latestExtraction }
  },
})
