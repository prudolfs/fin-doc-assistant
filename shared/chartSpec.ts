import { z } from 'zod'

export const chartTypeSchema = z.enum(['bar', 'line', 'area', 'pie'])
export const chartIntentSchema = z.enum([
  'spending_over_time',
  'spending_by_supplier',
  'tax_over_time',
  'invoice_status',
])
export const chartIntervalSchema = z.enum(['day', 'month', 'quarter'])

export const chartDatumSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    valueMinor: z.number().int().safe(),
    documentCount: z.number().int().min(0).max(500),
  })
  .strict()

export const chartSpecSchema = z
  .object({
    version: z.literal(1),
    chartType: chartTypeSchema,
    title: z.string().trim().min(1).max(120),
    xKey: z.literal('label'),
    series: z
      .array(
        z
          .object({
            key: z.literal('valueMinor'),
            label: z.string().trim().min(1).max(80),
            colorToken: z.enum(['emerald', 'sky', 'violet', 'amber']),
          })
          .strict(),
      )
      .length(1),
    data: z.array(chartDatumSchema).max(36),
    currency: z.string().regex(/^(?:[A-Z]{3}|UNKNOWN)$/),
    notes: z.array(z.string().trim().min(1).max(200)).max(8),
    emptyMessage: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (
      new Set(spec.data.map((datum) => datum.label)).size !== spec.data.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: 'Chart labels must be unique',
      })
    }
    if (
      spec.chartType === 'pie' &&
      spec.data.some((datum) => datum.valueMinor < 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: 'Pie chart values must be nonnegative',
      })
    }
    if (spec.chartType === 'pie' && spec.data.length > 12) {
      ctx.addIssue({
        code: 'custom',
        path: ['data'],
        message: 'Pie charts may contain at most 12 slices',
      })
    }
  })

export type ChartSpec = z.infer<typeof chartSpecSchema>
export type ChartType = z.infer<typeof chartTypeSchema>
export type ChartIntent = z.infer<typeof chartIntentSchema>
export type ChartInterval = z.infer<typeof chartIntervalSchema>

export type FinanceChartRecord = {
  currency?: string
  issueDate?: string
  supplier?: string
  documentType?: 'receipt' | 'invoice'
  paymentStatus?: 'paid' | 'unpaid' | 'partially_paid' | 'unknown'
  totalMinor?: number
  taxMinor?: number
}

export type ChartRequest = {
  intent: ChartIntent
  chartType?: ChartType
  interval?: ChartInterval
  currency?: string
  fromDate?: string
  toDate?: string
}

const MAX_CHARTS = 6
const MAX_TIME_POINTS = 36
const MAX_CATEGORIES = 12

function sorted<T>(
  values: Iterable<T>,
  compare: (left: T, right: T) => number,
) {
  const result = [...values]
  // This helper always owns the fresh array it sorts.
  // oxlint-disable-next-line unicorn/no-array-sort
  return result.sort(compare)
}

function safeCategoryLabels(
  data: ReadonlyArray<{
    label: string
    valueMinor: number
    documentCount: number
  }>,
) {
  const used = new Set<string>()
  return data.map((datum) => {
    const base =
      datum.label.length <= 80
        ? datum.label
        : `${datum.label.slice(0, 77).trimEnd()}…`
    let label = base
    let suffix = 2
    while (used.has(label)) {
      const marker = ` (${suffix})`
      label = `${base.slice(0, 80 - marker.length).trimEnd()}${marker}`
      suffix += 1
    }
    used.add(label)
    return { ...datum, label }
  })
}

function normalizedCurrency(value?: string) {
  const currency = value?.trim().toUpperCase()
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : 'UNKNOWN'
}

function inRange(record: FinanceChartRecord, request: ChartRequest) {
  if (!record.issueDate) return !request.fromDate && !request.toDate
  return (
    (!request.fromDate || record.issueDate >= request.fromDate) &&
    (!request.toDate || record.issueDate <= request.toDate)
  )
}

