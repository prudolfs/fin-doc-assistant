import { describe, expect, it } from 'vitest'
import {
  estimateModelCostUsd,
  validateDocumentExtraction,
} from './documentValidation'
import { financeDocumentExtractionSchema } from './financeSchemas'

const validInvoice = financeDocumentExtractionSchema.parse({
  documentType: 'invoice',
  merchantOrSupplierName: 'Northwind Office SIA',
  supplierAddress: 'Riga, Latvia',
  supplierTaxIdentifier: 'LV12345678901',
  customerName: 'Example Customer',
  customerAddress: null,
  documentNumber: 'INV-1001',
  issueDate: { printed: '2026-08-01', iso: '2026-08-01' },
  dueDate: { printed: '2026-08-15', iso: '2026-08-15' },
  currency: 'EUR',
  paymentStatus: 'unpaid',
  paymentMethod: null,
  subtotalMinor: 1000,
  discountMinor: 0,
  taxMinor: 210,
  totalMinor: 1210,
  lineItems: [
    {
      description: 'Paper',
      quantity: 1,
      unit: 'pack',
      unitPriceMinor: 1000,
      discountMinor: 0,
      taxRateBasisPoints: 2100,
      taxMinor: 210,
      totalMinor: 1000,
      sourcePage: 1,
    },
  ],
  warnings: [],
  confidence: 0.99,
})

describe('validateDocumentExtraction', () => {
  it('accepts arithmetically consistent invoice data', () => {
    expect(validateDocumentExtraction(validInvoice, 1)).toEqual([])
  })

  it('routes inconsistent totals to review', () => {
    expect(
      validateDocumentExtraction({ ...validInvoice, totalMinor: 999 }, 1),
    ).toContain('Subtotal minus discount plus tax does not match the total.')
  })

  it('rejects source pages beyond the document', () => {
    const extraction = {
      ...validInvoice,
      lineItems: [{ ...validInvoice.lineItems[0], sourcePage: 2 }],
    }
    expect(validateDocumentExtraction(extraction, 1)).toContain(
      'A line-item source page is outside the document page range.',
    )
  })
})

describe('estimateModelCostUsd', () => {
  it('uses per-token input and output rates', () => {
    expect(
      estimateModelCostUsd(
        'model',
        { inputTokens: 1_000, outputTokens: 100 },
        { model: { input: 0.1 / 1_000_000, output: 0.4 / 1_000_000 } },
      ),
    ).toBeCloseTo(0.00014)
  })
})
