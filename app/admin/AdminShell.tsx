'use client'

import AppShell from '../components/AppShell'

/**
 * Admin-flavoured `AppShell`, kept so the pages built against it don't all have
 * to pass `role="admin"`. New screens should use `AppShell` directly.
 */
export interface AdminShellProps {
  /** href of the nav item to mark current. */
  active: string
  /** Breadcrumb trail shown in the top bar; last entry is the current page. */
  breadcrumb: string[]
  username: string
  /** Right-aligned controls in the top bar. */
  actions?: React.ReactNode
  children: React.ReactNode
}

export default function AdminShell(props: AdminShellProps) {
  return <AppShell role="admin" {...props} />
}
