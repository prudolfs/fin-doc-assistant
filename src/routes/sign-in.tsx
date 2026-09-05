import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/sign-in')({ component: SignInRoute })

function SignInRoute() {
  const { data: session, isPending } = authClient.useSession()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isPending) return <LoadingScreen />
  if (session) return <Navigate to="/app" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result =
        mode === 'sign-in'
          ? await authClient.signIn.email({
              email,
              password,
              callbackURL: '/app',
            })
          : await authClient.signUp.email({
              name: name.trim(),
              email,
              password,
              callbackURL: '/app',
            })
      if (result.error)
        setError(result.error.message ?? 'Authentication failed.')
    } catch {
      setError('Unable to reach the authentication service.')
    } finally {
      setSubmitting(false)
    }
  }

  async function social(provider: 'google' | 'github') {
    setSubmitting(true)
    setError(null)
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: '/app',
      })
      if (result.error)
        setError(result.error.message ?? 'Authentication failed.')
    } catch {
      setError('Unable to reach the authentication service.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-neutral-50 p-6">
      <section className="w-full max-w-md space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Phase 0 validation spike
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Finance Document Assistant
          </h1>
        </div>
        <div className="grid grid-cols-2 rounded-lg bg-neutral-100 p-1">
          {(['sign-in', 'sign-up'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium ${mode === item ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
              onClick={() => setMode(item)}
            >
              {item === 'sign-in' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === 'sign-up' && (
            <Field
              label="Name"
              value={name}
              onChange={setName}
              autoComplete="name"
            />
          )}
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete="current-password"
            minLength={8}
          />
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={submitting}
          >
            {submitting
              ? 'Please wait…'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
        <div className="grid grid-cols-2 gap-3">
          <button
            className="rounded-lg border px-3 py-2 text-sm"
            disabled={submitting}
            onClick={() => social('google')}
          >
            Google
          </button>
          <button
            className="rounded-lg border px-3 py-2 text-sm"
            disabled={submitting}
            onClick={() => social('github')}
          >
            GitHub
          </button>
        </div>
      </section>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  ...props
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  minLength?: number
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <input
        {...props}
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-400"
      />
    </label>
  )
}

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center">Loading…</main>
}
