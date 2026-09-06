/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import { internalMutation, internalQuery } from '../_generated/server'
import schema from '../schema'

export const getForResponse = internalQuery({
  args: {
    chatId: v.id('chats'),
    threadId: v.string(),
    ownerTokenIdentifier: v.string(),
  },
  returns: v.union(v.null(), schema.doc('chats')),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get('chats', args.chatId)
    if (
      !chat ||
      chat.threadId !== args.threadId ||
      chat.ownerTokenIdentifier !== args.ownerTokenIdentifier
    ) {
      return null
    }
    return chat
  },
})

export const finishResponse = internalMutation({
  args: {
    chatId: v.id('chats'),
    ownerTokenIdentifier: v.string(),
    failed: v.boolean(),
    safeErrorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get('chats', args.chatId)
    if (!chat || chat.ownerTokenIdentifier !== args.ownerTokenIdentifier) {
      return null
    }
    await ctx.db.patch(args.chatId, {
      status: args.failed ? 'failed' : 'idle',
      ...(args.safeErrorMessage
        ? { safeErrorMessage: args.safeErrorMessage }
        : { safeErrorMessage: undefined }),
      updatedAt: Date.now(),
    })
    return null
  },
})
