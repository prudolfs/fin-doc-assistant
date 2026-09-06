/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import {
  compareCurrencyTotals,
  totalsByCurrency,
} from '../shared/financeCalculations'
import { internalQuery } from './_generated/server'
import { financeDocumentExtractionValidator } from './documentValidators'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

const sourceValidator = v.object({
  documentId: v.id('documents'),
  originalFilename: v.string(),
  supplier: v.union(v.string(), v.null()),
  documentType: v.union(v.literal('receipt'), v.literal('invoice'), v.null()),
  issueDate: v.union(v.string(), v.null()),
  dueDate: v.union(v.string(), v.null()),
  currency: v.union(v.string(), v.null()),
  totalMinor: v.union(v.number(), v.null()),
  taxMinor: v.union(v.number(), v.null()),
  status: v.string(),
  sourceUrl: v.string(),
})

const currencyTotalValidator = v.object({
  currency: v.string(),
  totalMinor: v.number(),
  taxMinor: v.number(),
  documentCount: v.number(),
})

const boundedMetaFields = {
  documentsConsidered: v.number(),
  truncated: v.boolean(),
}

async function ownerDocuments(ctx: QueryCtx, ownerTokenIdentifier: string) {
  const documents = await ctx.db
    .query('documents')
    .withIndex('by_ownerTokenIdentifier_and_createdAt', (q) =>
      q.eq('ownerTokenIdentifier', ownerTokenIdentifier),
    )
    .order('desc')
    .take(501)
  return {
    documents: documents.slice(0, 500),
    truncated: documents.length > 500,
  }
}

function usable(document: Doc<'documents'>) {
  return (
    (document.status === 'completed' || document.status === 'needs_review') &&
    document.structuredResult !== undefined
  )
}

function inRange(
  document: Doc<'documents'>,
  fromDate?: string,
  toDate?: string,
) {
  const date = document.issueDate
  if (!date) return !fromDate && !toDate
  return (!fromDate || date >= fromDate) && (!toDate || date <= toDate)
}

function source(document: Doc<'documents'>) {
  return {
    documentId: document._id,
    originalFilename: document.originalFilename,
    supplier: document.merchantOrSupplierName ?? null,
    documentType: document.documentType ?? null,
    issueDate: document.issueDate ?? null,
    dueDate: document.dueDate ?? null,
    currency: document.currency ?? null,
    totalMinor: document.totalMinor ?? null,
    taxMinor: document.taxMinor ?? null,
    status: document.status,
    sourceUrl: `/app/documents/${document._id}`,
  }
}

export const searchFinanceDocuments = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    text: v.optional(v.string()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    documentType: v.optional(
      v.union(v.literal('receipt'), v.literal('invoice')),
    ),
    status: v.optional(
      v.union(
        v.literal('completed'),
        v.literal('needs_review'),
        v.literal('failed'),
      ),
    ),
    minAmountMinor: v.optional(v.number()),
    maxAmountMinor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    documents: v.array(sourceValidator),
    ...boundedMetaFields,
  }),
  handler: async (ctx, args) => {
    const { documents, truncated } = await ownerDocuments(
      ctx,
      args.ownerTokenIdentifier,
    )
    const needle = args.text?.trim().toLocaleLowerCase()
    const limit = Math.max(1, Math.min(20, Math.trunc(args.limit ?? 10)))
    const matches = documents.filter((document) => {
      const searchable =
        `${document.merchantOrSupplierName ?? ''} ${document.documentNumber ?? ''} ${document.originalFilename}`.toLocaleLowerCase()
      return (
        (!needle || searchable.includes(needle)) &&
        inRange(document, args.fromDate, args.toDate) &&
        (!args.documentType || document.documentType === args.documentType) &&
        (!args.status || document.status === args.status) &&
        (args.minAmountMinor === undefined ||
          (document.totalMinor ?? Number.NEGATIVE_INFINITY) >=
            args.minAmountMinor) &&
        (args.maxAmountMinor === undefined ||
          (document.totalMinor ?? Number.POSITIVE_INFINITY) <=
            args.maxAmountMinor)
      )
    })
    return {
      documents: matches.slice(0, limit).map(source),
      documentsConsidered: documents.length,
      truncated,
    }
  },
})

