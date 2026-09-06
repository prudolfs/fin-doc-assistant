/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { env, internalMutation } from './_generated/server'
import { resolveDefaultRetentionDays } from '../shared/productionConfig'
import type { FunctionArgs } from 'convex/server'
import type { MutationCtx } from './_generated/server'

const sweepPhaseValidator = v.union(v.literal('documents'), v.literal('chats'))
const documentDeletionPhaseValidator = v.union(
  v.literal('audit'),
  v.literal('pages'),
  v.literal('extractions'),
  v.literal('jobs'),
  v.literal('document'),
)

async function retentionDays(ctx: MutationCtx, ownerTokenIdentifier: string) {
  const settings = await ctx.db
    .query('accountSettings')
    .withIndex('by_ownerTokenIdentifier', (q) =>
      q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
    )
    .unique()
  return (
    settings?.retentionDays ??
    resolveDefaultRetentionDays(env.DATA_RETENTION_DAYS)
  )
}

export const sweepRetention = internalMutation({
  args: {
    phase: v.optional(sweepPhaseValidator),
    cursor: v.optional(v.union(v.string(), v.null())),
    sweepStartedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const phase = args.phase ?? 'documents'
    const sweepStartedAt = args.sweepStartedAt ?? Date.now()
    if (phase === 'documents') {
      const result = await ctx.db
        .query('documents')
        .order('asc')
        .paginate({ cursor: args.cursor ?? null, numItems: 25 })
      for (const document of result.page) {
        const days = await retentionDays(ctx, document.ownerTokenIdentifier)
        const expired =
          days !== null &&
          document.createdAt < sweepStartedAt - days * 24 * 60 * 60 * 1_000
        if (
          expired &&
          document.status !== 'queued' &&
          document.status !== 'processing'
        ) {
          await ctx.scheduler.runAfter(
            0,
            internal.retention.deleteDocumentData,
            {
              documentId: document._id,
              phase: 'audit',
            },
          )
        }
      }
      await ctx.scheduler.runAfter(0, internal.retention.sweepRetention, {
        phase: result.isDone ? 'chats' : 'documents',
        cursor: result.isDone ? null : result.continueCursor,
        sweepStartedAt,
      })
      return null
    }

    const result = await ctx.db
      .query('chats')
      .order('asc')
      .paginate({ cursor: args.cursor ?? null, numItems: 25 })
    for (const chat of result.page) {
      const days = await retentionDays(ctx, chat.ownerTokenIdentifier)
      const expired =
        days !== null &&
        chat.lastMessageAt < sweepStartedAt - days * 24 * 60 * 60 * 1_000
      if (expired && chat.status !== 'responding') {
        await ctx.scheduler.runAfter(0, internal.retention.deleteChatData, {
          chatId: chat._id,
        })
      }
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.retention.sweepRetention, {
        phase: 'chats',
        cursor: result.continueCursor,
        sweepStartedAt,
      })
    }
    return null
  },
})

export const deleteDocumentData = internalMutation({
  args: {
    documentId: v.id('documents'),
    phase: documentDeletionPhaseValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document = await ctx.db.get('documents', args.documentId)
    if (!document) return null
    if (document.status === 'queued' || document.status === 'processing') {
      return null
    }

    if (args.phase === 'document') {
      await ctx.storage.delete(document.storageId)
      await ctx.db.delete(document._id)
      const usage = await ctx.db
        .query('accountUsage')
        .withIndex('by_ownerTokenIdentifier', (q) =>
          q.eq('ownerTokenIdentifier', document.ownerTokenIdentifier),
        )
        .unique()
      if (usage) {
        await ctx.db.patch(usage._id, {
          documentCount: Math.max(0, usage.documentCount - 1),
          storageBytes: Math.max(0, usage.storageBytes - document.byteSize),
          updatedAt: Date.now(),
        })
      }
      return null
    }

    const rows =
      args.phase === 'audit'
        ? await ctx.db
            .query('documentAuditEvents')
            .withIndex('by_documentId', (q) =>
              q.eq('documentId', args.documentId),
            )
            .take(25)
        : args.phase === 'pages'
          ? await ctx.db
              .query('documentPages')
              .withIndex('by_documentId_and_pageNumber', (q) =>
                q.eq('documentId', args.documentId),
              )
              .take(25)
          : args.phase === 'extractions'
            ? await ctx.db
                .query('documentExtractions')
                .withIndex('by_documentId_and_attempt', (q) =>
                  q.eq('documentId', args.documentId),
                )
                .take(25)
            : await ctx.db
                .query('documentJobs')
                .withIndex('by_documentId', (q) =>
                  q.eq('documentId', args.documentId),
                )
                .take(25)
    for (const row of rows) await ctx.db.delete(row._id)
    const phases = [
      'audit',
      'pages',
      'extractions',
      'jobs',
      'document',
    ] as const
    const nextPhase =
      rows.length === 25 ? args.phase : phases[phases.indexOf(args.phase) + 1]
    await ctx.scheduler.runAfter(0, internal.retention.deleteDocumentData, {
      documentId: args.documentId,
      phase: nextPhase,
    })
    return null
  },
})

export const deleteChatData = internalMutation({
  args: { chatId: v.id('chats') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get('chats', args.chatId)
    if (!chat || chat.status === 'responding') return null
    const artifacts = await ctx.db
      .query('chartArtifacts')
      .withIndex('by_chatId_and_createdAt', (q) => q.eq('chatId', chat._id))
      .take(25)
    for (const artifact of artifacts) await ctx.db.delete(artifact._id)
    if (artifacts.length === 25) {
      await ctx.scheduler.runAfter(0, internal.retention.deleteChatData, args)
      return null
    }
    type DeleteThreadArgs = FunctionArgs<
      typeof components.agent.threads.deleteAllForThreadIdAsync
    >
    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId: chat.threadId as DeleteThreadArgs['threadId'],
    })
    await ctx.db.delete(chat._id)
    const usage = await ctx.db
      .query('accountUsage')
      .withIndex('by_ownerTokenIdentifier', (q) =>
        q.eq('ownerTokenIdentifier', chat.ownerTokenIdentifier),
      )
      .unique()
    if (usage) {
      await ctx.db.patch(usage._id, {
        chatCount: Math.max(0, usage.chatCount - 1),
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

export const deleteExpiredExports = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()
    const exports = await ctx.db
      .query('dataExports')
      .withIndex('by_expiresAt', (q) => q.lt('expiresAt', now))
      .take(10)
    for (const item of exports) {
      await ctx.storage.delete(item.storageId)
      await ctx.db.delete(item._id)
    }
    if (exports.length === 10) {
      await ctx.scheduler.runAfter(
        0,
        internal.retention.deleteExpiredExports,
        {},
      )
    }
    return null
  },
})
