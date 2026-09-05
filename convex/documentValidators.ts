import { v } from 'convex/values'

export const acceptedMimeTypeValidator = v.union(
  v.literal('application/pdf'),
  v.literal('image/jpeg'),
  v.literal('image/png'),
  v.literal('image/webp'),
)

export const documentStatusValidator = v.union(
  v.literal('queued'),
  v.literal('processing'),
  v.literal('completed'),
  v.literal('needs_review'),
  v.literal('failed'),
)

export const processingStageValidator = v.union(
  v.literal('queued'),
  v.literal('downloading'),
  v.literal('extracting'),
  v.literal('validating'),
  v.literal('completed'),
  v.literal('failed'),
)

const extractedDateValidator = v.object({
  printed: v.union(v.string(), v.null()),
  iso: v.union(v.string(), v.null()),
})

const extractedLineItemValidator = v.object({
  description: v.string(),
  quantity: v.union(v.number(), v.null()),
  unit: v.union(v.string(), v.null()),
  unitPriceMinor: v.union(v.number(), v.null()),
  discountMinor: v.union(v.number(), v.null()),
  taxRateBasisPoints: v.union(v.number(), v.null()),
  taxMinor: v.union(v.number(), v.null()),
  totalMinor: v.union(v.number(), v.null()),
  sourcePage: v.union(v.number(), v.null()),
})

const extractionEvidenceValidator = v.object({
  field: v.string(),
  printedValue: v.string(),
  sourcePage: v.number(),
})

export const editableDocumentFieldValidator = v.union(
  v.literal('documentType'),
  v.literal('merchantOrSupplierName'),
  v.literal('supplierAddress'),
  v.literal('supplierTaxIdentifier'),
  v.literal('customerName'),
  v.literal('customerAddress'),
  v.literal('documentNumber'),
  v.literal('issueDate'),
  v.literal('dueDate'),
  v.literal('currency'),
  v.literal('paymentStatus'),
  v.literal('paymentMethod'),
  v.literal('subtotalMinor'),
  v.literal('discountMinor'),
  v.literal('taxMinor'),
  v.literal('totalMinor'),
  v.literal('lineItems'),
)

export const documentAuditActionValidator = v.union(
  v.literal('uploaded'),
  v.literal('duplicate_detected'),
  v.literal('processing_started'),
  v.literal('processing_completed'),
  v.literal('processing_failed'),
  v.literal('review_saved'),
  v.literal('approved'),
  v.literal('retry_queued'),
  v.literal('deleted'),
)

const commonExtractionFields = {
  merchantOrSupplierName: v.union(v.string(), v.null()),
  supplierAddress: v.union(v.string(), v.null()),
  supplierTaxIdentifier: v.union(v.string(), v.null()),
  customerName: v.union(v.string(), v.null()),
  customerAddress: v.union(v.string(), v.null()),
  documentNumber: v.union(v.string(), v.null()),
  issueDate: extractedDateValidator,
  dueDate: extractedDateValidator,
  currency: v.union(v.string(), v.null()),
  paymentStatus: v.union(
    v.literal('paid'),
    v.literal('unpaid'),
    v.literal('partially_paid'),
    v.literal('unknown'),
    v.null(),
  ),
  paymentMethod: v.union(v.string(), v.null()),
  subtotalMinor: v.union(v.number(), v.null()),
  discountMinor: v.union(v.number(), v.null()),
  taxMinor: v.union(v.number(), v.null()),
  totalMinor: v.union(v.number(), v.null()),
  lineItems: v.array(extractedLineItemValidator),
  evidence: v.optional(v.array(extractionEvidenceValidator)),
  warnings: v.array(v.string()),
  confidence: v.number(),
}

export const financeDocumentExtractionValidator = v.union(
  v.object({
    documentType: v.literal('receipt'),
    ...commonExtractionFields,
  }),
  v.object({
    documentType: v.literal('invoice'),
    ...commonExtractionFields,
  }),
)

export const usageValidator = v.object({
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
})
