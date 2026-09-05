# Phase 0 validation report

Validated on 2026-09-06 with Convex 1.45.0, AI SDK 7.0.92, and Vercel AI
Gateway 4.0.54.

## Decision

- Initial model: `google/gemini-2.5-flash-lite` through Vercel AI Gateway.
- Limits: 5 files per browser selection, 10 MiB per file, and 50 PDF pages.
- Accepted formats: PDF, PNG, JPEG, and WebP, checked by MIME type, filename
  extension, storage metadata, and byte signature.
- Whole-document processing is the only Phase 0 path. A document is rejected or
  marked failed when it is unsupported, encrypted, too large, over the page
  limit, or unreadable. A schema or arithmetic inconsistency becomes
  `needs_review`. OCR, rasterization, page batching, and provider fallback remain
  Phase 6 work.

Gemini 3.1 Flash Lite was considered, but the configured Gateway account does
not provide it on the free tier. Gemini 2.5 Flash Lite is available and met the
initial fixture target after replacing a provider-unfriendly discriminated-union
output schema with one object schema containing an explicit document-type enum.

## Golden set

The permission-safe fixtures under `tests/fixtures/phase0` are synthetic and
contain no real personal data:

- `receipt.png`: one clear receipt image.
- `invoice.pdf`: one digital, single-page invoice.
- `expected.json`: the scored expected fields.

## Whole-document results

| Fixture       | Scored field accuracy | Latency | Tokens | Estimated model cost |
| ------------- | --------------------: | ------: | -----: | -------------------: |
| `receipt.png` |            100% (9/9) | 3.696 s |  2,113 |           $0.0003505 |
| `invoice.pdf` |          100% (10/10) | 3.751 s |  2,160 |           $0.0003693 |

These are validation-spike measurements, not production benchmarks. The two
clear fixtures satisfy the Phase 0 exit criterion for common receipts and short
invoices. Broader accuracy claims require the larger regression set described in
the testing plan.

Re-run the measurement with:

```sh
set -a
source .env
set +a
pnpm phase0:evaluate
```

The protected `/app` screen exercises the complete product path: direct browser
upload to Convex File Storage, authenticated registration, durable scheduling,
Blob retrieval in an internal Node action, typed Gateway extraction, deterministic
validation, persistence, and realtime status/result display.
