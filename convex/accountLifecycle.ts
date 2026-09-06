/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { deletionPhaseValidator } from './accountValidators'
import type { MutationCtx } from './_generated/server'
import type { Infer } from 'convex/values'

type DeletionPhase = Infer<typeof deletionPhaseValidator>

const phases: Array<DeletionPhase> = [
  'chartArtifacts',
  'documentAuditEvents',
  'documentPages',
  'documentExtractions',
  'documentJobs',
  'documents',
  'chats',
  'dataExports',
  'operationalEvents',
  'accountSettings',
  'accountUsage',
]

async function deletePhaseRows(
  ctx: MutationCtx,
  ownerTokenIdentifier: string,
  phase: DeletionPhase,
) {
  if (phase === 'chartArtifacts') {
    const rows = await ctx.db
      .query('chartArtifacts')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(25)
    for (const row of rows) await ctx.db.delete(row._id)
    return rows.length
  }
  if (phase === 'documentAuditEvents') {
    const rows = await ctx.db
      .query('documentAuditEvents')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(25)
    for (const row of rows) await ctx.db.delete(row._id)
    return rows.length
  }
  if (phase === 'documentPages') {
    const rows = await ctx.db
      .query('documentPages')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(25)
    for (const row of rows) await ctx.db.delete(row._id)
    return rows.length
  }
  if (phase === 'documentExtractions') {
    const rows = await ctx.db
      .query('documentExtractions')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(25)
    for (const row of rows) await ctx.db.delete(row._id)
    return rows.length
  }
  if (phase === 'documentJobs') {
    const rows = await ctx.db
      .query('documentJobs')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(25)
    for (const row of rows) await ctx.db.delete(row._id)
    return rows.length
  }
  if (phase === 'documents') {
    const rows = await ctx.db
      .query('documents')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(10)
    for (const row of rows) {
      await ctx.storage.delete(row.storageId)
      await ctx.db.delete(row._id)
    }
    return rows.length
  }
  if (phase === 'chats') {
    const rows = await ctx.db
      .query('chats')
      .withIndex('by_ownerTokenIdentifier_and_lastMessageAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(25)
    for (const row of rows) await ctx.db.delete(row._id)
    return rows.length
  }
  if (phase === 'dataExports') {
    const rows = await ctx.db
      .query('dataExports')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(10)
    for (const row of rows) {
      await ctx.storage.delete(row.storageId)
      await ctx.db.delete(row._id)
    }
    return rows.length
  }
  if (phase === 'operationalEvents') {
    const rows = await ctx.db
      .query('operationalEvents')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(25)
    for (const row of rows) await ctx.db.delete(row._id)
    return rows.length
  }
  const table = phase === 'accountSettings' ? 'accountSettings' : 'accountUsage'
  const row = await ctx.db
    .query(table)
    .withIndex('by_ownerTokenIdentifier', (q) =>
      q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
    )
    .unique()
  if (row) await ctx.db.delete(row._id)
  return row ? 1 : 0
}

export const scheduleAccountDeletion = internalMutation({
  args: { ownerTokenIdentifier: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_ownerTokenIdentifier', (q) =>
        q.eq('ownerTokenIdentifier', args.ownerTokenIdentifier),
      )
      .unique()
    if (existing) return null
    const now = Date.now()
    await ctx.db.insert('accountDeletionJobs', {
      ownerTokenIdentifier: args.ownerTokenIdentifier,
      phase: phases[0],
      createdAt: now,
      updatedAt: now,
    })
    await ctx.runMutation(components.agent.users.deleteAllForUserIdAsync, {
      userId: args.ownerTokenIdentifier,
    })
    await ctx.scheduler.runAfter(0, internal.accountLifecycle.deleteNextBatch, {
      ownerTokenIdentifier: args.ownerTokenIdentifier,
    })
    return null
  },
})

export const deleteNextBatch = internalMutation({
  args: { ownerTokenIdentifier: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_ownerTokenIdentifier', (q) =>
        q.eq('ownerTokenIdentifier', args.ownerTokenIdentifier),
      )
      .unique()
    if (!job) return null
    const deleted = await deletePhaseRows(
      ctx,
      args.ownerTokenIdentifier,
      job.phase,
    )
    if (deleted > 0) {
      await ctx.db.patch(job._id, { updatedAt: Date.now() })
      await ctx.scheduler.runAfter(
        0,
        internal.accountLifecycle.deleteNextBatch,
        args,
      )
      return null
    }
    const phaseIndex = phases.indexOf(job.phase)
    const nextPhase = phases[phaseIndex + 1]
    if (!nextPhase) {
      await ctx.db.delete(job._id)
      return null
    }
    await ctx.db.patch(job._id, {
      phase: nextPhase,
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(
      0,
      internal.accountLifecycle.deleteNextBatch,
      args,
    )
    return null
  },
})
