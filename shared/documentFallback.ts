import { financeDocumentExtractionSchema } from './financeSchemas'
import type { FinanceDocumentExtraction } from './financeSchemas'

export type InspectedPage = {
  pageNumber: number
  text: string
  textLength: number
  needsVision: boolean
}

export type PageBatch = {
  startPage: number
  endPage: number
  pageNumbers: Array<number>
}

export type BatchExtraction = {
  startPage: number
  endPage: number
  documents: Array<FinanceDocumentExtraction>
  multipleDocumentsDetected: boolean
  warnings: Array<string>
}

const MIN_USABLE_PAGE_CHARACTERS = 40
const MAX_STORED_PAGE_CHARACTERS = 12_000

export function inspectPageTexts(pageTexts: ReadonlyArray<string>) {
  return pageTexts.map((rawText, index): InspectedPage => {
    const normalized = rawText.replaceAll(/\s+/g, ' ').trim()
    return {
      pageNumber: index + 1,
      text: normalized.slice(0, MAX_STORED_PAGE_CHARACTERS),
      textLength: normalized.length,
      needsVision: normalized.length < MIN_USABLE_PAGE_CHARACTERS,
    }
  })
}

export function createPageBatches(pageCount: number, batchSize = 4) {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) return []
  const boundedBatchSize = Math.max(1, Math.min(6, Math.trunc(batchSize)))
  const batches: Array<PageBatch> = []
  for (
    let startPage = 1;
    startPage <= pageCount;
    startPage += boundedBatchSize
  ) {
    const endPage = Math.min(pageCount, startPage + boundedBatchSize - 1)
    batches.push({
      startPage,
      endPage,
      pageNumbers: Array.from(
        { length: endPage - startPage + 1 },
        (_, index) => startPage + index,
      ),
    })
  }
  return batches
}

