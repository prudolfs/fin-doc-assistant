import { convexAdapter } from '@convex-dev/better-auth'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { components } from './_generated/api'
import { env } from './_generated/server'
import authConfig from './auth.config'
import type { CreateAuth, GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth: CreateAuth<DataModel> = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    database: convexAdapter(ctx as GenericCtx, components.betterAuth),
    baseURL: env.BETTER_AUTH_URL,
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
      },
    },
    plugins: [convex({ authConfig })],
  })

export const { getAuthUser } = authComponent.clientApi()
