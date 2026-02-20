// User Roles
export type UserRole = 'field_volunteer' | 'dfi_field_staff' | 'dfi_staff' | 'admin' | 'tech_support'

// Role Configuration
export interface RoleConfig {
  value: UserRole
  label: string
  tier: number
  color: string
  description: string
}

// User Profile
export interface UserProfile {
  id: string
  username: string
  email: string | null
  role: UserRole | null
  created_at?: string
  updated_at?: string
}

// Auth Session
export interface AuthSession {
  user: {
    id: string
    email?: string | null
    aud?: string
    created_at?: string
  } | null
  access_token: string | null
  refresh_token?: string | null
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

// User List Response
export interface UsersListResponse {
  users: UserProfile[]
  total?: number
}

// Common form state
export interface CreateUserForm {
  username: string
  email: string
  password: string
  confirmPassword: string
  role: UserRole
}

// Delete confirmation state
export interface DeleteConfirmState {
  id: string
  username: string
}

// Role Capabilities
export type RoleCapabilities = Record<UserRole, string[]>

// Export role config and capabilities as constants
export const ROLE_CONFIG: RoleConfig[] = [
  {
    value: 'field_volunteer',
    label: 'Field Volunteer',
    tier: 5,
    color: 'bg-blue-100 text-blue-800',
    description: 'Field data entry and reporting',
  },
  {
    value: 'dfi_field_staff',
    label: 'DFI Field Staff',
    tier: 4,
    color: 'bg-green-100 text-green-800',
    description: 'Field data verification and updates',
  },
  {
    value: 'dfi_staff',
    label: 'DFI Staff',
    tier: 3,
    color: 'bg-purple-100 text-purple-800',
    description: 'Data review and verification',
  },
  {
    value: 'admin',
    label: 'Admin Member',
    tier: 2,
    color: 'bg-red-100 text-red-800',
    description: 'System administration and approvals',
  },
  {
    value: 'tech_support',
    label: 'Tech Support Team',
    tier: 1,
    color: 'bg-orange-100 text-orange-800',
    description: 'Technical support and maintenance',
  },
]

export const ROLE_CAPABILITIES: RoleCapabilities = {
  field_volunteer: ['View assigned tasks', 'Submit reports', 'Update field data', 'View personal activity history'],
  dfi_field_staff: ['Verify/View submitted data', 'View personal activity history'],
  dfi_staff: ['Verify/Edit/View submitted data', 'Update assigned records', 'View personal activity history'],
  admin: ['Approve/reject submissions', 'Edit records', 'Manage user roles', 'Generate analytics', 'Full volunteer data access'],
  tech_support: ['System monitoring', 'Bug fixes', 'Database management', 'Implement updates', 'Access system configuration'],
}

// Helper to get role config
export function getRoleConfig(role: UserRole | null | undefined): RoleConfig | undefined {
  return ROLE_CONFIG.find(r => r.value === role)
}

// Helper to get role capabilities
export function getRoleCapabilities(role: UserRole | null | undefined): string[] {
  if (!role) return []
  return ROLE_CAPABILITIES[role] || []
}

// Helper to validate role
export function isValidRole(role: any): role is UserRole {
  return ['field_volunteer', 'dfi_field_staff', 'dfi_staff', 'admin', 'tech_support'].includes(role)
}
