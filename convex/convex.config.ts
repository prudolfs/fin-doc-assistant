import betterAuth from '@convex-dev/better-auth/convex.config'
import agent from '@convex-dev/agent/convex.config'
import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    BETTER_AUTH_SECRET: v.string(),
    BETTER_AUTH_URL: v.string(),
    GOOGLE_CLIENT_ID: v.string(),
    GOOGLE_CLIENT_SECRET: v.string(),
    GITHUB_CLIENT_ID: v.string(),
    GITHUB_CLIENT_SECRET: v.string(),
    AI_GATEWAY_API_KEY: v.optional(v.string()),
    AI_GATEWAY_CHAT_MODEL: v.optional(v.string()),
    DOCUMENT_MAX_ACCEPTED_FILES: v.optional(v.string()),
    DOCUMENT_MAX_ACCEPTED_FILE_BYTES: v.optional(v.string()),
    DOCUMENT_MAX_PAGES: v.optional(v.string()),
  },
})

app.use(betterAuth)
app.use(agent)

export default app
