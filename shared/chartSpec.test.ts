import { describe, expect, it } from 'vitest'
import {
  buildFinanceChartSpecs,
  chartSpecSchema,
  extractChartSpecs,
} from './chartSpec'

describe('finance chart specifications', () => {
  it('returns a valid, explicit empty state', () => {
    const { charts } = buildFinanceChartSpecs([], {
      intent: 'spending_over_time',
      currency: 'EUR',
    })
    expect(charts).toHaveLength(1)
    expect(charts[0]).toMatchObject({
      chartType: 'line',
      currency: 'EUR',
      data: [],
      emptyMessage: 'No matching finance data was found for this chart.',
    })
  })

  it('bounds large time series to the most recent 36 points', () => {
    const records = Array.from({ length: 50 }, (_, index) => ({
      currency: 'EUR',
      issueDate: `${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`,
      totalMinor: 100 + index,
    }))
    const { charts } = buildFinanceChartSpecs(records, {
      intent: 'spending_over_time',
      interval: 'month',
    })
    expect(charts[0].data).toHaveLength(36)
    expect(charts[0].data[0].label).toBe('2021-03')
    expect(charts[0].notes[0]).toContain('most recent 36')
  })

  it('creates a separate validated chart for every currency', () => {
    const { charts } = buildFinanceChartSpecs(
      [
        { currency: 'EUR', supplier: 'A', totalMinor: 1_000 },
        { currency: 'USD', supplier: 'A', totalMinor: 2_000 },
        { currency: 'EUR', supplier: 'B', totalMinor: 500 },
      ],
      { intent: 'spending_by_supplier', chartType: 'pie' },
    )
    expect(charts.map((chart) => chart.currency)).toEqual(['EUR', 'USD'])
    expect(charts[0].data).toEqual([
      { label: 'A', valueMinor: 1_000, documentCount: 1 },
      { label: 'B', valueMinor: 500, documentCount: 1 },
    ])
  })

  it('rejects unsafe pie data and duplicate labels', () => {
    const base = {
      version: 1 as const,
      chartType: 'pie' as const,
      title: 'Unsafe chart',
      xKey: 'label' as const,
      series: [
        {
          key: 'valueMinor' as const,
          label: 'Amount (EUR)',
          colorToken: 'emerald' as const,
        },
      ],
      currency: 'EUR',
      notes: [],
    }
    expect(
      chartSpecSchema.safeParse({
        ...base,
        data: [
          { label: 'A', valueMinor: -1, documentCount: 1 },
          { label: 'A', valueMinor: 2, documentCount: 1 },
        ],
      }).success,
    ).toBe(false)
  })

  it('falls back from pie for negative values and bounds category labels', () => {
    const { charts } = buildFinanceChartSpecs(
      [
        {
          currency: 'EUR',
          supplier:
            'A supplier name that is deliberately much longer than the maximum chart label length so it must be shortened safely',
          totalMinor: -100,
        },
      ],
      { intent: 'spending_by_supplier', chartType: 'pie' },
    )
    expect(charts[0].chartType).toBe('bar')
    expect(charts[0].data[0].label.length).toBeLessThanOrEqual(80)
    expect(charts[0].notes[0]).toContain('cannot represent negative')
  })

  it('extracts a strict chart spec nested beside its persisted artifact ID', () => {
    const { charts } = buildFinanceChartSpecs([], {
      intent: 'spending_over_time',
      currency: 'EUR',
    })
    expect(
      extractChartSpecs({
        charts: [{ artifactId: 'chart-id', spec: charts[0] }],
      }),
    ).toEqual(charts)
  })
})
