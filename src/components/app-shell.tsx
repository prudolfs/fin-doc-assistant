import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronsLeft,
  ChevronsRight,
  FilePlus2,
  Files,
  LogOut,
  Menu,
  MessageSquarePlus,
  Monitor,
  Moon,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'
import { useTheme } from './theme-provider'
import type { ReactNode } from 'react'

const navigation = [
  { label: 'New chat', to: '/app/chat/new', icon: MessageSquarePlus },
  {
    label: 'New finance document',
    to: '/app/documents/new',
    icon: FilePlus2,
  },
  { label: 'Finance documents', to: '/app/documents', icon: Files },
] as const

const pageTitles: Record<string, string> = {
  '/app/chat/new': 'New chat',
  '/app/documents': 'Finance documents',
  '/app/documents/': 'Finance documents',
  '/app/documents/new': 'New finance document',
  '/app/settings': 'Settings',
}

export function AppShell({
  children,
  user,
}: {
  children: ReactNode
  user: { name?: string | null; email: string; image?: string | null }
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const title = pageTitles[pathname] ?? 'Finance Document Assistant'

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50">
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />

      <div className={collapsed ? 'lg:pl-20' : 'lg:pl-72'}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-white/90 px-4 backdrop-blur-xl sm:px-6 dark:bg-neutral-950/90">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open navigation"
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden dark:hover:bg-neutral-800"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <h1 className="truncate font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeControl />
            <UserMenu user={user} />
          </div>
        </header>
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </div>
    </div>
  )
}

function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapsed,
}: {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
  onToggleCollapsed: () => void
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex border-r bg-neutral-950 text-neutral-100 transition-[width,transform] duration-200 ${collapsed ? 'w-20' : 'w-72'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div
          className={`flex h-12 items-center ${collapsed ? 'justify-center' : 'justify-between px-2'}`}
        >
          <Link
            aria-label="Finance Document Assistant"
            className="flex min-w-0 items-center gap-3"
            to="/app/documents/new"
            onClick={onCloseMobile}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400 font-bold text-neutral-950">
              F
            </span>
            {!collapsed && (
              <span className="truncate text-sm font-semibold">
                Finance Assistant
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              aria-label="Close navigation"
              className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 lg:hidden"
              onClick={onCloseMobile}
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <nav className="mt-5 space-y-1" aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link
              key={item.to}
              activeProps={{ className: 'bg-white/12 text-white' }}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-neutral-300 transition hover:bg-white/8 hover:text-white ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.label : undefined}
              to={item.to}
              onClick={onCloseMobile}
            >
              <item.icon className="size-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {!collapsed && (
          <div className="mt-8 min-h-0 flex-1 px-2">
            <p className="text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase">
              Recent chats
            </p>
            <p className="mt-3 text-xs leading-5 text-neutral-500">
              No conversations yet. Recent chats arrive in Phase 4.
            </p>
          </div>
        )}

        <button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="mt-auto hidden h-10 items-center justify-center gap-2 rounded-xl text-sm text-neutral-400 hover:bg-white/8 hover:text-white lg:flex"
          onClick={onToggleCollapsed}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <ChevronsLeft className="size-4" />
          )}
          {!collapsed && 'Collapse sidebar'}
        </button>
      </div>
    </aside>
  )
}

function ThemeControl() {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const

  return (
    <div
      className="flex rounded-xl border bg-neutral-50 p-1 dark:bg-neutral-900"
      aria-label="Color theme"
    >
      {options.map((option) => (
        <button
          key={option.value}
          aria-label={option.label}
          aria-pressed={theme === option.value}
          className={`rounded-lg p-1.5 transition ${theme === option.value ? 'bg-white text-neutral-950 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
          title={option.label}
          onClick={() => setTheme(option.value)}
        >
          <option.icon className="size-4" />
        </button>
      ))}
    </div>
  )
}

function UserMenu({
  user,
}: {
  user: { name?: string | null; email: string; image?: string | null }
}) {
  const label = user.name?.trim() || user.email
  const initial = label.slice(0, 1).toUpperCase()

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1.5 pr-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
        {user.image ? (
          <img
            alt=""
            className="size-7 rounded-lg object-cover"
            src={user.image}
          />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {initial}
          </span>
        )}
        <span className="hidden max-w-36 truncate text-sm font-medium sm:block">
          {label}
        </span>
      </summary>
      <div className="absolute right-0 mt-2 w-64 rounded-2xl border bg-white p-2 shadow-xl dark:bg-neutral-950">
        <div className="border-b px-3 py-2">
          <p className="truncate text-sm font-medium">
            {user.name || 'Account'}
          </p>
          <p className="truncate text-xs text-neutral-500">{user.email}</p>
        </div>
        <Link
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          to="/app/settings"
        >
          <Settings className="size-4" />
          Settings
        </Link>
        <button
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
          onClick={() => authClient.signOut()}
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </details>
  )
}
