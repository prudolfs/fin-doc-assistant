import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildFinanceChartSpecs } from '../../shared/chartSpec'
import { FinanceChart } from './finance-chart'

describe('FinanceChart', () => {
  it('server-renders a mobile-width chart with an accessible exact-value table', () => {
    const { charts } = buildFinanceChartSpecs(
      [
        {
          currency: 'EUR',
          issueDate: '2026-07-01',
          totalMinor: 1_234,
        },
        {
          currency: 'EUR',
          issueDate: '2026-08-01',
          totalMinor: 5_678,
        },
      ],
      { intent: 'spending_over_time', interval: 'month' },
    )
    const html = renderToStaticMarkup(
      <FinanceChart spec={charts[0]} initialWidth={320} />,
    )
    expect(html).toContain('role="img"')
    expect(html).toContain('View accessible data table')
    expect(html).toContain('2026-07')
    expect(html).toContain('12.34')
  })
})
