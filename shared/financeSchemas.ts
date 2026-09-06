import { z } from 'zod'

const nullableText = z.string().trim().min(1).nullable()
const nullableMinorUnits = z.number().int().nullable()
const nullablePage = z.number().int().positive().nullable()

export const extractionEvidenceSchema = z.object({
  field: z.string().trim().min(1),
  printedValue: z.string().trim().min(1),
  sourcePage: z.number().int().positive(),
})

export const extractedDateSchema = z.object({
  printed: nullableText,
  iso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
})

export const extractedLineItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number().positive().nullable(),
  unit: nullableText,
  unitPriceMinor: nullableMinorUnits,
  discountMinor: nullableMinorUnits,
  taxRateBasisPoints: z.number().int().nullable(),
  taxMinor: nullableMinorUnits,
  totalMinor: nullableMinorUnits,
  sourcePage: nullablePage,
})

const commonDocumentShape = {
  merchantOrSupplierName: nullableText,
  supplierAddress: nullableText,
  supplierTaxIdentifier: nullableText,
  customerName: nullableText,
  customerAddress: nullableText,
  documentNumber: nullableText,
  issueDate: extractedDateSchema,
  dueDate: extractedDateSchema,
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  paymentStatus: z
    .enum(['paid', 'unpaid', 'partially_paid', 'unknown'])
    .nullable(),
  paymentMethod: nullableText,
  subtotalMinor: nullableMinorUnits,
  discountMinor: nullableMinorUnits,
  taxMinor: nullableMinorUnits,
  totalMinor: nullableMinorUnits,
  lineItems: z.array(extractedLineItemSchema).max(100),
  evidence: z.array(extractionEvidenceSchema).max(30).default([]),
  warnings: z.array(z.string().trim().min(1)).max(20),
  confidence: z.number().min(0).max(1),
}

export const receiptExtractionSchema = z.object({
  documentType: z.literal('receipt'),
  ...commonDocumentShape,
})

export const invoiceExtractionSchema = z.object({
  documentType: z.literal('invoice'),
  ...commonDocumentShape,
})

export const financeDocumentExtractionSchema = z.object({
  documentType: z.enum(['receipt', 'invoice']),
  ...commonDocumentShape,
})

export const pageBatchExtractionSchema = z.object({
  documents: z.array(financeDocumentExtractionSchema).max(4),
  multipleDocumentsDetected: z.boolean(),
  warnings: z.array(z.string().trim().min(1)).max(10),
})

// Provider constrained-decoding engines can reject otherwise valid JSON Schema
// when nested arrays carry large maxItems values or strings use regex matchers.
// Generate against this structurally identical, low-state schema, then parse the
// result with the strict schemas above before any value reaches persistence.
const modelNullableText = z.string().nullable()
const modelNullableNumber = z.number().nullable()
const modelExtractionSchema = z.object({
  documentType: z.enum(['receipt', 'invoice']),
  merchantOrSupplierName: modelNullableText,
  supplierAddress: modelNullableText,
  supplierTaxIdentifier: modelNullableText,
  customerName: modelNullableText,
  customerAddress: modelNullableText,
  documentNumber: modelNullableText,
  issueDate: z.object({ printed: modelNullableText, iso: modelNullableText }),
  dueDate: z.object({ printed: modelNullableText, iso: modelNullableText }),
  currency: modelNullableText,
  paymentStatus: z
    .enum(['paid', 'unpaid', 'partially_paid', 'unknown'])
    .nullable(),
  paymentMethod: modelNullableText,
  subtotalMinor: modelNullableNumber,
  discountMinor: modelNullableNumber,
  taxMinor: modelNullableNumber,
  totalMinor: modelNullableNumber,
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: modelNullableNumber,
      unit: modelNullableText,
      unitPriceMinor: modelNullableNumber,
      discountMinor: modelNullableNumber,
      taxRateBasisPoints: modelNullableNumber,
      taxMinor: modelNullableNumber,
      totalMinor: modelNullableNumber,
      sourcePage: modelNullableNumber,
    }),
  ),
  evidence: z.array(
    z.object({
      field: z.string(),
      printedValue: z.string(),
      sourcePage: z.number(),
    }),
  ),
  warnings: z.array(z.string()),
  confidence: z.number(),
})

export const financeDocumentModelOutputSchema = modelExtractionSchema

export const pageBatchModelOutputSchema = z.object({
  documents: z.array(modelExtractionSchema),
  multipleDocumentsDetected: z.boolean(),
  warnings: z.array(z.string()),
})

export type FinanceDocumentExtraction = z.infer<
  typeof financeDocumentExtractionSchema
>
export type PageBatchExtraction = z.infer<typeof pageBatchExtractionSchema>
