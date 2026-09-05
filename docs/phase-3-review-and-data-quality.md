# Phase 3 review and data quality

Phase 3 adds a complete human-review loop to the authenticated document detail
page.

## Review experience

- The original private PDF or image is shown beside the extracted data. The
  signed storage URL is returned only by the owner-authorized detail query.
- Header fields, dates, currency, payment state, totals, and line items are
  editable. Line items include one-based source-page references.
- New extraction results include exact printed evidence for important header
  fields and totals, with page-range validation.
- Each editable field is labelled as AI-extracted or user-confirmed. Saving
  records only fields that actually changed; approving confirms the complete
  reviewed result.
- Save keeps the document in `needs_review`. Save and approve succeeds only
  after deterministic validation passes.

## Data safeguards

- Confirmed fields are merged into later extraction attempts so retries cannot
  silently overwrite reviewed values. The immutable extraction record keeps
  both raw model output and the normalized, confirmed-field-aware output.
- Retry is restricted to failed or review-required documents and capped at
  three total attempts.
- Delete requires a browser confirmation, is owner-authorized, removes the
  private storage object and bounded job/extraction history, and leaves a
  deletion audit event.
- Duplicate registration uses owner, SHA-256, and extraction schema version. A
  duplicate upload returns the existing document and deletes only the redundant
  newly uploaded storage object, without creating a second processing job.
- Append-only audit events cover upload, duplicate detection, processing start,
  completion/failure, review save, approval, retry, and deletion. The newest 20
  events appear on the detail page.

Preview, mutations, document data, and audit reads all derive ownership from the
authenticated Convex identity rather than client-supplied user identifiers.

## Verification

- TypeScript, Oxlint, and Oxfmt checks passed without warnings.
- All 13 Vitest tests passed, including field-provenance merging and evidence
  page validation.
- Production client, SSR, and Nitro builds passed.
- The additive schema, hash-deduplication index, audit index, and functions were
  deployed successfully to the existing Convex development deployment.
