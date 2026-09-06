export type CurrencyAmountRecord = {
  currency?: string
  totalMinor?: number
  taxMinor?: number
}

export type CurrencyTotal = {
  currency: string
  totalMinor: number
  taxMinor: number
  documentCount: number
}

export function totalsByCurrency(
  records: ReadonlyArray<CurrencyAmountRecord>,
): Array<CurrencyTotal> {
  const totals = new Map<
    string,
    { totalMinor: number; taxMinor: number; documentCount: number }
  >()
  for (const record of records) {
    const currency = record.currency ?? 'UNKNOWN'
    const current = totals.get(currency) ?? {
      totalMinor: 0,
      taxMinor: 0,
      documentCount: 0,
    }
    current.totalMinor += record.totalMinor ?? 0
    current.taxMinor += record.taxMinor ?? 0
    current.documentCount += 1
    totals.set(currency, current)
  }
  const result = [...totals.entries()].map(([currency, totalsForCurrency]) => ({
    currency,
    ...totalsForCurrency,
  }))
  // The array was created above, so sorting cannot mutate caller-owned input.
  // oxlint-disable-next-line unicorn/no-array-sort
  return result.sort((left, right) =>
    left.currency.localeCompare(right.currency),
  )
}

export function compareCurrencyTotals(
  firstPeriod: ReadonlyArray<CurrencyTotal>,
  secondPeriod: ReadonlyArray<CurrencyTotal>,
) {
  const currencies = new Set([
    ...firstPeriod.map((item) => item.currency),
    ...secondPeriod.map((item) => item.currency),
  ])
  return [...currencies].map((currency) => {
    const first =
      firstPeriod.find((item) => item.currency === currency)?.totalMinor ?? 0
    const second =
      secondPeriod.find((item) => item.currency === currency)?.totalMinor ?? 0
    return {
      currency,
      absoluteMinor: second - first,
      percentage: first === 0 ? null : ((second - first) / first) * 100,
    }
  })
}
