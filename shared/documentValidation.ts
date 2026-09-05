import type { FinanceDocumentExtraction } from './financeSchemas'

const MONEY_TOLERANCE_MINOR = 2

function differsByMoreThanTolerance(left: number, right: number) {
  return Math.abs(left - right) > MONEY_TOLERANCE_MINOR
}

export function validateDocumentExtraction(
  extraction: FinanceDocumentExtraction,
  pageCount: number,
) {
  const errors: string[] = []

  if (!extraction.merchantOrSupplierName) {
    errors.push('Merchant or supplier name is missing.')
  }
  if (extraction.documentType === 'invoice' && !extraction.documentNumber) {
    errors.push('Invoice number is missing.')
  }
  if (extraction.totalMinor === null) {
    errors.push('Grand total is missing.')
  }

  if (
    extraction.subtotalMinor !== null &&
    extraction.taxMinor !== null &&
    extraction.totalMinor !== null
  ) {
    const expectedTotal =
      extraction.subtotalMinor -
      (extraction.discountMinor ?? 0) +
      extraction.taxMinor
    if (differsByMoreThanTolerance(expectedTotal, extraction.totalMinor)) {
      errors.push('Subtotal minus discount plus tax does not match the total.')
    }
  }

  const lineTotal = extraction.lineItems.reduce<number | null>(
    (total, item) =>
      total === null || item.totalMinor === null
        ? null
        : total + item.totalMinor,
    0,
  )
  if (
    lineTotal !== null &&
    extraction.lineItems.length > 0 &&
    extraction.subtotalMinor !== null &&
    differsByMoreThanTolerance(lineTotal, extraction.subtotalMinor)
  ) {
    errors.push('Line-item totals do not match the subtotal.')
  }

  const issueDate = extraction.issueDate.iso
  const dueDate = extraction.dueDate.iso
  if (issueDate && dueDate && dueDate < issueDate) {
    errors.push('Due date is earlier than the issue date.')
  }

  if (
    extraction.lineItems.some(
      (item) => item.sourcePage !== null && item.sourcePage > pageCount,
    )
  ) {
    errors.push('A line-item source page is outside the document page range.')
  }

  if (extraction.evidence.some((item) => item.sourcePage > pageCount)) {
    errors.push('An evidence source page is outside the document page range.')
  }

  return errors
}

export function estimateModelCostUsd(
  model: string,
  usage: { inputTokens?: number; outputTokens?: number },
  prices: Record<string, { input: number; output: number }>,
) {
  const price = prices[model]
  if (!price) return null
  return (
    (usage.inputTokens ?? 0) * price.input +
    (usage.outputTokens ?? 0) * price.output
  )
}
