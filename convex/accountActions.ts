'use node'

/* oxlint-disable no-underscore-dangle */

import { gzipSync } from 'node:zlib'
import { listMessages } from '@convex-dev/agent'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { action, env } from './_generated/server'
import { rateLimiter } from './rateLimits'
import { createTarArchive } from '../shared/tarArchive'
import { resolveExportRetentionHours } from '../shared/productionConfig'
import type { Doc } from './_generated/dataModel'
import type { TarEntry } from '../shared/tarArchive'

const MAX_EXPORTED_MESSAGES = 2_000

function jsonBytes(value: unknown) {
  return new TextEncoder().encode(
    JSON.stringify(
      value,
      (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
      2,
    ),
  )
}

function exportFilename(document: Doc<'documents'>, index: number) {
  return `documents/${String(index + 1).padStart(3, '0')}-${document._id}-${document.originalFilename}`
}

export const createDataExport = action({
  args: {},
  returns: v.object({
    url: v.string(),
    filename: v.string(),
    expiresAt: v.number(),
    byteSize: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    url: string
    filename: string
    expiresAt: number
    byteSize: number
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Authentication required')
    await rateLimiter.limit(ctx, 'dataExport', {
      key: identity.tokenIdentifier,
      throws: true,
    })

    let storedId: Awaited<ReturnType<typeof ctx.storage.store>> | null = null
    try {
      const snapshot: {
        documents: Array<Doc<'documents'>>
        chats: Array<Doc<'chats'>>
        settings: Doc<'accountSettings'> | null
      } = await ctx.runQuery(internal.accountData.getExportSnapshot, {
        ownerTokenIdentifier: identity.tokenIdentifier,
      })
      const conversations: Array<{
        chat: Doc<'chats'>
        messages: Array<unknown>
        truncated: boolean
      }> = []
      let remainingMessages = MAX_EXPORTED_MESSAGES
      for (const chat of snapshot.chats) {
        if (remainingMessages === 0) break
        const messages = await listMessages(ctx, components.agent, {
          threadId: chat.threadId,
          paginationOpts: {
            cursor: null,
            numItems: Math.min(200, remainingMessages),
          },
        })
        remainingMessages -= messages.page.length
        conversations.push({
          chat,
          messages: messages.page,
          truncated: !messages.isDone,
        })
      }

      const entries: Array<TarEntry> = [
        {
          name: 'account-data.json',
          bytes: jsonBytes({
            exportedAt: new Date().toISOString(),
            settings: snapshot.settings,
            documents: snapshot.documents,
            conversations,
            messagesTruncated:
              remainingMessages === 0 ||
              conversations.length < snapshot.chats.length,
          }),
        },
      ]
      for (const [index, document] of snapshot.documents.entries()) {
        const blob = await ctx.storage.get(document.storageId)
        if (!blob) continue
        entries.push({
          name: exportFilename(document, index),
          bytes: new Uint8Array(await blob.arrayBuffer()),
          modifiedAt: document.updatedAt,
        })
      }
      const compressed: Uint8Array = Uint8Array.from(
        gzipSync(createTarArchive(entries)),
      )
      const exportBuffer = new ArrayBuffer(compressed.byteLength)
      new Uint8Array(exportBuffer).set(compressed)
      storedId = await ctx.storage.store(
        new Blob([exportBuffer], { type: 'application/gzip' }),
      )
      const expiresAt =
        Date.now() +
        resolveExportRetentionHours(env.EXPORT_RETENTION_HOURS) *
          60 *
          60 *
          1_000
      await ctx.runMutation(internal.accountData.saveExport, {
        ownerTokenIdentifier: identity.tokenIdentifier,
        storageId: storedId,
        byteSize: compressed.byteLength,
        expiresAt,
      })
      const url = await ctx.storage.getUrl(storedId)
      if (!url) throw new Error('Could not create an export download URL')
      return {
        url,
        filename: `finance-document-assistant-export-${new Date().toISOString().slice(0, 10)}.tar.gz`,
        expiresAt,
        byteSize: compressed.byteLength,
      }
    } catch (error) {
      if (storedId) await ctx.storage.delete(storedId)
      await ctx.runMutation(internal.observability.recordEvent, {
        ownerTokenIdentifier: identity.tokenIdentifier,
        kind: 'account_export_failed',
        severity: 'error',
        safeMessage: 'Account data export failed.',
      })
      throw error
    }
  },
})
