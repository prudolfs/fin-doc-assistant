import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: HomeRoute })

function HomeRoute() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="max-w-xl space-y-3 text-center">
        <p className="text-sm font-medium text-neutral-500">Project setup</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Finance Document Assistant
        </h1>
        <p className="text-neutral-600">
          TanStack Start, Convex, and Better Auth are ready for the phased
          implementation.
        </p>
      </section>
    </main>
  )
}
