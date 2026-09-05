import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/app')({ component: AppRoute })

function AppRoute() {
  const { data: session, isPending } = authClient.useSession()
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isPending || isLoading) {
    return (
      <main className="grid min-h-screen place-items-center">Loading…</main>
    )
  }
  if (!session || !isAuthenticated) return <Navigate to="/sign-in" replace />
  return <Outlet />
}
