import {
  LayoutGrid,
  Users,
  Building2,
  List,
  CheckCheck,
  Upload,
  BarChart3,
  ScrollText,
  UserCog,
  UserPlus,
  Download,
  History,
  ClipboardCheck,
  Eye,
  MapPin,
  FileBarChart,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from './types'

/**
 * Sidebar contents for every role, in one place.
 *
 * The old `Sidebar` listed pages that don't exist (tech-support monitoring and
 * database) and pages middleware blocks for the role looking at them; only
 * routes a role can actually reach are listed here.
 */
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  heading: string
  items: NavItem[]
}

export const NAV_BY_ROLE: Record<UserRole, NavGroup[]> = {
  admin: [
    {
      heading: 'Manage records',
      items: [
        { label: 'Overview', href: '/admin/manage-records', icon: LayoutGrid },
        { label: 'Child data', href: '/admin/child-data', icon: Users },
        { label: 'Centre data', href: '/admin/center-management', icon: Building2 },
        { label: 'Places', href: '/admin/places', icon: MapPin },
        { label: 'All records', href: '/admin/records', icon: List },
      ],
    },
    {
      heading: 'Data',
      items: [
        { label: 'Import', href: '/admin/import', icon: Upload },
        { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
        { label: 'Reports', href: '/admin/reports', icon: FileBarChart },
      ],
    },
    {
      heading: 'Admin',
      items: [
        { label: 'People', href: '/admin/people', icon: UserCog },
        { label: 'Activity log', href: '/admin/logs', icon: ScrollText },
      ],
    },
  ],
  dfi_staff: [
    {
      heading: 'Review',
      items: [
        { label: 'Overview', href: '/dfi-staff', icon: LayoutGrid },
        { label: 'Approvals', href: '/dfi-staff/approvals', icon: ClipboardCheck },
        { label: 'All records', href: '/dfi-staff/all-records', icon: List },
        { label: 'History', href: '/dfi-staff/history', icon: History },
      ],
    },
  ],
  dfi_field_staff: [
    {
      heading: 'Field',
      items: [
        { label: 'Overview', href: '/dfi-field-staff', icon: LayoutGrid },
        { label: 'Verify data', href: '/dfi-field-staff/approve-data', icon: ClipboardCheck },
        { label: 'View data', href: '/dfi-field-staff/view-data', icon: Eye },
        { label: 'History', href: '/dfi-field-staff/history', icon: History },
      ],
    },
  ],
  field_volunteer: [
    {
      heading: 'My work',
      items: [
        { label: 'Overview', href: '/field-volunteer', icon: LayoutGrid },
        { label: 'New child', href: '/field-volunteer/child-data-entry', icon: UserPlus },
        { label: 'My submissions', href: '/field-volunteer/history', icon: History },
        { label: 'Reports', href: '/field-volunteer/reports', icon: Download },
      ],
    },
  ],
  tech_support: [
    {
      heading: 'Support',
      items: [
        { label: 'Overview', href: '/tech-support', icon: LayoutGrid },
        { label: 'Reports', href: '/tech-support/reports', icon: CheckCheck },
      ],
    },
  ],
}
