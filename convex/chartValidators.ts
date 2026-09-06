import { v } from 'convex/values'

export const chartTypeValidator = v.union(
  v.literal('bar'),
  v.literal('line'),
  v.literal('area'),
  v.literal('pie'),
)

export const chartIntentValidator = v.union(
  v.literal('spending_over_time'),
  v.literal('spending_by_supplier'),
  v.literal('tax_over_time'),
  v.literal('invoice_status'),
)

export const chartIntervalValidator = v.union(
  v.literal('day'),
  v.literal('month'),
  v.literal('quarter'),
)

export const chartDatumValidator = v.object({
  label: v.string(),
  valueMinor: v.number(),
  documentCount: v.number(),
})

export const chartSpecValidator = v.object({
  version: v.literal(1),
  chartType: chartTypeValidator,
  title: v.string(),
  xKey: v.literal('label'),
  series: v.array(
    v.object({
      key: v.literal('valueMinor'),
      label: v.string(),
      colorToken: v.union(
        v.literal('emerald'),
        v.literal('sky'),
        v.literal('violet'),
        v.literal('amber'),
      ),
    }),
  ),
  data: v.array(chartDatumValidator),
  currency: v.string(),
  notes: v.array(v.string()),
  emptyMessage: v.optional(v.string()),
})
