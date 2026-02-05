'use client'

import { useRouter } from 'next/navigation'
import { useSignOut } from '../../lib/hooks'
import type { UserRole } from '../../lib/types'

interface NavbarProps {
  username: string
  role: UserRole
  roleLabel: string
  roleColor: string
}

export function Navbar({ username, role, roleLabel, roleColor }: NavbarProps) {
  const { signOut } = useSignOut()
  const router = useRouter()

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{username}</h1>
          <p className="text-sm text-slate-600">Welcome back!</p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${roleColor}`}>
            {roleLabel}
          </span>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

interface SidebarProps {
  role: UserRole
}

export function Sidebar({ role }: SidebarProps) {
  const router = useRouter()

  const menuItems: Record<UserRole, { label: string; href: string; icon: string }[]> = {
    field_volunteer: [
      { label: 'Dashboard', href: '/field-volunteer', icon: '📊' },
      { label: 'Child Data Entry', href: '/field-volunteer/child-data-entry', icon: '👶' },
      { label: 'Assigned Tasks', href: '/field-volunteer/tasks', icon: '✅' },
      { label: 'My Data', href: '/field-volunteer/my-data', icon: '📋' },
      { label: 'Activity History', href: '/field-volunteer/history', icon: '📜' },
    ],
    dfi_field_staff: [
      { label: 'Dashboard', href: '/dfi-field-staff', icon: '📊' },
      { label: 'Review Queue', href: '/dfi-staff/review-queue', icon: '🔍' },
      { label: 'Approve Data', href: '/dfi-field-staff/approve-data', icon: '✔️' },
      { label: 'Activity History', href: '/dfi-field-staff/history', icon: '📜' },
    ],
    dfi_staff: [
      { label: 'Dashboard', href: '/dfi-staff', icon: '📊' },
      { label: 'Review Queue', href: '/dfi-staff/review-queue', icon: '🔍' },
      { label: 'Approvals', href: '/dfi-staff/approvals', icon: '✅' },
      { label: 'All Records', href: '/admin/records', icon: '📋' },
      { label: 'Edit/Approve Data', href: '/dfi-staff/edit-approve-data', icon: '✏️' },
      { label: 'Activity History', href: '/dfi-staff/history', icon: '📜' },
    ],
    admin: [
      { label: 'Dashboard', href: '/admin', icon: '📊' },
      { label: 'Approvals Queue', href: '/admin/approvals', icon: '✅' },
      { label: 'All Records', href: '/admin/records', icon: '📋' },
      { label: 'Analytics', href: '/admin/analytics', icon: '📈' },
      { label: 'Activity Logs', href: '/admin/logs', icon: '📝' },
    ],
    tech_support: [
      { label: 'Dashboard', href: '/tech-support', icon: '📊' },
      { label: 'System Monitoring', href: '/tech-support/monitoring', icon: '🔧' },
      { label: 'Database', href: '/tech-support/database', icon: '🗄️' },
      { label: 'Activity Logs', href: '/admin/logs', icon: '📝' },
      { label: 'All Records', href: '/admin/records', icon: '📋' },
    ],
  }

  const items = menuItems[role] || []

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 overflow-y-auto pt-20 border-r border-slate-700">
      <nav className="p-6 space-y-2">
        {items.map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-3 font-medium"
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

interface PageContainerProps {
  children: React.ReactNode
  hasSidebar?: boolean
}

export function PageContainer({ children, hasSidebar = true }: PageContainerProps) {
  return (
    <div className={hasSidebar ? 'ml-64' : ''}>
      {children}
    </div>
  )
}