export const getFinanceDocument = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    documentId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      source: sourceValidator,
      extraction: financeDocumentExtractionValidator,
      validationErrors: v.array(v.string()),
      confirmedFields: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const documentId = ctx.db.normalizeId('documents', args.documentId)
    if (!documentId) return null
    const document = await ctx.db.get('documents', documentId)
    if (
      !document ||
      document.ownerTokenIdentifier !== args.ownerTokenIdentifier ||
      !document.structuredResult
    ) {
      return null
    }
    return {
      source: source(document),
      extraction: document.structuredResult,
      validationErrors: document.validationErrors,
      confirmedFields: document.confirmedFields ?? [],
    }
  },
})

export const getSpendingSummary = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  returns: v.object({
    totals: v.array(currencyTotalValidator),
    sources: v.array(sourceValidator),
    ...boundedMetaFields,
  }),
  handler: async (ctx, args) => {
    const result = await ownerDocuments(ctx, args.ownerTokenIdentifier)
    const documents = result.documents.filter(
      (document) =>
        usable(document) && inRange(document, args.fromDate, args.toDate),
    )
    return {
      totals: totalsByCurrency(documents),
      sources: documents.slice(0, 20).map(source),
      documentsConsidered: result.documents.length,
      truncated: result.truncated,
    }
  },
})

export const getIncomeAndExpenseSummary = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  returns: v.object({
    expenses: v.array(currencyTotalValidator),
    income: v.array(currencyTotalValidator),
    notes: v.array(v.string()),
    sources: v.array(sourceValidator),
    ...boundedMetaFields,
  }),
  handler: async (ctx, args) => {
    const result = await ownerDocuments(ctx, args.ownerTokenIdentifier)
    const documents = result.documents.filter(
      (document) =>
        usable(document) && inRange(document, args.fromDate, args.toDate),
    )
    return {
      expenses: totalsByCurrency(documents),
      income: [],
      notes: [
        'Uploaded receipts and supplier invoices are treated as expenses; this dataset has no income-document classification.',
      ],
      sources: documents.slice(0, 20).map(source),
      documentsConsidered: result.documents.length,
      truncated: result.truncated,
    }
  },
})

export const getSupplierSummary = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    supplier: v.optional(v.string()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  returns: v.object({
    suppliers: v.array(
      v.object({
        supplier: v.string(),
        currency: v.string(),
        totalMinor: v.number(),
        invoiceCount: v.number(),
        averageMinor: v.number(),
        outstandingMinor: v.number(),
      }),
    ),
    sources: v.array(sourceValidator),
    ...boundedMetaFields,
  }),
  handler: async (ctx, args) => {
    const result = await ownerDocuments(ctx, args.ownerTokenIdentifier)
    const supplierNeedle = args.supplier?.toLocaleLowerCase()
    const documents = result.documents.filter(
      (document) =>
        usable(document) &&
        inRange(document, args.fromDate, args.toDate) &&
        (!supplierNeedle ||
          document.merchantOrSupplierName
            ?.toLocaleLowerCase()
            .includes(supplierNeedle)),
    )
    const grouped = new Map<
      string,
      {
        supplier: string
        currency: string
        totalMinor: number
        invoiceCount: number
        outstandingMinor: number
      }
    >()
    for (const document of documents) {
      const supplier = document.merchantOrSupplierName ?? 'Unknown supplier'
      const currency = document.currency ?? 'UNKNOWN'
      const paymentStatus = document.structuredResult?.paymentStatus
      const key = `${supplier}\u0000${currency}`
      const current = grouped.get(key) ?? {
        supplier,
        currency,
        totalMinor: 0,
        invoiceCount: 0,
        outstandingMinor: 0,
      }
      current.totalMinor += document.totalMinor ?? 0
      current.invoiceCount += 1
      if (
        document.documentType === 'invoice' &&
        (paymentStatus === 'unpaid' || paymentStatus === 'partially_paid')
      ) {
        current.outstandingMinor += document.totalMinor ?? 0
      }
      grouped.set(key, current)
    }
    const suppliers = [...grouped.values()].map((item) => ({
      ...item,
      averageMinor: Math.round(item.totalMinor / item.invoiceCount),
    }))
    // This is a fresh result array, so the sort cannot mutate stored data.
    // oxlint-disable-next-line unicorn/no-array-sort
    suppliers.sort((left, right) => right.totalMinor - left.totalMinor)
    return {
      suppliers: suppliers.slice(0, 20),
      sources: documents.slice(0, 20).map(source),
      documentsConsidered: result.documents.length,
      truncated: result.truncated,
    }
  },
})

