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

export const addChartTurn = internalMutation({
  args: {
    ownerTokenIdentifier: v.string(),
    chatId: v.id('chats'),
    documentId: v.id('documents'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (env.AUTH_ENVIRONMENT === 'production') {
      throw new Error('README demo fixtures are disabled in production')
    }

    const [chat, document] = await Promise.all([
      ctx.db.get('chats', args.chatId),
      ctx.db.get('documents', args.documentId),
    ])
    if (
      !chat ||
      chat.ownerTokenIdentifier !== args.ownerTokenIdentifier ||
      !document ||
      document.ownerTokenIdentifier !== args.ownerTokenIdentifier ||
      !document.structuredResult
    ) {
      throw new Error('An owned chat and completed document are required')
    }

    const prompt = 'Chart my spending by supplier.'
    const { messageId: promptMessageId } = await saveMessage(
      ctx,
      components.agent,
      {
        threadId: chat.threadId,
        userId: args.ownerTokenIdentifier,
        prompt,
      },
    )
    const toolCallId = `readme-chart-${args.chatId}`
    const spec = {
      version: 1 as const,
      chartType: 'bar' as const,
      title: 'Spending by supplier (EUR)',
      xKey: 'label' as const,
      series: [
        {
          key: 'valueMinor' as const,
          label: 'Spending (EUR)',
          colorToken: 'emerald' as const,
        },
      ],
      data: [
        {
          label:
            document.structuredResult.merchantOrSupplierName ??
            document.originalFilename,
          valueMinor: document.structuredResult.totalMinor ?? 0,
          documentCount: 1,
        },
      ],
      currency: document.structuredResult.currency ?? 'UNKNOWN',
      notes: ['Calculated from 1 matching finance document.'],
    }
    await saveMessage(ctx, components.agent, {
      threadId: chat.threadId,
      userId: args.ownerTokenIdentifier,
      promptMessageId,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId,
            toolName: 'getChartData',
            input: { intent: 'spending_by_supplier', chartType: 'bar' },
          },
        ],
      },
      agentName: 'Finance Document Assistant',
    })
    await saveMessage(ctx, components.agent, {
      threadId: chat.threadId,
      userId: args.ownerTokenIdentifier,
      promptMessageId,
      message: {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId,
            toolName: 'getChartData',
            output: { type: 'json', value: { charts: [{ spec }] } },
          },
        ],
      },
      agentName: 'Finance Document Assistant',
    })
    await ctx.db.insert('chartArtifacts', {
      ownerTokenIdentifier: args.ownerTokenIdentifier,
      chatId: args.chatId,
      messageId: promptMessageId,
      artifactKey: `${args.ownerTokenIdentifier}:${promptMessageId}:0`,
      spec,
      createdAt: Date.now(),
    })
    await saveMessage(ctx, components.agent, {
      threadId: chat.threadId,
      userId: args.ownerTokenIdentifier,
      promptMessageId,
      message: {
        role: 'assistant',
        content: `Your supplier spending is shown above. [${document.originalFilename}](/app/documents/${document._id}) is the source.`,
      },
      agentName: 'Finance Document Assistant',
    })
    await ctx.db.patch(args.chatId, {
      lastMessageAt: Date.now(),
      updatedAt: Date.now(),
    })
    return null
  },
})
