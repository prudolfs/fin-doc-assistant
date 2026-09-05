/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ActionBuilder,
  GenericActionCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
  GenericMutationCtx,
  GenericQueryCtx,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
} from 'convex/server'
import type { DataModel } from './dataModel.js'

type Env = {
  readonly CONVEX_CLOUD_URL: string
  readonly CONVEX_SITE_URL: string
  readonly BETTER_AUTH_SECRET: string
  readonly BETTER_AUTH_URL: string
  readonly GOOGLE_CLIENT_ID: string
  readonly GOOGLE_CLIENT_SECRET: string
  readonly GITHUB_CLIENT_ID: string
  readonly GITHUB_CLIENT_SECRET: string
  readonly AI_GATEWAY_API_KEY: string | undefined
  readonly AI_GATEWAY_CHAT_MODEL: string | undefined
  readonly DOCUMENT_MAX_ACCEPTED_FILES: string | undefined
  readonly DOCUMENT_MAX_ACCEPTED_FILE_BYTES: string | undefined
  readonly DOCUMENT_MAX_PAGES: string | undefined
}

export declare const query: QueryBuilder<DataModel, 'public'>
export declare const internalQuery: QueryBuilder<DataModel, 'internal'>
export declare const mutation: MutationBuilder<DataModel, 'public'>
export declare const internalMutation: MutationBuilder<DataModel, 'internal'>
export declare const action: ActionBuilder<DataModel, 'public'>
export declare const internalAction: ActionBuilder<DataModel, 'internal'>
export declare const httpAction: HttpActionBuilder
export declare const env: Env

export type QueryCtx = GenericQueryCtx<DataModel>
export type MutationCtx = GenericMutationCtx<DataModel>
export type ActionCtx = GenericActionCtx<DataModel>
export type DatabaseReader = GenericDatabaseReader<DataModel>
export type DatabaseWriter = GenericDatabaseWriter<DataModel>
