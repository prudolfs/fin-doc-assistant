import { env } from '../_generated/server'
import { resolveAccountQuotas } from '../../shared/productionConfig'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export function accountQuotas() {
  return resolveAccountQuotas({
    maxDocuments: env.ACCOUNT_MAX_DOCUMENTS,
    maxChats: env.ACCOUNT_MAX_CHATS,
    maxStorageBytes: env.ACCOUNT_MAX_STORAGE_BYTES,
  })
}

export async function readAccountUsage(
  ctx: QueryCtx | MutationCtx,
  ownerTokenIdentifier: string,
) {
  const existing = await ctx.db
    .query('accountUsage')
    .withIndex('by_ownerTokenIdentifier', (q) =>
      q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
    )
    .unique()
  if (existing) return existing

  const quotas = accountQuotas()
  const [documents, chats] = await Promise.all([
    ctx.db
      .query('documents')
      .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(quotas.maxDocuments + 1),
    ctx.db
      .query('chats')
      .withIndex('by_ownerTokenIdentifier_and_lastMessageAt', (q) =>
        q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
      )
      .take(quotas.maxChats + 1),
  ])
  return {
    ownerTokenIdentifier,
    documentCount: documents.length,
    chatCount: chats.length,
    storageBytes: documents.reduce(
      (total, document) => total + document.byteSize,
      0,
    ),
    updatedAt: 0,
  }
}

export async function getOrCreateAccountUsage(
  ctx: MutationCtx,
  ownerTokenIdentifier: string,
) {
  const usage = await readAccountUsage(ctx, ownerTokenIdentifier)
  if ('_id' in usage) return usage
  const id = await ctx.db.insert('accountUsage', {
    ...usage,
    updatedAt: Date.now(),
  })
  const created = await ctx.db.get('accountUsage', id)
  if (!created) throw new Error('Could not initialize account usage')
  return created
}
