/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import { env, internalMutation } from './_generated/server'
import {
  operationalEventKindValidator,
  operationalSeverityValidator,
} from './accountValidators'
import { resolveAlertFailureThreshold } from '../shared/productionConfig'

const monitoredKinds = [
  'document_processing_failed',
  'chat_response_failed',
  'account_export_failed',
] as const
const ALERT_WINDOW_MS = 60 * 60 * 1_000

export const recordEvent = internalMutation({
  args: {
    ownerTokenIdentifier: v.optional(v.string()),
    kind: operationalEventKindValidator,
    severity: operationalSeverityValidator,
    resourceId: v.optional(v.string()),
    safeMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert('operationalEvents', {
      ...args,
      safeMessage: args.safeMessage.slice(0, 240),
      createdAt: Date.now(),
    })
    return null
  },
})

export const evaluateFailureAlerts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()
    const windowStartedAt = now - ALERT_WINDOW_MS
    const threshold = resolveAlertFailureThreshold(env.ALERT_FAILURE_THRESHOLD)
    for (const kind of monitoredKinds) {
      const events = await ctx.db
        .query('operationalEvents')
        .withIndex('by_kind_and_createdAt', (q) =>
          q.eq('kind', kind).gte('createdAt', windowStartedAt),
        )
        .take(threshold + 1)
      const key = `${kind}:one_hour`
      const existing = await ctx.db
        .query('systemAlerts')
        .withIndex('by_key', (q) => q.eq('key', key))
        .unique()
      if (events.length >= threshold) {
        if (existing) {
          await ctx.db.patch(existing._id, {
            status: 'active',
            eventCount: events.length,
            windowStartedAt,
            lastSeenAt: now,
            resolvedAt: undefined,
          })
        } else {
          await ctx.db.insert('systemAlerts', {
            key,
            kind,
            status: 'active',
            eventCount: events.length,
            windowStartedAt,
            openedAt: now,
            lastSeenAt: now,
          })
        }
        console.error('Operational alert active', {
          key,
          eventCount: events.length,
          windowStartedAt,
        })
      } else if (existing?.status === 'active') {
        await ctx.db.patch(existing._id, {
          status: 'resolved',
          eventCount: events.length,
          windowStartedAt,
          lastSeenAt: now,
          resolvedAt: now,
        })
      }
    }
    return null
  },
})
