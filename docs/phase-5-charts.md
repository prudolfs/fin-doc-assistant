# Phase 5 charts

Phase 5 adds safe, persisted chart artifacts to authenticated finance chats.

## Example chat messages

These prompts map directly to the supported chart intents and should produce a
chart when matching documents exist:

- `Show my monthly spending for 2026 as a line chart.`
- `Create a bar chart of my daily spending from 2026-08-01 through 2026-08-31.`
- `Chart my quarterly spending from 2025-01-01 through 2026-12-31.`
- `Show a pie chart of spending by supplier for 2026 in EUR.`
- `Which suppliers account for most of my spending? Show it as a bar chart.`
- `Plot recorded tax by month for 2026 as an area chart.`
- `Show quarterly recorded tax in USD from 2025-01-01 through 2026-06-30.`
- `Chart invoice amounts by payment status as a pie chart.`
- `Compare paid, unpaid, partially paid, and unknown invoice amounts in a bar chart.`
- `Show monthly spending for 2026 across all currencies.` This produces a
  separate chart for each currency rather than combining currencies.

Explicit ISO date ranges (`YYYY-MM-DD`), currencies, intervals, and chart types
make the requested result most predictable. A question asking only for a
single total, such as `How much did I spend in August?`, intentionally may
return text rather than a chart because the Agent is instructed to chart only
useful numeric relationships.

## Validated chart contract

- `getChartData` accepts one of four bounded analytical intents: spending over
  time, spending by supplier, recorded tax over time, or invoice amounts by
  explicit payment status.
- The model may request bar, line, area, or pie presentation, but backend code
  selects only a compatible chart type. A pie request with negative values
  safely falls back to a bar chart.
- Every specification is parsed by a strict Zod schema before it leaves the
  deterministic aggregator. It fixes the x and value keys, permits one monetary
  series, restricts colors to known tokens, rejects duplicate labels and unsafe
  pie values, and bounds labels, notes, data points, and series.
- Chart artifacts are owner- and chat-scoped. They are saved idempotently using
  the triggering Agent message ID and returned to the persisted tool result as
  an artifact reference plus the validated specification.

## Deterministic aggregation

- Calculations use integer minor units and the same bounded set of at most 500
  recent, usable documents as the Phase 4 finance tools.
- Day, month, and quarter time series are sorted deterministically and limited
  to the most recent 36 periods.
- Supplier and invoice-status charts are sorted deterministically and limited
  to 12 categories. Smaller supplier groups are combined into a disclosed
  `Other` category.
- Currencies are never summed together. The result produces one artifact per
  currency, with a maximum of six disclosed currency groups per tool call.
- Invoice status comes only from the stored extracted payment status; unknown
  status remains an explicit `Unknown` category.

## Rendering and accessibility

- Assistant tool messages render validated specifications with the pinned
  `@tanstack/charts` 0.16.0 React SVG adapter.
- Charts follow the message width, use a deterministic 320-pixel initial width
  for SSR/mobile hydration, and expose a descriptive accessible name and
  description.
- Each chart includes a visible title and total, notes and truncation
  disclosures, a clear empty state, and an expandable semantic HTML table with
  exact localized currency values and document counts.
- Tool cards retain owner-authorized links to the finance documents used as
  chart sources. Arbitrary chart code or unvalidated model output is never
  executed or rendered.

## Verification

- Root and Convex TypeScript checks passed.
- Oxlint passed without warnings, and Oxfmt reported all files formatted.
- All 22 Vitest tests passed. Coverage includes strict specification rejection,
  empty data, 50-period input truncation, multiple currencies, negative pie
  fallback, long labels, persisted-artifact extraction, and 320-pixel mobile
  SSR with an accessible exact-value table.
- The production client, SSR, and Nitro server builds passed.
- The additive artifact schema, indexes, aggregation query, and Agent tool were
  deployed successfully to the existing Convex development deployment.
