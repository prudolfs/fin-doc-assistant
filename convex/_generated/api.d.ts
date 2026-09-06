/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountActions from "../accountActions.js";
import type * as accountData from "../accountData.js";
import type * as accountLifecycle from "../accountLifecycle.js";
import type * as accountValidators from "../accountValidators.js";
import type * as auth from "../auth.js";
import type * as chartArtifacts from "../chartArtifacts.js";
import type * as chartValidators from "../chartValidators.js";
import type * as chatActions from "../chatActions.js";
import type * as chats from "../chats.js";
import type * as crons from "../crons.js";
import type * as documentProcessing from "../documentProcessing.js";
import type * as documentValidators from "../documentValidators.js";
import type * as documents from "../documents.js";
import type * as financeTools from "../financeTools.js";
import type * as http from "../http.js";
import type * as internal_chats from "../internal/chats.js";
import type * as internal_documentJobs from "../internal/documentJobs.js";
import type * as lib_accountUsage from "../lib/accountUsage.js";
import type * as lib_documentConfig from "../lib/documentConfig.js";
import type * as lib_pdfFallback from "../lib/pdfFallback.js";
import type * as observability from "../observability.js";
import type * as rateLimits from "../rateLimits.js";
import type * as readmeDemo from "../readmeDemo.js";
import type * as retention from "../retention.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountActions: typeof accountActions;
  accountData: typeof accountData;
  accountLifecycle: typeof accountLifecycle;
  accountValidators: typeof accountValidators;
  auth: typeof auth;
  chartArtifacts: typeof chartArtifacts;
  chartValidators: typeof chartValidators;
  chatActions: typeof chatActions;
  chats: typeof chats;
  crons: typeof crons;
  documentProcessing: typeof documentProcessing;
  documentValidators: typeof documentValidators;
  documents: typeof documents;
  financeTools: typeof financeTools;
  http: typeof http;
  "internal/chats": typeof internal_chats;
  "internal/documentJobs": typeof internal_documentJobs;
  "lib/accountUsage": typeof lib_accountUsage;
  "lib/documentConfig": typeof lib_documentConfig;
  "lib/pdfFallback": typeof lib_pdfFallback;
  observability: typeof observability;
  rateLimits: typeof rateLimits;
  readmeDemo: typeof readmeDemo;
  retention: typeof retention;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
