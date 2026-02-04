import type { UserProfile, UsersListResponse, CreateUserForm } from './types'

/**
 * Authenticated API call helper
 */
async function apiCall<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: any
    token?: string
  } = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`)
  }

  return data
}

/**
 * Admin API: List all users
 */
export async function listUsers(token: string): Promise<UserProfile[]> {
  const response = await apiCall<UsersListResponse>('/api/admin/list-users', { token })
  return response.users || []
}

/**
 * Admin API: Create new user
 */
export async function createUser(
  data: CreateUserForm & { role: string },
  token: string
): Promise<UserProfile> {
  return apiCall<UserProfile>('/api/admin/create-user', {
    method: 'POST',
    body: data,
    token,
  })
}

/**
 * Admin API: Update user role
 */
export async function updateUserRole(
  userId: string,
  role: string,
  token: string
): Promise<UserProfile> {
  return apiCall<UserProfile>('/api/admin/update-user', {
    method: 'PUT',
    body: { id: userId, role },
    token,
  })
}

/**
 * Admin API: Delete user
 */
export async function deleteUser(userId: string, token: string): Promise<{ success: boolean }> {
  return apiCall<{ success: boolean }>('/api/admin/delete-user', {
    method: 'DELETE',
    body: { id: userId },
    token,
  })
}

/**
 * Sign in user
 */
export async function signInUser(
  username: string,
  password: string,
  supabaseClient: any
): Promise<any> {
  // Get email from username first
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('email')
    .eq('username', username.toLowerCase())
    .single()

  if (!profile) {
    throw new Error('User not found')
  }

  // Sign in with email
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (error) throw error
  return data
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string, supabaseClient: any): Promise<UserProfile | null> {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return null
  return data
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
  supabaseClient: any
): Promise<UserProfile> {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}
