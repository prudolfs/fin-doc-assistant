import { describe, expect, it } from 'vitest'
import { compareCurrencyTotals, totalsByCurrency } from './financeCalculations'

describe('finance tool calculations', () => {
  it('keeps currencies separate and sums minor units deterministically', () => {
    expect(
      totalsByCurrency([
        { currency: 'EUR', totalMinor: 1_000, taxMinor: 210 },
        { currency: 'EUR', totalMinor: 500, taxMinor: 0 },
        { currency: 'USD', totalMinor: 700, taxMinor: 70 },
      ]),
    ).toEqual([
      { currency: 'EUR', totalMinor: 1_500, taxMinor: 210, documentCount: 2 },
      { currency: 'USD', totalMinor: 700, taxMinor: 70, documentCount: 1 },
    ])
  })

  it('calculates period changes without dividing by zero', () => {
    const first = totalsByCurrency([{ currency: 'EUR', totalMinor: 1_000 }])
    const second = totalsByCurrency([
      { currency: 'EUR', totalMinor: 1_250 },
      { currency: 'USD', totalMinor: 500 },
    ])
    expect(compareCurrencyTotals(first, second)).toEqual([
      { currency: 'EUR', absoluteMinor: 250, percentage: 25 },
      { currency: 'USD', absoluteMinor: 500, percentage: null },
    ])
  })
})
