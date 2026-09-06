'use node'

import { createGateway } from '@ai-sdk/gateway'
import { Agent, saveMessage, stepCountIs } from '@convex-dev/agent'
import { convexGateway } from '@convex-dev/ai-sdk-provider'
import { tool } from 'ai'
import { v } from 'convex/values'
import { z } from 'zod'
import { components, internal } from './_generated/api'
import { env, internalAction } from './_generated/server'
import { resolveChatModel } from './lib/documentConfig'
import {
  chartIntentSchema,
  chartIntervalSchema,
  chartTypeSchema,
} from '../shared/chartSpec'
import type { ActionCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { ChartSpec } from '../shared/chartSpec'
import { gatewayPrivacyProviderOptions } from '../shared/productionConfig'
import { relativeDateContext } from '../shared/relativeDateContext'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalDateRange = {
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
}

function createFinanceTools(
  ctx: ActionCtx,
  ownerTokenIdentifier: string,
  chatId: Id<'chats'>,
  promptMessageId: string,
) {
  return {
    searchFinanceDocuments: tool({
      description:
        'Search the current user’s finance documents by text, date, type, status, or amount. Returns at most 20 source-linked records.',
      inputSchema: z.object({
        text: z.string().max(120).optional(),
        ...optionalDateRange,
        documentType: z.enum(['receipt', 'invoice']).optional(),
        status: z.enum(['completed', 'needs_review', 'failed']).optional(),
        minAmountMinor: z.number().int().optional(),
        maxAmountMinor: z.number().int().optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async (input): Promise<unknown> =>
        await ctx.runQuery(internal.financeTools.searchFinanceDocuments, {
          ownerTokenIdentifier,
          ...input,
        }),
    }),
    getFinanceDocument: tool({
      description:
        'Get one source document’s normalized fields, line items, warnings, evidence, and review provenance. Use only an ID returned by another finance tool.',
      inputSchema: z.object({ documentId: z.string().min(1) }),
      execute: async ({ documentId }): Promise<unknown> =>
        await ctx.runQuery(internal.financeTools.getFinanceDocument, {
          ownerTokenIdentifier,
          documentId,
        }),
    }),
    getSpendingSummary: tool({
      description:
        'Calculate deterministic expense and tax totals grouped by currency for an optional issue-date range.',
      inputSchema: z.object(optionalDateRange),
      execute: async (input): Promise<unknown> =>
        await ctx.runQuery(internal.financeTools.getSpendingSummary, {
          ownerTokenIdentifier,
          ...input,
        }),
    }),
    getIncomeAndExpenseSummary: tool({
      description:
        'Calculate deterministic income and expense totals by currency. The result explains dataset classification limits.',
      inputSchema: z.object(optionalDateRange),
      execute: async (input): Promise<unknown> =>
        await ctx.runQuery(internal.financeTools.getIncomeAndExpenseSummary, {
          ownerTokenIdentifier,
          ...input,
        }),
    }),
    getSupplierSummary: tool({
      description:
        'Aggregate supplier totals, document count, average amount, and outstanding invoice amount by currency.',
      inputSchema: z.object({
        supplier: z.string().max(120).optional(),
        ...optionalDateRange,
      }),
      execute: async (input): Promise<unknown> =>
        await ctx.runQuery(internal.financeTools.getSupplierSummary, {
          ownerTokenIdentifier,
          ...input,
        }),
    }),
    getTaxSummary: tool({
      description:
        'Calculate recorded tax totals by currency and line-item tax rate. This is document-derived information, not tax advice.',
      inputSchema: z.object(optionalDateRange),
      execute: async (input): Promise<unknown> =>
        await ctx.runQuery(internal.financeTools.getTaxSummary, {
          ownerTokenIdentifier,
          ...input,
        }),
    }),
    getOutstandingInvoices: tool({
      description:
        'List invoices explicitly stored as unpaid or partially paid, optionally filtered by due-date range. Never infers payment status.',
      inputSchema: z.object({
        fromDueDate: isoDate.optional(),
        toDueDate: isoDate.optional(),
      }),
      execute: async (input): Promise<unknown> =>
        await ctx.runQuery(internal.financeTools.getOutstandingInvoices, {
          ownerTokenIdentifier,
          ...input,
        }),
    }),
    comparePeriods: tool({
      description:
        'Compare deterministic spending totals between two inclusive issue-date periods, grouped by currency.',
      inputSchema: z.object({
        firstFromDate: isoDate,
        firstToDate: isoDate,
        secondFromDate: isoDate,
        secondToDate: isoDate,
      }),
      execute: async (input): Promise<unknown> =>
        await ctx.runQuery(internal.financeTools.comparePeriods, {
          ownerTokenIdentifier,
          ...input,
        }),
    }),
    getChartData: tool({
      description:
        'Create validated chart artifacts from deterministic finance aggregation. Use for useful numeric relationships, not single values. Each currency is charted separately. Time intents support bar, line, or area; categorical intents support bar or pie.',
      inputSchema: z.object({
        intent: chartIntentSchema,
        chartType: chartTypeSchema.optional(),
        interval: chartIntervalSchema.optional(),
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/)
          .optional(),
        ...optionalDateRange,
      }),
      execute: async (input): Promise<unknown> => {
        const result = await ctx.runQuery(internal.financeTools.getChartData, {
          ownerTokenIdentifier,
          ...input,
        })
        const artifactIds = await ctx.runMutation(
          internal.chartArtifacts.saveForMessage,
          {
            ownerTokenIdentifier,
            chatId,
            messageId: promptMessageId,
            specs: result.charts,
          },
        )
        return {
          ...result,
          charts: result.charts.map((spec: ChartSpec, index: number) => ({
            artifactId: artifactIds[index],
            spec,
          })),
        }
      },
    }),
  }
}

const instructions = `You are a careful personal finance document assistant.
Answer questions only from the current user's data returned by the available read-only tools.
Call the smallest relevant tool instead of asking for or assuming all documents.
Resolve relative dates such as today, this week, and this month from the current UTC date supplied below, unless the user provides another timezone.
Use getChartData when a trend, distribution, concentration, or comparison is materially clearer as a chart; do not chart a single value.
Never invent documents, suppliers, dates, payment states, currencies, totals, or tax conclusions.
Money is returned in integer minor units. Convert it to readable decimal amounts and keep different currencies separate.
Every document-derived claim must include at least one Markdown source link using the sourceUrl and originalFilename returned by a tool.
Mention validation or truncation limits when they affect the answer.
Tax results are document-derived information, not tax advice.
Do not claim that an invoice is unpaid unless getOutstandingInvoices or getFinanceDocument explicitly reports that status.
You have no mutation tools and cannot edit, approve, retry, or delete documents.`

export const respond = internalAction({
  args: {
    chatId: v.id('chats'),
    threadId: v.string(),
    ownerTokenIdentifier: v.string(),
    promptMessageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const chat: { status: string } | null = await ctx.runQuery(
        internal.internal.chats.getForResponse,
        {
          chatId: args.chatId,
          threadId: args.threadId,
          ownerTokenIdentifier: args.ownerTokenIdentifier,
        },
      )
      if (!chat || chat.status !== 'responding') return null

      const modelId = resolveChatModel(env.AI_GATEWAY_CHAT_MODEL)
      const languageModel = env.AI_GATEWAY_API_KEY
        ? createGateway({ apiKey: env.AI_GATEWAY_API_KEY })(modelId)
        : convexGateway(modelId)
      const agent = new Agent(components.agent, {
        name: 'Finance Document Assistant',
        languageModel,
        instructions: `${instructions}\n${relativeDateContext(new Date())}`,
        stopWhen: stepCountIs(6),
      })
      const result = await agent.streamText(
        ctx,
        {
          threadId: args.threadId,
          userId: args.ownerTokenIdentifier,
        },
        {
          promptMessageId: args.promptMessageId,
          providerOptions: gatewayPrivacyProviderOptions(
            env.AI_GATEWAY_ZERO_DATA_RETENTION,
          ),
          tools: createFinanceTools(
            ctx,
            args.ownerTokenIdentifier,
            args.chatId,
            args.promptMessageId,
          ),
        },
        {
          contextOptions: { recentMessages: 20 },
          saveStreamDeltas: { throttleMs: 100 },
        },
      )
      await result.consumeStream()
      await ctx.runMutation(internal.internal.chats.finishResponse, {
        chatId: args.chatId,
        ownerTokenIdentifier: args.ownerTokenIdentifier,
        failed: false,
      })
    } catch (error) {
      console.error('Finance chat response failed', {
        chatId: args.chatId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      const safeErrorMessage =
        'The assistant could not finish this response. Please try again.'
      await ctx.runMutation(internal.observability.recordEvent, {
        ownerTokenIdentifier: args.ownerTokenIdentifier,
        kind: 'chat_response_failed',
        severity: 'error',
        resourceId: args.chatId,
        safeMessage: safeErrorMessage,
      })
      try {
        await saveMessage(ctx, components.agent, {
          threadId: args.threadId,
          userId: args.ownerTokenIdentifier,
          promptMessageId: args.promptMessageId,
          message: { role: 'assistant', content: safeErrorMessage },
          agentName: 'Finance Document Assistant',
        })
      } catch (saveError) {
        console.error('Could not persist safe chat failure message', {
          chatId: args.chatId,
          error:
            saveError instanceof Error ? saveError.message : 'Unknown error',
        })
      }
      await ctx.runMutation(internal.internal.chats.finishResponse, {
        chatId: args.chatId,
        ownerTokenIdentifier: args.ownerTokenIdentifier,
        failed: true,
        safeErrorMessage,
      })
    }
    return null
  },
})
