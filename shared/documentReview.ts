import type { FinanceDocumentExtraction } from './financeSchemas'

export const editableDocumentFields = [
  'documentType',
  'merchantOrSupplierName',
  'supplierAddress',
  'supplierTaxIdentifier',
  'customerName',
  'customerAddress',
  'documentNumber',
  'issueDate',
  'dueDate',
  'currency',
  'paymentStatus',
  'paymentMethod',
  'subtotalMinor',
  'discountMinor',
  'taxMinor',
  'totalMinor',
  'lineItems',
] as const

export type EditableDocumentField = (typeof editableDocumentFields)[number]

export function changedDocumentFields(
  previous: FinanceDocumentExtraction,
  next: FinanceDocumentExtraction,
) {
  return editableDocumentFields.filter(
    (field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]),
  )
}

export function mergeConfirmedDocumentFields(
  generated: FinanceDocumentExtraction,
  existing: FinanceDocumentExtraction,
  confirmedFields: ReadonlyArray<EditableDocumentField>,
) {
  const merged = { ...generated }
  for (const field of confirmedFields) {
    Object.assign(merged, { [field]: existing[field] })
  }
  return merged
}
