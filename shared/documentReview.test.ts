import { describe, expect, it } from 'vitest'
import {
  changedDocumentFields,
  mergeConfirmedDocumentFields,
} from './documentReview'
import { financeDocumentExtractionSchema } from './financeSchemas'

const extraction = financeDocumentExtractionSchema.parse({
  documentType: 'invoice',
  merchantOrSupplierName: 'Original supplier',
  supplierAddress: null,
  supplierTaxIdentifier: null,
  customerName: null,
  customerAddress: null,
  documentNumber: 'INV-1',
  issueDate: { printed: null, iso: null },
  dueDate: { printed: null, iso: null },
  currency: 'EUR',
  paymentStatus: 'unpaid',
  paymentMethod: null,
  subtotalMinor: 100,
  discountMinor: null,
  taxMinor: 21,
  totalMinor: 121,
  lineItems: [],
  warnings: [],
  confidence: 0.8,
})

describe('document review provenance', () => {
  it('identifies only user-edited fields', () => {
    expect(
      changedDocumentFields(extraction, {
        ...extraction,
        merchantOrSupplierName: 'Correct supplier',
        totalMinor: 125,
      }),
    ).toEqual(['merchantOrSupplierName', 'totalMinor'])
  })

  it('preserves confirmed fields across later extraction attempts', () => {
    const generated = {
      ...extraction,
      merchantOrSupplierName: 'Model changed this',
      documentNumber: 'INV-2',
    }
    expect(
      mergeConfirmedDocumentFields(generated, extraction, [
        'merchantOrSupplierName',
      ]),
    ).toMatchObject({
      merchantOrSupplierName: 'Original supplier',
      documentNumber: 'INV-2',
    })
  })
})
