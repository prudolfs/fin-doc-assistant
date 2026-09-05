# Phase 2 document lifecycle

Phase 2 turns the Phase 0 extraction spike into an authenticated document
workflow.

## Implemented flow

1. An authenticated user selects or drops up to the server-configured number of
   PDF, JPEG, PNG, or WebP files.
2. The client validates MIME type and size, requests a short-lived Convex upload
   URL for each valid file, and reports real upload progress.
3. Each private storage object is registered as an owner-scoped document. The
   registration mutation creates an idempotent job and schedules the internal
   processing action.
4. The action validates the file signature and page limit, performs structured
   whole-document receipt or invoice extraction, runs schema and deterministic
   arithmetic validation, and persists the result and processing metrics.
5. Convex subscriptions update the document collection and detail page as the
   job moves through queued, downloading, extracting, validating, and terminal
   states.

The detail query returns only records owned by the current authentication token
and treats malformed, missing, and unauthorized document IDs identically.

## User-facing routes

- `/app/documents/new` — multi-file drop zone, client validation, progress, and
  independent failure state.
- `/app/documents` — paginated realtime collection with status and extracted
  totals.
- `/app/documents/$documentId` — realtime lifecycle, extracted summary, line
  items, review notes, validated JSON, and processing metrics.

Document preview, corrections, retries, deletion, and duplicate handling remain
explicitly scoped to Phase 3.

## Verification

- Production client, SSR, and Nitro build passed.
- TypeScript, Oxlint, and Oxfmt checks passed.
- All 10 Vitest tests passed, including new upload file validation coverage.
- Convex functions deployed successfully to the existing development
  deployment.
