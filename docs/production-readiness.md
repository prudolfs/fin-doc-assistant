# Production security and provider review

Last reviewed: 2026-09-06

This is the deployment checklist for the Phase 7 controls. The application-side
review is complete; the operator must repeat the console checks for each actual
production hostname because provider projects and secrets are external to this
repository.

## Better Auth and OAuth

The production guard in `shared/authSecurity.ts` refuses startup unless the
Better Auth URL uses HTTPS, the auth secret is at least 32 characters, and both
Google and GitHub credentials are present. Production also enables secure
cookies. Better Auth uses an explicit base URL, base path, and trusted origin;
OAuth tokens are encrypted and account-linking behavior is explicit.

Before switching `AUTH_ENVIRONMENT=production`:

- Create separate Google and GitHub OAuth applications for production. Do not
  reuse local-development credentials.
- Set the application homepage/origin to the exact production HTTPS origin.
- Register these exact callbacks, replacing the example origin:
  - `https://finance.example.com/api/auth/callback/google`
  - `https://finance.example.com/api/auth/callback/github`
- Do not add wildcard or localhost production callbacks. GitHub callback URLs
  should use exact hosts, and its requested scope remains the minimum needed by
  this app: `user:email`.
- Store `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, and
  `GITHUB_CLIENT_SECRET` only in the production Convex environment. Restrict
  dashboard access, maintain a rotation owner, and rotate on suspected exposure.
- Verify the provider consent-screen name, privacy-policy URL, support contact,
  verified domains, and publishing/verification status before public launch.
- Exercise sign-in, callback, account linking, sign-out, and account deletion
  with dedicated production test accounts after deployment.

References: [Better Auth user deletion](https://www.better-auth.com/docs/concepts/users-accounts#delete-user),
[GitHub OAuth app security guidance](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app), and
[Google OAuth production policy](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).

## AI provider privacy

Every extraction and chat request carries the AI Gateway
`disallowPromptTraining` option. Zero data retention is deliberately opt-in via
`AI_GATEWAY_ZERO_DATA_RETENTION=true`, because availability depends on the
Gateway plan and selected upstream model. Before enabling a production model:

- Confirm the exact model supports the application’s file modalities and the
  desired retention mode.
- Enable the Gateway team’s data-retention controls and set the app flag only
  after confirming support; fail the deployment review if a request can silently
  fall back to an unacceptable provider policy.
- Review the upstream model provider’s abuse-monitoring, regional processing,
  data residency, subprocessors, and retention terms.
- Keep prompts limited to the current task: full document bytes for extraction,
  and only bounded, relevant finance records for chat tools.
- Re-run this review when changing `AI_GATEWAY_CHAT_MODEL`, adding a fallback
  model, or changing the Gateway plan.

Reference: [Vercel AI Gateway provider options](https://vercel.com/docs/ai-gateway/provider-options).

## Operational readiness

- Confirm quotas and limits in the production Convex environment; defaults are
  100 documents, 200 conversations, and 100 MiB of original document storage
  per account.
- Route Convex error logs to the chosen pager/log sink. The application records
  sanitized failures and opens `systemAlerts` after five failures of a kind in
  one hour; the alert evaluator runs every 15 minutes.
- Verify the daily retention sweep and hourly expired-export cleanup in the
  Convex dashboard after deployment.
- Apply new schema indexes to a staging deployment first and inspect index
  backfill before production traffic.
- Run `pnpm check` and `pnpm test:e2e` against the release candidate.
