export function ownerTokenIdentifierForUser(siteUrl: string, userId: string) {
  return `${new URL(siteUrl).origin}|${userId}`
}

export function assertProductionAuthConfiguration(values: {
  environment?: string
  baseUrl: string
  secret: string
  googleClientId: string
  googleClientSecret: string
  githubClientId: string
  githubClientSecret: string
}) {
  if (values.environment !== 'production') return
  if (new URL(values.baseUrl).protocol !== 'https:') {
    throw new Error('Production Better Auth URL must use HTTPS')
  }
  if (values.secret.length < 32) {
    throw new Error(
      'Production Better Auth secret must be at least 32 characters',
    )
  }
  for (const [name, value] of Object.entries({
    GOOGLE_CLIENT_ID: values.googleClientId,
    GOOGLE_CLIENT_SECRET: values.googleClientSecret,
    GITHUB_CLIENT_ID: values.githubClientId,
    GITHUB_CLIENT_SECRET: values.githubClientSecret,
  })) {
    if (!value.trim()) throw new Error(`${name} is required in production`)
  }
}
