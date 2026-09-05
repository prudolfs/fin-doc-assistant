import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  return (
    <section className="mx-auto max-w-3xl p-6">
      <div className="rounded-3xl border bg-white p-7 shadow-sm dark:bg-neutral-950">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Profile and account settings are intentionally deferred beyond the
          Phase 1 shell.
        </p>
      </div>
    </section>
  )
}