export function detectMultipleDocumentSignals(
  pageTexts: ReadonlyArray<string>,
) {
  const identifiers = new Set<string>()
  const pattern =
    /\b(?:invoice|receipt|credit\s+note|inv)[\s#:.-]*(?:no\.?|number|#)?[\s:.-]*([A-Z0-9][A-Z0-9/-]{2,})/gi
  for (const text of pageTexts) {
    for (const match of text.matchAll(pattern)) {
      identifiers.add(match[1].toUpperCase())
      if (identifiers.size > 1) return true
    }
  }
  return false
}

function lineItemValueKey(
  item: FinanceDocumentExtraction['lineItems'][number],
) {
  return [
    item.description.toLocaleLowerCase().replaceAll(/\s+/g, ' ').trim(),
    item.quantity,
    item.unit?.toLocaleLowerCase() ?? '',
    item.unitPriceMinor,
    item.discountMinor,
    item.taxRateBasisPoints,
    item.taxMinor,
    item.totalMinor,
  ].join('|')
}

function isRepeatedBoundaryItem(
  previous: FinanceDocumentExtraction['lineItems'][number] | undefined,
  current: FinanceDocumentExtraction['lineItems'][number],
) {
  if (!previous || lineItemValueKey(previous) !== lineItemValueKey(current)) {
    return false
  }
  if (previous.sourcePage === null || current.sourcePage === null) return false
  return Math.abs(previous.sourcePage - current.sourcePage) <= 1
}

function candidateScore(documents: ReadonlyArray<FinanceDocumentExtraction>) {
  return documents.reduce(
    (score, document) =>
      score + document.lineItems.length * 10 + document.confidence,
    documents.length * 100,
  )
}

function lastValue<T>(
  documents: ReadonlyArray<FinanceDocumentExtraction>,
  select: (document: FinanceDocumentExtraction) => T | null,
) {
  for (let index = documents.length - 1; index >= 0; index -= 1) {
    const value = select(documents[index])
    if (value !== null) return value
  }
  return null
}

function firstValue<T>(
  documents: ReadonlyArray<FinanceDocumentExtraction>,
  select: (document: FinanceDocumentExtraction) => T | null,
) {
  for (const document of documents) {
    const value = select(document)
    if (value !== null) return value
  }
  return null
}

function uniqueValues(values: Iterable<string>) {
  return [...new Set([...values].filter(Boolean))]
}

export function reconcileBatchExtractions(
  batches: ReadonlyArray<BatchExtraction>,
) {
  const orderedBatches = [...batches]
  // This function owns the fresh array it sorts.
  // oxlint-disable-next-line unicorn/no-array-sort
  orderedBatches.sort(
    (left, right) =>
      left.startPage - right.startPage || left.endPage - right.endPage,
  )
  const candidates = orderedBatches.flatMap((batch) => batch.documents)
  if (candidates.length === 0) {
    throw new Error(
      'Fallback extraction returned no finance document candidates',
    )
  }

  const knownNumbers = uniqueValues(
    candidates.flatMap((candidate) =>
      candidate.documentNumber ? [candidate.documentNumber] : [],
    ),
  )
  const groups = new Map<string, Array<FinanceDocumentExtraction>>()
  const defaultKey = knownNumbers[0]?.toLocaleLowerCase() ?? 'unidentified'
  for (const candidate of candidates) {
    const key = candidate.documentNumber?.toLocaleLowerCase() ?? defaultKey
    const group = groups.get(key) ?? []
    group.push(candidate)
    groups.set(key, group)
  }
  const rankedGroups = [...groups.values()]
  // This function owns the fresh array it sorts.
  // oxlint-disable-next-line unicorn/no-array-sort
  rankedGroups.sort(
    (left, right) => candidateScore(right) - candidateScore(left),
  )
  const selected = rankedGroups[0]
  const multipleDocumentsDetected =
    groups.size > 1 ||
    orderedBatches.some(
      (batch) => batch.multipleDocumentsDetected || batch.documents.length > 1,
    )

  const lineItems = []
  const seenLineItems = new Set<string>()
  let previousCandidateLastItem:
    | FinanceDocumentExtraction['lineItems'][number]
    | undefined
  for (const document of selected) {
    for (const [itemIndex, item] of document.lineItems.entries()) {
      const key = `${lineItemValueKey(item)}|${item.sourcePage}`
      if (seenLineItems.has(key)) continue
      if (
        itemIndex === 0 &&
        isRepeatedBoundaryItem(previousCandidateLastItem, item)
      ) {
        continue
      }
      seenLineItems.add(key)
      lineItems.push(item)
    }
    previousCandidateLastItem =
      document.lineItems[document.lineItems.length - 1]
  }
  const evidence = []
  const seenEvidence = new Set<string>()
  for (const document of selected) {
    for (const item of document.evidence) {
      const key = `${item.field}|${item.printedValue}|${item.sourcePage}`
      if (seenEvidence.has(key)) continue
      seenEvidence.add(key)
      evidence.push(item)
    }
  }

  const warnings = uniqueValues([
    ...orderedBatches.flatMap((batch) => batch.warnings),
    ...selected.flatMap((document) => document.warnings),
    ...(multipleDocumentsDetected
      ? [
          'Multiple finance documents may be present. The strongest candidate was retained for review.',
        ]
      : []),
  ]).slice(0, 20)
  const extraction = financeDocumentExtractionSchema.parse({
    documentType: selected[0].documentType,
    merchantOrSupplierName: firstValue(
      selected,
      (document) => document.merchantOrSupplierName,
    ),
    supplierAddress: firstValue(
      selected,
      (document) => document.supplierAddress,
    ),
    supplierTaxIdentifier: firstValue(
      selected,
      (document) => document.supplierTaxIdentifier,
    ),
    customerName: firstValue(selected, (document) => document.customerName),
    customerAddress: firstValue(
      selected,
      (document) => document.customerAddress,
    ),
    documentNumber: firstValue(selected, (document) => document.documentNumber),
    issueDate:
      selected.find((document) => document.issueDate.iso)?.issueDate ??
      selected[0].issueDate,
    dueDate:
      selected.find((document) => document.dueDate.iso)?.dueDate ??
      selected[0].dueDate,
    currency: firstValue(selected, (document) => document.currency),
    paymentStatus: lastValue(selected, (document) => document.paymentStatus),
    paymentMethod: firstValue(selected, (document) => document.paymentMethod),
    subtotalMinor: lastValue(selected, (document) => document.subtotalMinor),
    discountMinor: lastValue(selected, (document) => document.discountMinor),
    taxMinor: lastValue(selected, (document) => document.taxMinor),
    totalMinor: lastValue(selected, (document) => document.totalMinor),
    lineItems: lineItems.slice(0, 100),
    evidence: evidence.slice(0, 30),
    warnings,
    confidence:
      selected.reduce((sum, document) => sum + document.confidence, 0) /
      selected.length,
  })
  return { extraction, multipleDocumentsDetected }
}
