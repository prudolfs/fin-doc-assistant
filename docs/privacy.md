# Privacy and data controls

Last reviewed: 2026-09-06

This document describes the application’s implemented data flows and controls.
It is an engineering summary, not a substitute for a deployment-specific legal
privacy notice.

## Data the application stores

- Account and sign-in data needed by Better Auth, including linked Google or
  GitHub account identifiers when those methods are used.
- Uploaded receipt and invoice files, their metadata, extracted financial
  fields, validation results, evidence, and processing audit records.
- Conversation prompts, assistant responses, tool results, and saved chart
  specifications.
- Account retention preferences, aggregate quota counters, short-lived export
  records, and sanitized operational failure events. Operational events do not
  store prompts, document contents, access tokens, or raw exception messages.

Application data and original files are stored in the configured Convex
deployment. Document contents needed for extraction and relevant finance data
needed for an answer are sent through Vercel AI Gateway to the selected model
provider. The app sets `disallowPromptTraining: true` on every model request.
`AI_GATEWAY_ZERO_DATA_RETENTION=true` additionally requests zero data retention
when the Gateway account and chosen model support it.

Google and GitHub receive the normal OAuth authorization data when their sign-in
buttons are used. OAuth access tokens are encrypted at rest by Better Auth.

## Retention

The default account-data retention period is 365 days and can be changed in
Settings to 30 days, 90 days, one year, or “Keep until I delete.” A daily,
batched cleanup removes completed/non-processing documents and inactive
conversations older than the selected period, including associated originals,
extractions, page data, audit events, messages, and charts.

Generated account exports expire from application storage after 24 hours by
default. Both defaults are deployment-configurable. Provider infrastructure,
logs, and backups may have separate retention under the applicable Convex,
Vercel, and model-provider terms; those settings must be reviewed for each
production deployment.

## User controls

The protected Settings page lets a user:

- View document, conversation, and document-storage quota usage.
- Select an automatic retention period.
- Create a private `.tar.gz` export containing settings, document records,
  original files, conversations, and messages. Export creation is rate-limited.
- Permanently delete their account. Deletion removes Better Auth account data
  and starts a durable, batched cleanup of owned files, documents, extractions,
  chats, messages, charts, exports, settings, usage counters, and sanitized
  operational events.

Account deletion is irreversible. Better Auth may require the password or a
recently verified OAuth session before accepting it.

## Security boundaries

Every public Convex data operation derives ownership from the authenticated
identity. User-provided owner identifiers are not accepted by public document or
chat functions. Uploaded content is treated as untrusted data, and model prompts
explicitly reject instructions embedded inside documents. Upload, retry, chat,
and export operations are rate-limited; account document, conversation, and
storage quotas are enforced transactionally.

Do not put credentials in source control. Production secrets belong in the
Convex deployment environment, and OAuth client secrets should be rotated if
they are ever exposed.
