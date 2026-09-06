# Phase 7 — production hardening

Phase 7 adds application-level abuse controls, privacy controls, operational
signals, and release checks. External production OAuth/provider consoles are not
modified by source code; their exact deployment review is recorded in
[`production-readiness.md`](./production-readiness.md).

## Limits and quotas

The official Convex rate-limiter component enforces transactional limits for
upload URL creation, document registration/retry, per-user chat traffic, global
chat traffic, and data exports. Account counters enforce 100 documents, 200
conversations, and 100 MiB of document storage by default. These values are
configurable through typed Convex environment variables and are visible on the
Settings page.

Only three documents per account may be queued or processing concurrently.
Document retry remains capped at three processing attempts in addition to its
request rate limit.

## Observability and alerts

Document-processing, chat-response, and export failures write sanitized event
records without raw prompts, document content, credentials, or exception text.
A scheduled evaluator runs every 15 minutes and opens or resolves durable alert
records. The default threshold is five failures of one kind in one hour. Active
alerts are also emitted to Convex logs for forwarding to the production log or
paging service.

## Export, deletion, and retention

Settings provides a streamed browser download of a compressed account archive.
Archives contain JSON metadata/messages and original document files, are
rate-limited, use traversal-safe tar names, and expire after 24 hours by default.

Better Auth account deletion is enabled with password/recent-session
verification. Its pre-delete hook creates a durable cleanup job. Bounded batches
remove Agent messages and every user-owned application row/file without relying
on a single oversized transaction.

A daily retention job respects per-account choices of 30, 90, 365 days, or no
automatic expiry. Processing documents are excluded from retention deletion.
Expired export cleanup runs hourly. See [`privacy.md`](./privacy.md) for the
user-facing description.

## Verification coverage

- Unit/regression tests cover quotas, supported retention values, production
  auth guards, AI privacy options, prompt-injection instructions, and archive
  path/content behavior.
- `convex-test` Edge-runtime integration tests cover anonymous and cross-user
  access denial for chats and document files, plus operational alert activation.
- Playwright desktop/mobile checks cover protected-route redirection, supported
  sign-in methods, and pre-network account-creation validation.
- Type checking, linting, formatting, unit/integration tests, production build,
  Convex code generation, and one-shot development deployment validation are
  release gates.

Implementation defaults are documented in `.env.example`. The final production
hostnames, provider-console registrations, secret rotation, logging destination,
and Gateway plan capabilities must be verified by the deployer using
[`production-readiness.md`](./production-readiness.md).
