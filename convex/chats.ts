/* oxlint-disable no-underscore-dangle */

import {
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from '@convex-dev/agent'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import schema from './schema'
import type { MutationCtx, QueryCtx } from './_generated/server'

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Authentication required')
  return identity
}

function normalizedPrompt(prompt: string) {
  const value = prompt.trim()
  if (!value || value.length > 4_000) {
    throw new Error('Message must contain between 1 and 4,000 characters')
  }
  return value
}

function titleFromPrompt(prompt: string) {
  const oneLine = prompt.replaceAll(/\s+/g, ' ').trim()
  return oneLine.length <= 60 ? oneLine : `${oneLine.slice(0, 57)}…`
}

export const create = mutation({
  args: { prompt: v.string() },
  returns: v.id('chats'),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const prompt = normalizedPrompt(args.prompt)
    const title = titleFromPrompt(prompt)
    const threadId = await createThread(ctx, components.agent, {
      userId: identity.tokenIdentifier,
      title,
    })
    const now = Date.now()
    const chatId = await ctx.db.insert('chats', {
      ownerTokenIdentifier: identity.tokenIdentifier,
      threadId,
      title,
      status: 'responding',
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    })
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      userId: identity.tokenIdentifier,
      prompt,
    })
    await ctx.scheduler.runAfter(0, internal.chatActions.respond, {
      chatId,
      threadId,
      ownerTokenIdentifier: identity.tokenIdentifier,
      promptMessageId: messageId,
    })
    return chatId
  },
})

export const send = mutation({
  args: { chatId: v.id('chats'), prompt: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const chat = await ctx.db.get('chats', args.chatId)
    if (!chat || chat.ownerTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error('Conversation was not found')
    }
    if (chat.status === 'responding') {
      throw new Error('Wait for the current response to finish')
    }
    const prompt = normalizedPrompt(args.prompt)
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: chat.threadId,
      userId: identity.tokenIdentifier,
      prompt,
    })
    const now = Date.now()
    await ctx.db.patch(args.chatId, {
      status: 'responding',
      safeErrorMessage: undefined,
      lastMessageAt: now,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.chatActions.respond, {
      chatId: args.chatId,
      threadId: chat.threadId,
      ownerTokenIdentifier: identity.tokenIdentifier,
      promptMessageId: messageId,
    })
    return messageId
  },
})

export const listRecent = query({
  args: {},
  returns: v.array(schema.doc('chats')),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    return await ctx.db
      .query('chats')
      .withIndex('by_ownerTokenIdentifier_and_lastMessageAt', (q) =>
        q.eq('ownerTokenIdentifier', identity.tokenIdentifier),
      )
      .order('desc')
      .take(30)
  },
})

export const get = query({
  args: { chatId: v.string() },
  returns: v.union(v.null(), schema.doc('chats')),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const chatId = ctx.db.normalizeId('chats', args.chatId)
    if (!chatId) return null
    const chat = await ctx.db.get('chats', chatId)
    return chat?.ownerTokenIdentifier === identity.tokenIdentifier ? chat : null
  },
})

export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const chat = await ctx.db
      .query('chats')
      .withIndex('by_threadId', (q) => q.eq('threadId', args.threadId))
      .unique()
    if (!chat || chat.ownerTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error('Conversation was not found')
    }
    const paginated = await listUIMessages(ctx, components.agent, args)
    const streams = await syncStreams(ctx, components.agent, args)
    return { ...paginated, streams }
  },
})