function timeLabel(issueDate: string, interval: ChartInterval) {
  if (interval === 'day') return issueDate
  if (interval === 'month') return issueDate.slice(0, 7)
  const month = Number(issueDate.slice(5, 7))
  return `${issueDate.slice(0, 4)} Q${Math.ceil(month / 3)}`
}

function compatibleChartType(request: ChartRequest): ChartType {
  const requested = request.chartType
  const timeIntent =
    request.intent === 'spending_over_time' ||
    request.intent === 'tax_over_time'
  if (timeIntent) {
    return requested === 'bar' || requested === 'line' || requested === 'area'
      ? requested
      : request.intent === 'tax_over_time'
        ? 'area'
        : 'line'
  }
  return requested === 'bar' || requested === 'pie' ? requested : 'bar'
}

function titleFor(request: ChartRequest, currency: string) {
  const titles: Record<ChartIntent, string> = {
    spending_over_time: 'Spending over time',
    spending_by_supplier: 'Spending by supplier',
    tax_over_time: 'Recorded tax over time',
    invoice_status: 'Invoice amounts by payment status',
  }
  return `${titles[request.intent]} · ${currency}`
}

function seriesLabel(request: ChartRequest, currency: string) {
  return `${request.intent === 'tax_over_time' ? 'Recorded tax' : 'Amount'} (${currency})`
}

function aggregateTime(
  records: ReadonlyArray<FinanceChartRecord>,
  request: ChartRequest,
) {
  const interval = request.interval ?? 'month'
  const totals = new Map<
    string,
    { valueMinor: number; documentCount: number }
  >()
  let missingDates = 0
  for (const record of records) {
    if (!record.issueDate) {
      missingDates += 1
      continue
    }
    const label = timeLabel(record.issueDate, interval)
    const current = totals.get(label) ?? { valueMinor: 0, documentCount: 0 }
    current.valueMinor +=
      request.intent === 'tax_over_time'
        ? (record.taxMinor ?? 0)
        : (record.totalMinor ?? 0)
    current.documentCount += 1
    totals.set(label, current)
  }
  const allData = sorted(totals.entries(), ([left], [right]) =>
    left.localeCompare(right),
  ).map(([label, values]) => ({ label, ...values }))
  const omitted = Math.max(0, allData.length - MAX_TIME_POINTS)
  return {
    data: allData.slice(-MAX_TIME_POINTS),
    notes: [
      ...(missingDates > 0
        ? [`${missingDates} document(s) without an issue date were excluded.`]
        : []),
      ...(omitted > 0
        ? [
            `Only the most recent ${MAX_TIME_POINTS} of ${allData.length} periods are shown.`,
          ]
        : []),
    ],
  }
}

function aggregateCategories(
  records: ReadonlyArray<FinanceChartRecord>,
  request: ChartRequest,
) {
  const totals = new Map<
    string,
    { valueMinor: number; documentCount: number }
  >()
  for (const record of records) {
    let label: string
    if (request.intent === 'spending_by_supplier') {
      label = record.supplier?.trim() || 'Unknown supplier'
    } else {
      label =
        record.paymentStatus === 'paid'
          ? 'Paid'
          : record.paymentStatus === 'unpaid'
            ? 'Unpaid'
            : record.paymentStatus === 'partially_paid'
              ? 'Partially paid'
              : 'Unknown'
    }
    const current = totals.get(label) ?? { valueMinor: 0, documentCount: 0 }
    current.valueMinor += record.totalMinor ?? 0
    current.documentCount += 1
    totals.set(label, current)
  }
  const allData = sorted(
    totals.entries(),
    ([leftLabel, left], [rightLabel, right]) =>
      right.valueMinor - left.valueMinor || leftLabel.localeCompare(rightLabel),
  ).map(([label, values]) => ({ label, ...values }))
  if (allData.length <= MAX_CATEGORIES)
    return { data: safeCategoryLabels(allData), notes: [] }
  const visible = allData.slice(0, MAX_CATEGORIES - 1)
  const remainder = allData.slice(MAX_CATEGORIES - 1)
  visible.push({
    label: `Other (${remainder.length} categories)`,
    valueMinor: remainder.reduce((sum, datum) => sum + datum.valueMinor, 0),
    documentCount: remainder.reduce(
      (sum, datum) => sum + datum.documentCount,
      0,
    ),
  })
  return {
    data: safeCategoryLabels(visible),
    notes: [
      `${remainder.length} smaller categories are combined into “Other”.`,
    ],
  }
}

