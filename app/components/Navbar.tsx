'use client'

import { useRouter } from 'next/navigation'
import { useSignOut } from '../../lib/hooks'
import type { UserRole } from '../../lib/types'
import DFILogo from '../../public/DFI.png'
import Image from 'next/image'
import {
  LayoutDashboard,
  UserPlus,
  CheckCircle,
  ClipboardList,
  ScrollText,
  Search,
  TrendingUp,
  Edit,
  Settings,
  Download,
  Database,
  FileEdit,
  User,
  type LucideIcon
} from 'lucide-react'

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
    <div className="bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-full px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image src={DFILogo} alt="DFI Logo" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{username}</h1>
            <p className="text-sm text-slate-600">Welcome back!</p>
          </div>
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

  const menuItems: Record<UserRole, { label: string; href: string; icon: LucideIcon }[]> = {
    field_volunteer: [
      { label: 'Dashboard', href: '/field-volunteer', icon: LayoutDashboard },
      { label: 'Child Data Entry', href: '/field-volunteer/child-data-entry', icon: UserPlus },
      { label: 'Assigned Tasks', href: '/field-volunteer/tasks', icon: CheckCircle },
      { label: 'My Data', href: '/field-volunteer/my-data', icon: ClipboardList },
      { label: 'Activity History', href: '/field-volunteer/history', icon: ScrollText },
    ],
    dfi_field_staff: [
      { label: 'Dashboard', href: '/dfi-field-staff', icon: LayoutDashboard },
      { label: 'Review Queue', href: '/dfi-staff/review-queue', icon: Search },
      { label: 'Approve Data', href: '/dfi-field-staff/approve-data', icon: CheckCircle },
      { label: 'Analytics', href: '/dfi-staff/analytics', icon: TrendingUp },
      { label: 'Activity History', href: '/dfi-field-staff/history', icon: ScrollText },
    ],
    dfi_staff: [
      { label: 'Dashboard', href: '/dfi-staff', icon: LayoutDashboard },
      { label: 'Review Queue', href: '/dfi-staff/review-queue', icon: Search },
      { label: 'Approvals', href: '/dfi-staff/approvals', icon: CheckCircle },
      { label: 'Analytics', href: '/dfi-staff/analytics', icon: TrendingUp },
      { label: 'All Records', href: '/admin/records', icon: ClipboardList },
      { label: 'Edit/Approve Data', href: '/dfi-staff/edit-approve-data', icon: Edit },
      { label: 'Activity History', href: '/dfi-staff/history', icon: ScrollText },
    ],
    admin: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { label: 'Approvals Queue', href: '/admin/approvals', icon: CheckCircle },
      { label: 'All Records', href: '/admin/records', icon: ClipboardList },
      { label: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
      { label: 'Reports & Export', href: '/tech-support/reports', icon: Download },
      { label: 'Activity Logs', href: '/admin/logs', icon: FileEdit },
      { label: 'My Activity', href: '/profile/activity', icon: User },
    ],
    tech_support: [
      { label: 'Dashboard', href: '/tech-support', icon: LayoutDashboard },
      { label: 'System Monitoring', href: '/tech-support/monitoring', icon: Settings },
      { label: 'Reports & Export', href: '/tech-support/reports', icon: Download },
      { label: 'Database', href: '/tech-support/database', icon: Database },
      { label: 'Activity Logs', href: '/admin/logs', icon: FileEdit },
      { label: 'All Records', href: '/admin/records', icon: ClipboardList },
    ],
  }

  const items = menuItems[role] || []

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 overflow-y-auto pt-20 border-r border-slate-700">
      <nav className="p-6 space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-3 font-medium"
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          )
        })}
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
    <div className={`pt-20 ${hasSidebar ? 'ml-64' : ''}`}>
      {children}
    </div>
  )
}
