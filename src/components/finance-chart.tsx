import { areaY, barY, defineChart, lineY } from '@tanstack/charts'
import { pie, polar, radialArc } from '@tanstack/charts/polar'
import { Chart } from '@tanstack/charts/react'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import { BarChart3 } from 'lucide-react'
import { useMemo } from 'react'
import type { ChartSpec } from '../../shared/chartSpec'

const colors = {
  emerald: '#059669',
  sky: '#0284c7',
  violet: '#7c3aed',
  amber: '#d97706',
} as const

const categoricalColors = [
  '#059669',
  '#0284c7',
  '#7c3aed',
  '#d97706',
  '#dc2626',
  '#4f46e5',
  '#0d9488',
  '#9333ea',
  '#ca8a04',
  '#475569',
  '#be123c',
  '#0369a1',
]

function amountFormatter(currency: string) {
  if (currency === 'UNKNOWN') {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  })
}

export function FinanceChart({
  spec,
  initialWidth = 320,
}: {
  spec: ChartSpec
  initialWidth?: number
}) {
  const formatter = useMemo(
    () => amountFormatter(spec.currency),
    [spec.currency],
  )
  const totalMinor = spec.data.reduce((sum, datum) => sum + datum.valueMinor, 0)
  const renderable =
    spec.data.length > 0 &&
    (spec.chartType !== 'pie' ||
      spec.data.some((datum) => datum.valueMinor > 0))
  return (
    <section className="mt-3 min-w-0 rounded-2xl border bg-white p-3 sm:p-4 dark:bg-neutral-950">
      <div className="flex items-start gap-2">
        <BarChart3 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{spec.title}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {spec.data.length} data point{spec.data.length === 1 ? '' : 's'} ·{' '}
            {formatter.format(totalMinor / 100)} total
          </p>
        </div>
      </div>

      {renderable ? (
        <div className="mt-3 min-w-0">
          {spec.chartType === 'pie' ? (
            <FinancePieChart
              spec={spec}
              initialWidth={initialWidth}
              formatter={formatter}
            />
          ) : (
            <FinanceCartesianChart
              spec={spec}
              initialWidth={initialWidth}
              formatter={formatter}
            />
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500 dark:bg-neutral-900">
          {spec.emptyMessage ?? 'There is no non-zero data to chart.'}
        </p>
      )}

      {spec.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-neutral-500">
          {spec.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      )}

      <details className="mt-3 border-t pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          View accessible data table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-96 border-collapse text-left text-xs">
            <caption className="sr-only">{spec.title} exact values</caption>
            <thead>
              <tr className="border-b text-neutral-500">
                <th className="px-2 py-2 font-medium" scope="col">
                  {spec.xKey === 'label' ? 'Period or category' : spec.xKey}
                </th>
                <th className="px-2 py-2 text-right font-medium" scope="col">
                  {spec.series[0].label}
                </th>
                <th className="px-2 py-2 text-right font-medium" scope="col">
                  Documents
                </th>
              </tr>
            </thead>
            <tbody>
              {spec.data.map((datum) => (
                <tr className="border-b last:border-0" key={datum.label}>
                  <th className="px-2 py-2 font-medium" scope="row">
                    {datum.label}
                  </th>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatter.format(datum.valueMinor / 100)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {datum.documentCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

function FinanceCartesianChart({
  spec,
  initialWidth,
  formatter,
}: {
  spec: ChartSpec
  initialWidth: number
  formatter: Intl.NumberFormat
}) {
  const definition = useMemo(() => {
    const rows = spec.data.map((datum) => ({
      ...datum,
      amount: datum.valueMinor / 100,
    }))
    const color = colors[spec.series[0].colorToken]
    const mark =
      spec.chartType === 'bar'
        ? barY(rows, {
            x: 'label',
            y: 'amount',
            fill: color,
            inset: 2,
            radius: 3,
          })
        : spec.chartType === 'area'
          ? areaY(rows, {
              x: 'label',
              y: 'amount',
              fill: color,
              fillOpacity: 0.22,
              stroke: color,
            })
          : lineY(rows, {
              x: 'label',
              y: 'amount',
              stroke: color,
              strokeWidth: 2.5,
              points: true,
            })
    return defineChart({
      marks: [mark],
      scales: {
        x: {
          scale:
            spec.chartType === 'bar'
              ? () => scaleBand<string>().padding(0.16)
              : scalePoint,
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: spec.series[0].label,
            ticks: { format: (value) => formatter.format(Number(value)) },
          },
        },
      },
      tooltip: {
        use: tooltip,
        items: [
          {
            channel: 'y',
            label: spec.series[0].label,
            text: (point) => formatter.format(Number(point.yValue)),
          },
          'x',
        ],
      },
    })
  }, [formatter, spec])
  return (
    <Chart
      definition={definition}
      height={260}
      initialWidth={initialWidth}
      ariaLabel={spec.title}
      ariaDescription={`Interactive ${spec.chartType} chart. Exact values are available in the table following the chart.`}
    />
  )
}

function FinancePieChart({
  spec,
  initialWidth,
  formatter,
}: {
  spec: ChartSpec
  initialWidth: number
  formatter: Intl.NumberFormat
}) {
  const definition = useMemo(() => {
    const rows = spec.data.map((datum) => ({
      ...datum,
      amount: datum.valueMinor / 100,
    }))
    const slices = pie(rows, { value: 'amount' })
    return defineChart({
      marks: [
        polar({
          inset: 10,
          radiusRatio: 0.82,
          marks: [
            radialArc(slices, {
              innerRadius: ({ radius }) => radius * 0.5,
              cornerRadius: 3,
              color: 'label',
              key: 'label',
            }),
          ],
          scales: { angle: null, radius: null },
        }),
      ],
      scales: { x: null, y: null },
      color: {
        domain: rows.map((row) => row.label),
        range: categoricalColors,
      },
      tooltip,
    })
  }, [spec])
  return (
    <Chart
      definition={definition}
      height={260}
      initialWidth={initialWidth}
      ariaLabel={spec.title}
      ariaDescription={`Interactive pie chart totaling ${formatter.format(
        spec.data.reduce((sum, datum) => sum + datum.valueMinor, 0) / 100,
      )}. Exact values are available in the table following the chart.`}
    />
  )
}
