# Phase 4 chat and tools

Phase 4 adds authenticated, persistent finance conversations backed by the
official Convex Agent component.

## Conversation experience

- A prompt starts a persistent Agent thread, and later prompts continue the
  same thread. The sidebar lists the authenticated user's 30 most recent chats,
  grouped by recency.
- Assistant text and tool state stream into the conversation. Older messages
  can be paginated without loading an unbounded thread history.
- User prompts, assistant responses, tool calls, and tool results are persisted
  by the Agent component. A failed response is represented by a safe persisted
  assistant message and a retryable conversation state.
- Answers and completed tool cards link back to owner-authorized document detail
  routes. Assistant Markdown handling recognizes only internal document links;
  arbitrary HTML or external links are not rendered.

## Read-only finance tools

The assistant can search or inspect relevant documents and run deterministic
summaries for spending, income and expenses, suppliers, recorded tax,
outstanding invoices, and period comparisons. The tools:

- derive the owner identifier from the authenticated chat creation/send flow
  and recheck the chat-owner-thread tuple before responding;
- are internal Convex queries and expose no document mutation capability;
- read at most 500 recent owner-scoped documents, return bounded sources, and
  report when that read limit was reached;
- keep currencies separate and operate on integer minor units;
- count an invoice as outstanding only when its extracted payment state is
  explicitly `unpaid` or `partially_paid`;
- disclose that the current receipt/supplier-invoice schema has no income
  classification and that document-derived tax information is not tax advice.

The model receives recent thread context plus the result of the smallest
relevant tool call. It does not receive the user's complete document collection
in the prompt.

## Verification

- Root and Convex TypeScript checks passed.
- Oxlint passed without warnings, and Oxfmt reported all files formatted.
- All 15 Vitest tests passed, including deterministic currency aggregation and
  period-comparison edge cases.
- The production client, SSR, and Nitro server builds passed.
- The Agent component, additive chat schema, indexes, and Phase 4 functions were
  deployed successfully to the existing Convex development deployment.
- The development deployment has an AI Gateway credential configured; no
  credential value was displayed during verification.
