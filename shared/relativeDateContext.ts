export function relativeDateContext(now: Date) {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const currentDate = now.toISOString().slice(0, 10)
  const monthStart = new Date(Date.UTC(year, month, 1))
    .toISOString()
    .slice(0, 10)
  const monthEnd = new Date(Date.UTC(year, month + 1, 0))
    .toISOString()
    .slice(0, 10)
  return `Current UTC date: ${currentDate}.
For “this month”, use the inclusive issue-date range ${monthStart} through ${monthEnd}.
Do not ask the user for the current date, month, or year when resolving a relative date from this context.`
}
