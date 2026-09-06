/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import {
  env,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { retentionDaysValidator } from './accountValidators'
import { accountQuotas, readAccountUsage } from './lib/accountUsage'
import schema from './schema'
import { resolveDefaultRetentionDays } from '../shared/productionConfig'
import type { MutationCtx, QueryCtx } from './_generated/server'

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Authentication required')
  return identity
}

export const getSettings = query({
  args: {},
  returns: v.object({
    retentionDays: retentionDaysValidator,
    usage: v.object({
      documentCount: v.number(),
      chatCount: v.number(),
      storageBytes: v.number(),
    }),
    quotas: v.object({
      maxDocuments: v.number(),
      maxChats: v.number(),
      maxStorageBytes: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const [settings, usage] = await Promise.all([
      ctx.db
        .query('accountSettings')
        .withIndex('by_ownerTokenIdentifier', (q) =>
          q.eq('ownerTokenIdentifier', identity.tokenIdentifier),
        )
        .unique(),
      readAccountUsage(ctx, identity.tokenIdentifier),
    ])
    return {
      retentionDays:
        settings?.retentionDays ??
        resolveDefaultRetentionDays(env.DATA_RETENTION_DAYS),
      usage: {
        documentCount: usage.documentCount,
        chatCount: usage.chatCount,
        storageBytes: usage.storageBytes,
      },
      quotas: accountQuotas(),
    }
  },
})

export const updateRetention = mutation({
  args: { retentionDays: retentionDaysValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query('accountSettings')
      .withIndex('by_ownerTokenIdentifier', (q) =>
        q.eq('ownerTokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        retentionDays: args.retentionDays,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('accountSettings', {
        ownerTokenIdentifier: identity.tokenIdentifier,
        retentionDays: args.retentionDays,
        createdAt: now,
        updatedAt: now,
      })
    }
    return null
  },
})

export const getExportSnapshot = internalQuery({
  args: { ownerTokenIdentifier: v.string() },
  returns: v.object({
    documents: v.array(schema.doc('documents')),
    chats: v.array(schema.doc('chats')),
    settings: v.union(v.null(), schema.doc('accountSettings')),
  }),
  handler: async (ctx, args) => {
    const limits = accountQuotas()
    const [documents, chats, settings] = await Promise.all([
      ctx.db
        .query('documents')
        .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
          q.eq('ownerTokenIdentifier', args.ownerTokenIdentifier),
        )
        .take(limits.maxDocuments + 1),
      ctx.db
        .query('chats')
        .withIndex('by_ownerTokenIdentifier_and_lastMessageAt', (q) =>
          q.eq('ownerTokenIdentifier', args.ownerTokenIdentifier),
        )
        .take(limits.maxChats + 1),
      ctx.db
        .query('accountSettings')
        .withIndex('by_ownerTokenIdentifier', (q) =>
          q.eq('ownerTokenIdentifier', args.ownerTokenIdentifier),
        )
        .unique(),
    ])
    if (
      documents.length > limits.maxDocuments ||
      chats.length > limits.maxChats
    ) {
      throw new Error('Account data exceeds the configured export quota')
    }
    return { documents, chats, settings }
  },
})

export const saveExport = internalMutation({
  args: {
    ownerTokenIdentifier: v.string(),
    storageId: v.id('_storage'),
    byteSize: v.number(),
    expiresAt: v.number(),
  },
  returns: v.id('dataExports'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('dataExports', {
      ...args,
      createdAt: Date.now(),
    })
  },
})
