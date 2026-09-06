import { describe, expect, it } from 'vitest'
import {
  createPageBatches,
  detectMultipleDocumentSignals,
  inspectPageTexts,
  reconcileBatchExtractions,
} from './documentFallback'
import { financeDocumentExtractionSchema } from './financeSchemas'

function invoice(
  overrides: Partial<ReturnType<typeof financeDocumentExtractionSchema.parse>>,
) {
  return financeDocumentExtractionSchema.parse({
    documentType: 'invoice',
    merchantOrSupplierName: null,
    supplierAddress: null,
    supplierTaxIdentifier: null,
    customerName: null,
    customerAddress: null,
    documentNumber: 'INV-100',
    issueDate: { printed: null, iso: null },
    dueDate: { printed: null, iso: null },
    currency: 'EUR',
    paymentStatus: 'unknown',
    paymentMethod: null,
    subtotalMinor: null,
    discountMinor: null,
    taxMinor: null,
    totalMinor: null,
    lineItems: [],
    evidence: [],
    warnings: [],
    confidence: 0.8,
    ...overrides,
  })
}

function lineItem(description: string, sourcePage: number) {
  return {
    description,
    quantity: 1,
    unit: 'item',
    unitPriceMinor: 1_000,
    discountMinor: 0,
    taxRateBasisPoints: 0,
    taxMinor: 0,
    totalMinor: 1_000,
    sourcePage,
  }
}

describe('PDF page planning', () => {
  it('marks pages without usable embedded text for vision', () => {
    const pages = inspectPageTexts([
      'scan',
      'Invoice INV-100 contains enough embedded text for deterministic inspection.',
    ])

    expect(pages.map((page) => page.needsVision)).toEqual([true, false])
    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2])
  })

  it('creates bounded original-page-numbered batches', () => {
    expect(createPageBatches(10, 4)).toEqual([
      { startPage: 1, endPage: 4, pageNumbers: [1, 2, 3, 4] },
      { startPage: 5, endPage: 8, pageNumbers: [5, 6, 7, 8] },
      { startPage: 9, endPage: 10, pageNumbers: [9, 10] },
    ])
  })

  it('detects distinct finance-document identifiers', () => {
    expect(
      detectMultipleDocumentSignals([
        'Invoice no. INV-100',
        'continued invoice INV-100',
      ]),
    ).toBe(false)
    expect(
      detectMultipleDocumentSignals(['Invoice INV-100', 'Receipt RCPT-9']),
    ).toBe(true)
  })
})

describe('page-batch reconciliation', () => {
  it('merges headers and totals while removing a repeated boundary line item', () => {
    const repeated = lineItem('Consulting', 1)
    const result = reconcileBatchExtractions([
      {
        startPage: 1,
        endPage: 1,
        documents: [
          invoice({
            merchantOrSupplierName: 'Example SIA',
            issueDate: { printed: '01.08.2026', iso: '2026-08-01' },
            lineItems: [repeated],
          }),
        ],
        multipleDocumentsDetected: false,
        warnings: [],
      },
      {
        startPage: 2,
        endPage: 2,
        documents: [
          invoice({
            subtotalMinor: 2_000,
            taxMinor: 0,
            totalMinor: 2_000,
            lineItems: [{ ...repeated, sourcePage: 2 }, lineItem('Support', 2)],
            evidence: [
              { field: 'totalMinor', printedValue: '20.00 EUR', sourcePage: 2 },
            ],
          }),
        ],
        multipleDocumentsDetected: false,
        warnings: [],
      },
    ])

    expect(result.multipleDocumentsDetected).toBe(false)
    expect(result.extraction.merchantOrSupplierName).toBe('Example SIA')
    expect(result.extraction.totalMinor).toBe(2_000)
    expect(result.extraction.lineItems.map((item) => item.description)).toEqual(
      ['Consulting', 'Support'],
    )
    expect(result.extraction.evidence).toHaveLength(1)
  })

  it('retains the strongest candidate and flags multiple documents', () => {
    const result = reconcileBatchExtractions([
      {
        startPage: 1,
        endPage: 2,
        documents: [
          invoice({
            documentNumber: 'INV-100',
            lineItems: [lineItem('A', 1), lineItem('B', 2)],
          }),
          invoice({ documentNumber: 'INV-200' }),
        ],
        multipleDocumentsDetected: true,
        warnings: [],
      },
    ])

    expect(result.multipleDocumentsDetected).toBe(true)
    expect(result.extraction.documentNumber).toBe('INV-100')
    expect(result.extraction.warnings.join(' ')).toContain(
      'Multiple finance documents',
    )
  })
})
