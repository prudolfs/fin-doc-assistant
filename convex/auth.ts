import { convexAdapter } from '@convex-dev/better-auth'
import { createClient } from '@convex-dev/better-auth'
import { isRunMutationCtx } from '@convex-dev/better-auth/utils'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { components, internal } from './_generated/api'
import { env } from './_generated/server'
import authConfig from './auth.config'
import type { CreateAuth, GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'
import {
  assertProductionAuthConfiguration,
  ownerTokenIdentifierForUser,
} from '../shared/authSecurity'

const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth: CreateAuth<DataModel> = (
  ctx: GenericCtx<DataModel>,
) => {
  assertProductionAuthConfiguration({
    environment: env.AUTH_ENVIRONMENT,
    baseUrl: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,
  })
  return betterAuth({
    appName: 'Finance Document Assistant',
    database: convexAdapter(ctx as GenericCtx, components.betterAuth),
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    trustedOrigins: [env.BETTER_AUTH_URL],
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        scope: ['user:email'],
      },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        disableImplicitLinking: false,
        trustedProviders: [],
        allowDifferentEmails: false,
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          if (!isRunMutationCtx(ctx)) {
            throw new Error('Account deletion requires a writable context')
          }
          await ctx.runMutation(
            internal.accountLifecycle.scheduleAccountDeletion,
            {
              ownerTokenIdentifier: ownerTokenIdentifierForUser(
                env.CONVEX_SITE_URL,
                user.id,
              ),
            },
          )
        },
      },
    },
    ...(env.AUTH_ENVIRONMENT === 'production'
      ? { advanced: { useSecureCookies: true } }
      : {}),
    plugins: [convex({ authConfig })],
  })
}

export const { getAuthUser } = authComponent.clientApi()
