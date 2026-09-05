import { Link, Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'
import { signInSchema, signUpSchema } from '../lib/auth-validation'
import type { FormEvent, ReactNode } from 'react'

type AuthMode = 'sign-in' | 'sign-up'

export function AuthForm({ mode }: { mode: AuthMode }) {
  const { data: session, isPending } = authClient.useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isPending) return <LoadingScreen />
  if (session) return <Navigate to="/app" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'sign-in') {
        const parsed = signInSchema.safeParse({ email, password })
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Check your details.')
          return
        }
        const result = await authClient.signIn.email({
          email: parsed.data.email,
          password: parsed.data.password,
          callbackURL: '/app',
        })
        if (result.error) {
          setError(result.error.message ?? 'Authentication failed.')
        }
        return
      }

      const parsed = signUpSchema.safeParse({
        name,
        email,
        password,
        passwordConfirmation,
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Check your details.')
        return
      }
      const result = await authClient.signUp.email({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        callbackURL: '/app',
      })
      if (result.error) {
        setError(result.error.message ?? 'Authentication failed.')
      }
    } catch {
      setError('Unable to reach the authentication service. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function signInWith(provider: 'google' | 'github') {
    setError(null)
    setSubmitting(true)
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: '/app',
      })
      if (result.error) {
        setError(result.error.message ?? 'Authentication failed.')
      }
    } catch {
      setError('Unable to reach the authentication service. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const isSignIn = mode === 'sign-in'
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-neutral-950 p-5 text-neutral-950 dark:bg-black">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_35%)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/15 bg-white p-7 shadow-2xl shadow-black/30 sm:p-9 dark:bg-neutral-950 dark:text-neutral-50">
        <div className="mb-7">
          <div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-emerald-400 text-lg font-bold text-neutral-950">
            F
          </div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Finance Document Assistant
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {isSignIn ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {isSignIn
              ? 'Sign in to continue to your private finance workspace.'
              : 'Start a private workspace for your receipts and invoices.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SocialButton
            disabled={submitting}
            label="Google"
            onClick={() => signInWith('google')}
          >
            <span className="font-bold text-blue-600">G</span>
          </SocialButton>
          <SocialButton
            disabled={submitting}
            label="GitHub"
            onClick={() => signInWith('github')}
          >
            <span className="font-mono text-xs font-bold">GH</span>
          </SocialButton>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs tracking-[0.14em] text-neutral-400 uppercase">
          <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          or use email
          <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <form className="space-y-4" onSubmit={submit}>
          {!isSignIn && (
            <Field
              autoComplete="name"
              label="Name"
              value={name}
              onChange={setName}
            />
          )}
          <Field
            autoComplete="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
          />
          <Field
            autoComplete={isSignIn ? 'current-password' : 'new-password'}
            label="Password"
            minLength={8}
            type="password"
            value={password}
            onChange={setPassword}
          />
          {!isSignIn && (
            <Field
              autoComplete="new-password"
              label="Confirm password"
              minLength={8}
              type="password"
              value={passwordConfirmation}
              onChange={setPasswordConfirmation}
            />
          )}
          {error && (
            <p
              className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            className="w-full rounded-xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-400 dark:text-neutral-950 dark:hover:bg-emerald-300"
            disabled={submitting}
          >
            {submitting
              ? 'Please wait…'
              : isSignIn
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {isSignIn ? 'New here?' : 'Already have an account?'}{' '}
          <Link
            className="font-semibold text-neutral-950 underline-offset-4 hover:underline dark:text-white"
            to={isSignIn ? '/sign-up' : '/sign-in'}
          >
            {isSignIn ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
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
        className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 transition outline-none focus:border-neutral-500 focus:ring-4 focus:ring-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-500 dark:focus:ring-neutral-800"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function SocialButton({
  children,
  label,
  ...props
}: {
  children: ReactNode
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      {...props}
      className="flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-medium transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      type="button"
    >
      {children}
      {label}
    </button>
  )
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-950 text-sm text-neutral-400">
      Loading…
    </main>
  )
}
