'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSignOut } from '../../lib/hooks'
import { useTheme } from '../../lib/theme'
import { NAV_BY_ROLE } from '../../lib/nav'
import type { UserRole } from '../../lib/types'
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react'

/**
 * Chrome for every rebuilt screen, whatever the role.
 *
 * Grew out of the admin-only shell: the sidebar contents now come from
 * `lib/nav.ts` keyed by role, and below `lg` the sidebar becomes a drawer so
 * the volunteer screens work on a phone.
 */
export interface AppShellProps {
  role: UserRole
  /** href of the nav item to mark current. */
  active: string
  /** Breadcrumb trail shown in the top bar; last entry is the current page. */
  breadcrumb: string[]
  username: string
  /** Right-aligned controls in the top bar. */
  actions?: React.ReactNode
  children: React.ReactNode
}

export default function AppShell({ role, active, breadcrumb, username, actions, children }: AppShellProps) {
  const { signOut } = useSignOut()
  const { theme, toggleTheme } = useTheme()
  const [navOpen, setNavOpen] = useState(false)

  // The drawer is a page-level overlay; Escape should close it like a dialog.
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  const groups = NAV_BY_ROLE[role] ?? []

  const initials = username
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const nav = (
    <>
      <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded bg-ink text-[11px] font-semibold text-surface">
          D
        </div>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">Debora Foundation</span>
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          className="rounded p-1 text-ink-faint hover:bg-surface-hover hover:text-ink lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-[15px] w-[15px]" />
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.heading}>
          <div className="px-4 pb-1 pt-2.5">
            <span className="text-[11px] font-medium text-ink-faint">{group.heading}</span>
          </div>
          <div className="flex flex-col gap-px px-2">
            {group.items.map((item) => {
              const isActive = item.href === active
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-8 items-center gap-2.5 rounded px-2 transition-colors ${
                    isActive ? 'bg-rule text-ink' : 'text-ink hover:bg-surface-hover'
                  }`}
                >
                  <Icon className={`h-[15px] w-[15px] ${isActive ? 'text-ink' : 'text-ink-muted'}`} />
                  <span className={`text-[13.5px] ${isActive ? 'font-medium' : ''}`}>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      <div className="mt-auto border-t border-rule p-2">
        <div className="flex h-[34px] items-center gap-2.5 rounded px-2">
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded bg-accent-bg text-[10.5px] font-semibold text-accent-fg">
            {initials || 'A'}
          </div>
          <span className="min-w-0 flex-1 truncate text-[12.5px]">{username}</span>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="rounded p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <LogOut className="h-[14px] w-[14px]" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-ink">
      <aside className="hidden w-[248px] shrink-0 flex-col overflow-y-auto border-r border-rule bg-surface-sidebar lg:flex">
        {nav}
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[248px] flex-col overflow-y-auto border-r border-rule bg-surface-sidebar">
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-rule px-3 sm:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="-ml-1 rounded p-1.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-[17px] w-[17px]" />
          </button>

          {breadcrumb.map((crumb, i) => (
            <div key={crumb} className={`items-center gap-2 ${i === breadcrumb.length - 1 ? 'flex' : 'hidden sm:flex'}`}>
              {i > 0 && <span className="text-rule-strong">/</span>}
              <span className={`text-[13.5px] ${i === breadcrumb.length - 1 ? 'text-ink' : 'text-ink-faint'}`}>
                {crumb}
              </span>
            </div>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
            >
              {theme === 'dark' ? <Sun className="h-[15px] w-[15px]" /> : <Moon className="h-[15px] w-[15px]" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
