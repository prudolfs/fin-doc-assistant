/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { chartSpecValidator } from './chartValidators'

export const saveForMessage = internalMutation({
  args: {
    ownerTokenIdentifier: v.string(),
    chatId: v.id('chats'),
    messageId: v.string(),
    specs: v.array(chartSpecValidator),
  },
  returns: v.array(v.id('chartArtifacts')),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get('chats', args.chatId)
    if (!chat || chat.ownerTokenIdentifier !== args.ownerTokenIdentifier) {
      throw new Error('Conversation was not found')
    }
    if (args.specs.length > 6) throw new Error('Too many chart artifacts')
    const ids = []
    for (const [index, spec] of args.specs.entries()) {
      const artifactKey = `${args.ownerTokenIdentifier}:${args.messageId}:${index}`
      const existing = await ctx.db
        .query('chartArtifacts')
        .withIndex('by_artifactKey', (q) => q.eq('artifactKey', artifactKey))
        .unique()
      if (existing) {
        ids.push(existing._id)
        continue
      }
      ids.push(
        await ctx.db.insert('chartArtifacts', {
          ownerTokenIdentifier: args.ownerTokenIdentifier,
          chatId: args.chatId,
          messageId: args.messageId,
          artifactKey,
          spec,
          createdAt: Date.now(),
        }),
      )
    }
    return ids
  },
})
