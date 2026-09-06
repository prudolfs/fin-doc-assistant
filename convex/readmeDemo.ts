/* oxlint-disable no-underscore-dangle */

import { createThread, saveMessage } from '@convex-dev/agent'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { env, internalMutation } from './_generated/server'
import { accountQuotas, getOrCreateAccountUsage } from './lib/accountUsage'

export const createGroundedChat = internalMutation({
  args: {
    ownerTokenIdentifier: v.string(),
    documentId: v.id('documents'),
  },
  returns: v.id('chats'),
  handler: async (ctx, args) => {
    if (env.AUTH_ENVIRONMENT === 'production') {
      throw new Error('README demo fixtures are disabled in production')
    }

    const document = await ctx.db.get('documents', args.documentId)
    if (
      !document ||
      document.ownerTokenIdentifier !== args.ownerTokenIdentifier ||
      !document.structuredResult
    ) {
      throw new Error('A completed, owned document is required')
    }

    const usage = await getOrCreateAccountUsage(ctx, args.ownerTokenIdentifier)
    if (usage.chatCount >= accountQuotas().maxChats) {
      throw new Error('Account conversation quota reached')
    }

    const prompt = 'How much did I spend in August 2026?'
    const threadId = await createThread(ctx, components.agent, {
      userId: args.ownerTokenIdentifier,
      title: prompt,
    })
    const now = Date.now()
    const chatId = await ctx.db.insert('chats', {
      ownerTokenIdentifier: args.ownerTokenIdentifier,
      threadId,
      title: prompt,
      status: 'idle',
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(usage._id, {
      chatCount: usage.chatCount + 1,
      updatedAt: now,
    })
    await saveMessage(ctx, components.agent, {
      threadId,
      userId: args.ownerTokenIdentifier,
      prompt,
    })
    await saveMessage(ctx, components.agent, {
      threadId,
      userId: args.ownerTokenIdentifier,
      message: {
        role: 'assistant',
        content: `You spent €5.08 in August 2026, based on [${document.originalFilename}](/app/documents/${document._id}).`,
      },
      agentName: 'Finance Document Assistant',
    })
    return chatId
  },
})
