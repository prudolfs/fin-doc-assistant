import { api } from '../../convex/_generated/api'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Download, LoaderCircle, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient } from '../lib/auth-client'
import { formatBytes } from '../lib/document-files'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/app/settings')({
  component: SettingsRoute,
})

type RetentionDays = 30 | 90 | 365 | null

function SettingsRoute() {
  const settings = useQuery(api.accountData.getSettings)
  const updateRetention = useMutation(api.accountData.updateRetention)
  const createDataExport = useAction(api.accountActions.createDataExport)
  const [retentionDays, setRetentionDays] = useState<RetentionDays>(365)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (settings) setRetentionDays(settings.retentionDays)
  }, [settings])

  async function saveRetention() {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await updateRetention({ retentionDays })
      setNotice('Retention preference saved.')
    } catch (cause) {
      setError(messageFrom(cause, 'Could not save the retention preference.'))
    } finally {
      setSaving(false)
    }
  }

  async function downloadExport() {
    setExporting(true)
    setError(null)
    setNotice(null)
    try {
      const result = await createDataExport({})
      const link = document.createElement('a')
      link.href = result.url
      link.download = result.filename
      link.rel = 'noopener'
      link.click()
      setNotice(
        `Export ready (${formatBytes(result.byteSize)}). Its private download expires ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(result.expiresAt)}.`,
      )
    } catch (cause) {
      setError(messageFrom(cause, 'Could not create the account export.'))
    } finally {
      setExporting(false)
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (confirmation !== 'DELETE ACCOUNT') return
    setDeleting(true)
    setError(null)
    setNotice(null)
    try {
      const result = await authClient.deleteUser({
        ...(password ? { password } : {}),
        callbackURL: '/',
      })
      if (result.error) {
        setError(result.error.message ?? 'Could not delete the account.')
        return
      }
      window.location.assign('/')
    } catch (cause) {
      setError(messageFrom(cause, 'Could not delete the account.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Account controls
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            Settings
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Manage storage limits, data retention, export, and account deletion.
          </p>
        </header>

        {(notice || error) && (
          <p
            className={`rounded-xl p-3 text-sm ${error ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'}`}
            role={error ? 'alert' : 'status'}
          >
            {error ?? notice}
          </p>
        )}

        <section className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-neutral-950">
          <h3 className="text-lg font-semibold">Usage and limits</h3>
          {!settings ? (
            <p className="mt-3 text-sm text-neutral-500">Loading usage…</p>
          ) : (
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <Usage
                label="Documents"
                value={`${settings.usage.documentCount} / ${settings.quotas.maxDocuments}`}
              />
              <Usage
                label="Conversations"
                value={`${settings.usage.chatCount} / ${settings.quotas.maxChats}`}
              />
              <Usage
                label="Document storage"
                value={`${formatBytes(settings.usage.storageBytes)} / ${formatBytes(settings.quotas.maxStorageBytes)}`}
              />
            </dl>
          )}
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-neutral-950">
          <h3 className="text-lg font-semibold">Retention</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Completed documents and inactive conversations older than this are
            removed by a daily cleanup. “Keep until I delete” disables automatic
            account-data expiry.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Keep my data for
              <select
                className="min-w-52 rounded-xl border bg-transparent px-3 py-2.5"
                disabled={!settings || saving}
                value={retentionDays ?? 'forever'}
                onChange={(event) =>
                  setRetentionDays(
                    event.target.value === 'forever'
                      ? null
                      : (Number(event.target.value) as 30 | 90 | 365),
                  )
                }
              >
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
                <option value="forever">Keep until I delete</option>
              </select>
            </label>
            <button
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950"
              disabled={!settings || saving}
              onClick={saveRetention}
            >
              {saving ? 'Saving…' : 'Save retention'}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-neutral-950">
          <h3 className="text-lg font-semibold">Export account data</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Download a compressed archive containing account settings, document
            records, original files, conversations, and messages.
          </p>
          <button
            className="mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            disabled={exporting}
            onClick={downloadExport}
          >
            {exporting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exporting ? 'Preparing export…' : 'Download my data'}
          </button>
        </section>

        <section className="rounded-3xl border border-red-200 bg-red-50/40 p-6 dark:border-red-950 dark:bg-red-950/20">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <ShieldAlert className="size-5" />
            <h3 className="text-lg font-semibold">Delete account</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            This permanently removes the account, stored files, extracted data,
            charts, conversations, and generated exports. A recent sign-in may
            be required. Password accounts should enter their password below.
          </p>
          <form className="mt-4 grid gap-3" onSubmit={deleteAccount}>
            <label className="grid gap-1.5 text-sm font-medium">
              Password (leave blank for an OAuth account)
              <input
                className="rounded-xl border bg-white px-3 py-2.5 dark:bg-neutral-950"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Type DELETE ACCOUNT to confirm
              <input
                className="rounded-xl border bg-white px-3 py-2.5 dark:bg-neutral-950"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <button
              className="w-fit rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={confirmation !== 'DELETE ACCOUNT' || deleting}
            >
              {deleting ? 'Deleting…' : 'Permanently delete account'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

function Usage({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  )
}

function messageFrom(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback
}