export const getTaxSummary = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  returns: v.object({
    totals: v.array(currencyTotalValidator),
    byRate: v.array(
      v.object({
        currency: v.string(),
        rateBasisPoints: v.number(),
        taxMinor: v.number(),
      }),
    ),
    disclaimer: v.string(),
    sources: v.array(sourceValidator),
    ...boundedMetaFields,
  }),
  handler: async (ctx, args) => {
    const result = await ownerDocuments(ctx, args.ownerTokenIdentifier)
    const documents = result.documents.filter(
      (document) =>
        usable(document) && inRange(document, args.fromDate, args.toDate),
    )
    const rates = new Map<string, number>()
    for (const document of documents) {
      for (const item of document.structuredResult?.lineItems ?? []) {
        if (item.taxRateBasisPoints === null || item.taxMinor === null) continue
        const currency = document.currency ?? 'UNKNOWN'
        const key = `${currency}:${item.taxRateBasisPoints}`
        rates.set(key, (rates.get(key) ?? 0) + item.taxMinor)
      }
    }
    return {
      totals: totalsByCurrency(documents),
      byRate: [...rates.entries()].map(([key, taxMinor]) => {
        const [currency, rate] = key.split(':')
        return { currency, rateBasisPoints: Number(rate), taxMinor }
      }),
      disclaimer: 'Document-derived information only; not tax advice.',
      sources: documents.slice(0, 20).map(source),
      documentsConsidered: result.documents.length,
      truncated: result.truncated,
    }
  },
})

export const getOutstandingInvoices = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    fromDueDate: v.optional(v.string()),
    toDueDate: v.optional(v.string()),
  },
  returns: v.object({
    invoices: v.array(sourceValidator),
    ...boundedMetaFields,
  }),
  handler: async (ctx, args) => {
    const result = await ownerDocuments(ctx, args.ownerTokenIdentifier)
    const invoices = result.documents.filter((document) => {
      const paymentStatus = document.structuredResult?.paymentStatus
      return (
        usable(document) &&
        document.documentType === 'invoice' &&
        (paymentStatus === 'unpaid' || paymentStatus === 'partially_paid') &&
        (!args.fromDueDate || (document.dueDate ?? '') >= args.fromDueDate) &&
        (!args.toDueDate || (document.dueDate ?? '') <= args.toDueDate)
      )
    })
    return {
      invoices: invoices.slice(0, 20).map(source),
      documentsConsidered: result.documents.length,
      truncated: result.truncated,
    }
  },
})

export const comparePeriods = internalQuery({
  args: {
    ownerTokenIdentifier: v.string(),
    firstFromDate: v.string(),
    firstToDate: v.string(),
    secondFromDate: v.string(),
    secondToDate: v.string(),
  },
  returns: v.object({
    firstPeriod: v.array(currencyTotalValidator),
    secondPeriod: v.array(currencyTotalValidator),
    changes: v.array(
      v.object({
        currency: v.string(),
        absoluteMinor: v.number(),
        percentage: v.union(v.number(), v.null()),
      }),
    ),
    sources: v.array(sourceValidator),
    ...boundedMetaFields,
  }),
  handler: async (ctx, args) => {
    const result = await ownerDocuments(ctx, args.ownerTokenIdentifier)
    const usableDocuments = result.documents.filter(usable)
    const firstDocuments = usableDocuments.filter((document) =>
      inRange(document, args.firstFromDate, args.firstToDate),
    )
    const secondDocuments = usableDocuments.filter((document) =>
      inRange(document, args.secondFromDate, args.secondToDate),
    )
    const firstPeriod = totalsByCurrency(firstDocuments)
    const secondPeriod = totalsByCurrency(secondDocuments)
    return {
      firstPeriod,
      secondPeriod,
      changes: compareCurrencyTotals(firstPeriod, secondPeriod),
      sources: [...firstDocuments, ...secondDocuments].slice(0, 20).map(source),
      documentsConsidered: result.documents.length,
      truncated: result.truncated,
    }
  },
})
