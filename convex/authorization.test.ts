// @vitest-environment edge-runtime

/* oxlint-disable no-underscore-dangle */

import { convexTest } from 'convex-test'
import { describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

function identity(name: string) {
  return {
    subject: name,
    issuer: 'https://auth.test',
    tokenIdentifier: `https://auth.test|${name}`,
  }
}

describe('Convex authorization boundaries', () => {
  it('returns a conversation only to its owner', async () => {
    const t = convexTest(schema, modules)
    const chatId = await t.run((ctx) =>
      ctx.db.insert('chats', {
        ownerTokenIdentifier: identity('alice').tokenIdentifier,
        threadId: 'thread-alice',
        title: 'Private finances',
        status: 'idle',
        lastMessageAt: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
    )

    const owned = await t.withIdentity(identity('alice')).query(api.chats.get, {
      chatId,
    })
    const hidden = await t.withIdentity(identity('bob')).query(api.chats.get, {
      chatId,
    })

    expect(owned?._id).toBe(chatId)
    expect(hidden).toBeNull()
    await expect(t.query(api.chats.get, { chatId })).rejects.toThrow(
      'Authentication required',
    )
  })

  it('refuses to delete another user’s conversation', async () => {
    const t = convexTest(schema, modules)
    const chatId = await t.run((ctx) =>
      ctx.db.insert('chats', {
        ownerTokenIdentifier: identity('alice').tokenIdentifier,
        threadId: 'thread-alice-delete',
        title: 'Alice only',
        status: 'idle',
        lastMessageAt: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
    )

    await expect(
      t.withIdentity(identity('bob')).mutation(api.chats.remove, { chatId }),
    ).rejects.toThrow('Conversation was not found')
    expect(await t.run((ctx) => ctx.db.get('chats', chatId))).not.toBeNull()
  })

  it('does not delete a conversation with a response in progress', async () => {
    const t = convexTest(schema, modules)
    const chatId = await t.run((ctx) =>
      ctx.db.insert('chats', {
        ownerTokenIdentifier: identity('alice').tokenIdentifier,
        threadId: 'thread-alice-responding',
        title: 'Still responding',
        status: 'responding',
        lastMessageAt: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
    )

    await expect(
      t.withIdentity(identity('alice')).mutation(api.chats.remove, { chatId }),
    ).rejects.toThrow('Wait for the current response')
  })

  it('keeps document records and files private across identities', async () => {
    const t = convexTest(schema, modules)
    const documentId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(['private receipt'], { type: 'image/png' }),
      )
      return await ctx.db.insert('documents', {
        ownerTokenIdentifier: identity('alice').tokenIdentifier,
        storageId,
        originalFilename: 'receipt.png',
        mimeType: 'image/png',
        byteSize: 15,
        sha256: 'test-sha',
        status: 'completed',
        processingStage: 'completed',
        schemaVersion: 1,
        validationErrors: [],
        needsReview: false,
        createdAt: 1,
        updatedAt: 1,
      })
    })

    const owned = await t
      .withIdentity(identity('alice'))
      .query(api.documents.get, { documentId })
    const hidden = await t
      .withIdentity(identity('bob'))
      .query(api.documents.get, { documentId })

    expect(owned?.document._id).toBe(documentId)
    expect(owned?.fileUrl).toMatch(/^https?:\/\//)
    expect(hidden).toBeNull()
  })
})

describe('operational alerts', () => {
  it('opens a bounded alert after the configured failure threshold', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-06T12:00:00Z'))
    try {
      const t = convexTest(schema, modules)
      for (let index = 0; index < 5; index += 1) {
        await t.mutation(internal.observability.recordEvent, {
          kind: 'document_processing_failed',
          severity: 'error',
          safeMessage: 'Processing failed safely.',
        })
      }
      await t.mutation(internal.observability.evaluateFailureAlerts, {})
      const alert = await t.run((ctx) =>
        ctx.db
          .query('systemAlerts')
          .withIndex('by_key', (q) =>
            q.eq('key', 'document_processing_failed:one_hour'),
          )
          .unique(),
      )
      expect(alert).toMatchObject({ status: 'active', eventCount: 5 })
    } finally {
      vi.useRealTimers()
    }
  })
})
