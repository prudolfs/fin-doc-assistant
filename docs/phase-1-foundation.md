# Phase 1 foundation and authentication

Completed on 2026-09-06 against Convex 1.45.0,
`@convex-dev/better-auth` 0.12.5, and Better Auth 1.6.11.

## Implemented

- TanStack Start routes and SSR build, Tailwind CSS, and shadcn/ui configuration.
- Convex Query client wrapped by `ConvexBetterAuthProvider`.
- Better Auth email/password, Google OAuth, and GitHub OAuth flows.
- Separate `/sign-in` and `/sign-up` routes with shared validated forms.
- A protected `/app` route boundary that requires both a Better Auth session and
  authenticated Convex client.
- Responsive application shell with desktop collapse, mobile navigation drawer,
  planned product navigation, recent-chat area, contextual top-bar titles,
  light/dark/system theme selection, user menu, settings route, and sign-out.
- Protected placeholders for future chat, finance-document collection, and
  settings phases. The Phase 0 uploader now lives at `/app/documents/new`.

## Verification

- Required local Better Auth and OAuth values are present.
- Required server-side values were configured on the
  `dev:reminiscent-bass-698` Convex deployment without exposing their contents.
- Better Auth component and HTTP routes deployed successfully.
- The unauthenticated session endpoint returns `200` with `null`, confirming the
  local adapter reaches the deployed HTTP routes.
- Desktop sign-in and mobile-width sign-up screens were browser-rendered during
  verification.
- `pnpm check` and `pnpm build` pass.
