# Phase 6 — advanced invoice fallback

Phase 6 adds an adaptive PDF path around the existing whole-document extraction. Ordinary short, text-rich PDFs still use one model request. The fallback is selected when a PDF is long, contains a page without usable embedded text, appears to contain multiple documents, fails direct extraction, or produces a direct result that fails deterministic validation.

## Processing flow

1. PDFium WebAssembly inspects the page count and extracts embedded text per page. The configured page limit is enforced before page text is processed.
2. Pages are split into batches of four while preserving their original page numbers.
3. Text-rich batches use a small PDF containing only that batch. Scan-only pages are rendered to bounded 1,600-pixel-wide PNGs and supplied to the multimodal model alongside any available embedded text.
4. Each batch returns zero or more validated finance-document candidates, warnings, and a multiple-document signal.
5. Reconciliation groups candidates by document number, keeps the strongest document when unrelated documents are present, combines early-page headers with later-page totals, and merges evidence.
6. Exact duplicate line items are removed. A repeated item at the boundary between adjacent page batches is also removed when its normalized financial values match.
7. The reconciled result runs through the same schema, page-provenance, arithmetic, and business-rule validation as direct extraction. Multiple-document results always require review.

## Persisted provenance

`documentPages` stores the owner, document, original page number, extraction source (`embedded_text` or `vision`), bounded embedded text, and model confidence for vision-processed pages. Rendered page PNGs are transient request data and are not written to storage, avoiding a separate image-retention lifecycle.

The final document and immutable extraction attempt record whether `direct` or `pdf_fallback` processing was used and whether multiple documents were detected. Removing a document also removes its page records.

## Limits and cost controls

- Existing `DOCUMENT_MAX_PAGES` configuration remains the hard PDF limit.
- Page batches contain at most four pages; the shared batching helper enforces an upper bound of six.
- Only pages without usable embedded text are rasterized during normal fallback. A complete render is reserved for a direct-PDF provider failure.
- Rendering has a 16,777,216-pixel allocation ceiling per page.
- Embedded page text is normalized and capped at 12,000 stored characters.

## Verification

Automated coverage includes real two-page PDF text inspection, selected-page PDF creation, PNG rendering and signature validation, scan-page routing, bounded batching, distinct document-number signals, cross-batch header/total reconciliation, evidence merging, strongest-candidate selection, and boundary line-item deduplication.

The implementation is ready for the difficult production invoice set. The Phase 6 exit criterion still requires that representative set and an agreed accuracy target; neither is encoded in this repository, so no production accuracy claim is made here.