export function buildFinanceChartSpecs(
  records: ReadonlyArray<FinanceChartRecord>,
  request: ChartRequest,
) {
  const requestedCurrency = request.currency
    ? normalizedCurrency(request.currency)
    : undefined
  const eligible = records.filter((record) => {
    if (!inRange(record, request)) return false
    if (
      request.intent === 'invoice_status' &&
      record.documentType !== 'invoice'
    )
      return false
    return (
      requestedCurrency === undefined ||
      normalizedCurrency(record.currency) === requestedCurrency
    )
  })
  const currencyGroups = new Map<string, Array<FinanceChartRecord>>()
  for (const record of eligible) {
    const currency = normalizedCurrency(record.currency)
    const group = currencyGroups.get(currency) ?? []
    group.push(record)
    currencyGroups.set(currency, group)
  }
  if (currencyGroups.size === 0) {
    currencyGroups.set(requestedCurrency ?? 'UNKNOWN', [])
  }
  const currencies = sorted(currencyGroups.keys(), (left, right) =>
    left.localeCompare(right),
  )
  const omittedCurrencies = Math.max(0, currencies.length - MAX_CHARTS)
  const chartType = compatibleChartType(request)
  const charts = currencies.slice(0, MAX_CHARTS).map((currency) => {
    const currencyRecords = currencyGroups.get(currency) ?? []
    const aggregation =
      request.intent === 'spending_over_time' ||
      request.intent === 'tax_over_time'
        ? aggregateTime(currencyRecords, request)
        : aggregateCategories(currencyRecords, request)
    const cannotUsePie =
      chartType === 'pie' &&
      aggregation.data.some((datum) => datum.valueMinor < 0)
    const spec = {
      version: 1 as const,
      chartType: cannotUsePie ? ('bar' as const) : chartType,
      title: titleFor(request, currency),
      xKey: 'label' as const,
      series: [
        {
          key: 'valueMinor' as const,
          label: seriesLabel(request, currency),
          colorToken:
            request.intent === 'tax_over_time'
              ? ('violet' as const)
              : request.intent === 'invoice_status'
                ? ('amber' as const)
                : ('emerald' as const),
        },
      ] as const,
      data: aggregation.data,
      currency,
      notes: [
        ...aggregation.notes,
        ...(cannotUsePie
          ? [
              'A bar chart is used because pie charts cannot represent negative amounts.',
            ]
          : []),
        ...(omittedCurrencies > 0
          ? [`${omittedCurrencies} additional currency group(s) were omitted.`]
          : []),
      ],
      ...(aggregation.data.length === 0
        ? { emptyMessage: 'No matching finance data was found for this chart.' }
        : {}),
    }
    return chartSpecSchema.parse(spec)
  })
  return { charts, omittedCurrencies }
}

export function extractChartSpecs(value: unknown) {
  const found = new Map<string, ChartSpec>()
  function visit(candidate: unknown, depth: number) {
    if (depth > 4 || candidate === null || candidate === undefined) return
    if (Array.isArray(candidate)) {
      for (const item of candidate.slice(0, 12)) visit(item, depth + 1)
      return
    }
    if (typeof candidate !== 'object') return
    const parsed = chartSpecSchema.safeParse(candidate)
    if (parsed.success) {
      found.set(`${parsed.data.title}:${parsed.data.currency}`, parsed.data)
      return
    }
    for (const nested of Object.values(candidate).slice(0, 20))
      visit(nested, depth + 1)
  }
  visit(value, 0)
  return [...found.values()]
}
