'use client'

import { useEffect, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { ROLE_CONFIG, ROLE_CAPABILITIES, getRoleConfig, getRoleCapabilities } from '../../../lib/types'
import type { UserProfile, CreateUserForm, DeleteConfirmState } from '../../../lib/types'
import { Alert, LoadingSpinner } from '../../components/UI'
import AdminShell from '../AdminShell'
import { CheckCircle, ClipboardList, TrendingUp, FileEdit } from 'lucide-react'

export default function AdminPeoplePage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])
  const [form, setForm] = useState<CreateUserForm>({ first_name: '', last_name: '', phone_no: '', username: '', email: '', password: '', confirmPassword: '', role: 'field_volunteer', centre_eac_no: '', assigned_eacs: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [centres, setCentres] = useState<any[]>([])
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('')
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [editEacUser, setEditEacUser] = useState<UserProfile | null>(null)
  const [editAssignedEacs, setEditAssignedEacs] = useState<string[]>([])
  const [editCentreEac, setEditCentreEac] = useState('')

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token || null
      if (!token) {
        setError('Not signed in')
        return
      }
      setSessionToken(token)
      await loadUsers(token)
      await loadCentres(token)
    }
    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  async function loadUsers(token: string) {
    setError('')
    try {
      const res = await fetch('/api/admin/list-users', { headers: { Authorization: `Bearer ${token}` } })

      // Check content type
      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text()
        console.error('Non-JSON response:', text.substring(0, 200))
        setError('Server returned invalid response. Check console for details.')
        return
      }

      if (res.status === 401 || res.status === 403) {
        const json = await res.json()
        setError(json.error || 'Not authorized')
        return
      }

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || `HTTP ${res.status}`)
        return
      }

      const json = await res.json()
      setUsers(json.users || [])
    } catch (err: any) {
      console.error('Load users error:', err)
      setError(err.message || String(err))
    }
  }
  async function loadCentres(token: string) {
    try {
      const res = await fetch('/api/admin/list-centres', { headers: { Authorization: `Bearer ${token}` } })

      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text()
        console.error('Non-JSON response from centres:', text.substring(0, 200))
        return
      }

      if (!res.ok) {
        const json = await res.json()
        console.error('Failed to load centres:', json.error)
        return
      }

      const json = await res.json()
      setCentres(json.centres || [])
    } catch (err: any) {
      console.error('Load centres error:', err)
    }
  }


  // NOW CONDITIONAL RETURNS AFTER ALL HOOKS
  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthorized || !profile) {
    return (
      <main className="min-h-screen bg-surface-sunken flex items-center justify-center p-4">
        <div className="bg-surface rounded-lg shadow-lg p-6 max-w-md text-center">
          <h1 className="text-xl font-bold sm:text-2xl text-ink mb-2">Access Denied</h1>
          <p className="text-ink-muted">You don't have permission to access this page.</p>
        </div>
      </main>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    if (!sessionToken) return setError('Not signed in')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    if (form.role === 'field_volunteer' && !form.centre_eac_no) {
      setError('Please assign a centre EAC number for Field Volunteer')
      setLoading(false)
      return
    }

    if (form.role === 'dfi_field_staff' && form.assigned_eacs.length === 0) {
      setError('Please assign at least one EAC for DFI Field Staff')
      setLoading(false)
      return
    }

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        first_name: form.first_name,
        last_name: form.last_name,
        phone_no: form.phone_no,
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role,
        centre_eac_no: form.role === 'field_volunteer' ? form.centre_eac_no : null,
        assigned_eacs: form.role === 'dfi_field_staff' ? form.assigned_eacs : [],
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error || 'Failed to create user')
      setLoading(false)
      return
    }

    setSuccess(true)
    setForm({ first_name: '', last_name: '', phone_no: '', username: '', email: '', password: '', confirmPassword: '', role: 'field_volunteer', centre_eac_no: '', assigned_eacs: [] })
    setLoading(false)
    setShowForm(false)
    await loadUsers(sessionToken)
  }

  const handleDelete = async (id: string) => {
    if (!sessionToken) return setError('Not signed in')
    const user = users.find(u => u.id === id)
    if (!user) return
    setDeleteConfirm({ id, username: user.username })
    setDeleteConfirmText('')
  }

  const confirmDelete = async () => {
    if (!deleteConfirm || !sessionToken) return
    if (deleteConfirmText !== deleteConfirm.username) {
      setError('Username does not match')
      return
    }

    setLoading(true)
    const res = await fetch('/api/admin/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ id: deleteConfirm.id }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error || 'Failed to delete')
      setDeleteConfirm(null)
      return
    }

    setDeleteConfirm(null)
    setDeleteConfirmText('')
    setSuccess(true)
    await loadUsers(sessionToken)
  }

  const handleRoleChange = async (id: string, role: string) => {
    if (!sessionToken) return setError('Not signed in')
    const res = await fetch('/api/admin/update-user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ id, role }),
    })
    const json = await res.json()
    if (!res.ok) return setError(json.error || 'Failed to update')
    await loadUsers(sessionToken)
  }

  const toggleCreateAssignedEac = (eacNo: string) => {
    setForm(prev => ({
      ...prev,
      assigned_eacs: prev.assigned_eacs.includes(eacNo)
        ? prev.assigned_eacs.filter(value => value !== eacNo)
        : [...prev.assigned_eacs, eacNo],
    }))
  }

  const openEditEacModal = (user: UserProfile) => {
    setError('')
    setEditEacUser(user)
    setEditAssignedEacs((user.assigned_eacs || []).map(value => String(value)))
    setEditCentreEac(user.centre_eac_no ? String(user.centre_eac_no) : '')
  }

  const toggleEditAssignedEac = (eacNo: string) => {
    setEditAssignedEacs(prev => (
      prev.includes(eacNo)
        ? prev.filter(value => value !== eacNo)
        : [...prev, eacNo]
    ))
  }

  const saveEditedAssignedEacs = async () => {
    if (!sessionToken || !editEacUser) {
      setError('Not signed in')
      return
    }

    let requestBody: any = { id: editEacUser.id }
    if (editEacUser.role === 'dfi_field_staff') {
      if (editAssignedEacs.length === 0) {
        setError('Please select at least one EAC')
        return
      }
      requestBody.assigned_eacs = editAssignedEacs
    } else if (editEacUser.role === 'field_volunteer') {
      if (!editCentreEac) {
        setError('Please select an EAC')
        return
      }
      requestBody.centre_eac_no = editCentreEac
    } else {
      setError('EAC editing is not available for this role')
      return
    }

    setLoading(true)
    const res = await fetch('/api/admin/update-user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify(requestBody),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error || 'Failed to update EAC assignments')
      return
    }

    setEditEacUser(null)
    setEditAssignedEacs([])
    setEditCentreEac('')
    await loadUsers(sessionToken)
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesRole = !filterRole || u.role === filterRole
    return matchesSearch && matchesRole
  })

  return (
    <AdminShell active="/admin/people" breadcrumb={['Admin', 'People']} username={profile.username}>
      <div>
        <div className="p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-ink">People</h1>
                <p className="mt-2 text-ink-muted">Manage user accounts and what each role can reach.</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <a
                href="/admin/center-management"
                className="bg-surface rounded-lg border border-rule p-6 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <CheckCircle className="w-8 h-8 mb-2 text-ink group-hover:text-blue-600" />
                <h3 className="font-semibold text-ink group-hover:text-blue-600">Centre Management</h3>
                <p className="text-sm text-ink-muted mt-1">Manage Centre Data</p>
              </a>
              <a
                href="/admin/records"
                className="bg-surface rounded-lg border border-rule p-6 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <ClipboardList className="w-8 h-8 mb-2 text-ink group-hover:text-blue-600" />
                <h3 className="font-semibold text-ink group-hover:text-blue-600">All Records</h3>
                <p className="text-sm text-ink-muted mt-1">View and edit all data</p>
              </a>
              <a
                href="/admin/analytics"
                className="bg-surface rounded-lg border border-rule p-6 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <TrendingUp className="w-8 h-8 mb-2 text-ink group-hover:text-blue-600" />
                <h3 className="font-semibold text-ink group-hover:text-blue-600">Analytics</h3>
                <p className="text-sm text-ink-muted mt-1">View reports & statistics</p>
              </a>
              <a
                href="/admin/logs"
                className="bg-surface rounded-lg border border-rule p-6 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <FileEdit className="w-8 h-8 mb-2 text-ink group-hover:text-blue-600" />
                <h3 className="font-semibold text-ink group-hover:text-blue-600">Activity Logs</h3>
                <p className="text-sm text-ink-muted mt-1">View system activity</p>
              </a>
            </div>

            {/* User Management Section Header */}
            <div>
              <h2 className="text-xl font-bold sm:text-2xl text-ink">User Management</h2>
              <p className="text-ink-muted mt-1">Manage your team members and their account permissions.</p>
            </div>

            {/* Messages */}
            {error && (
              <Alert type="error" message={error} onDismiss={() => setError('')} />
            )}
            {success && (
              <Alert type="success" message="User created successfully!" onDismiss={() => setSuccess(false)} />
            )}

            {/* User Management Section */}
            <div className="rounded-lg bg-surface border border-rule shadow-sm">
              {/* Top Bar with Controls */}
              <div className="flex items-center justify-between gap-4 border-b border-rule p-6">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1 max-w-xs">
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-rule-strong text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-rule-strong text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Roles</option>
                    {ROLE_CONFIG.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setShowForm(!showForm)}
                  className="min-h-[40px] px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Add User
                </button>
              </div>

              {/* Create User Form - Expandable */}
              {showForm && (
                <div className="border-b border-rule p-6 bg-surface-sunken">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-2 uppercase">First Name</label>
                        <input
                          type="text"
                          placeholder="John"
                          value={form.first_name}
                          onChange={e => setForm({ ...form, first_name: e.target.value })}
                          className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-2 uppercase">Last Name</label>
                        <input
                          type="text"
                          placeholder="Doe"
                          value={form.last_name}
                          onChange={e => setForm({ ...form, last_name: e.target.value })}
                          className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-2 uppercase">Contact Number</label>
                        <input
                          type="tel"
                          placeholder="9876543210"
                          value={form.phone_no}
                          onChange={e => setForm({ ...form, phone_no: e.target.value })}
                          className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-2 uppercase">Username</label>
                        <input
                          type="text"
                          placeholder="john.doe"
                          value={form.username}
                          onChange={e => setForm({ ...form, username: e.target.value })}
                          className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-2 uppercase">Email</label>
                        <input
                          type="email"
                          placeholder="john@example.com"
                          value={form.email}
                          onChange={e => setForm({ ...form, email: e.target.value })}
                          className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-2 uppercase">Password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={form.password}
                          onChange={e => setForm({ ...form, password: e.target.value })}
                          className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-2 uppercase">Confirm Password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={form.confirmPassword}
                          onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${form.password && form.confirmPassword && form.password !== form.confirmPassword
                            ? 'border-red-300 focus:ring-red-500 bg-red-50'
                            : 'border-rule-strong focus:ring-blue-500'
                            }`}
                          required
                        />
                        {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                          <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink mb-2 uppercase">Role</label>
                      <select
                        value={form.role}
                        onChange={e => {
                          const nextRole = e.target.value as any
                          setForm({
                            ...form,
                            role: nextRole,
                            centre_eac_no: nextRole === 'field_volunteer' ? form.centre_eac_no : '',
                            assigned_eacs: nextRole === 'dfi_field_staff' ? form.assigned_eacs : [],
                          })
                        }}
                        className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {ROLE_CONFIG.map(role => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {form.role === 'field_volunteer' && (
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-2 uppercase">Assign Centre EAC No</label>
                        <select
                          value={form.centre_eac_no}
                          onChange={e => setForm({ ...form, centre_eac_no: e.target.value })}
                          className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select EAC No</option>
                          {centres.map((centre) => (
                            <option key={centre.eac_no} value={String(centre.eac_no)}>
                              {centre.eac_no}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {form.role === 'dfi_field_staff' && (
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-2 uppercase">Assign EAC Nos</label>
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-rule-strong bg-surface p-3 space-y-2">
                          {centres.map((centre) => (
                            <label key={centre.eac_no} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.assigned_eacs.includes(String(centre.eac_no))}
                                onChange={() => toggleCreateAssignedEac(String(centre.eac_no))}
                                className="h-4 w-4 rounded border-rule-strong text-blue-600 focus:ring-blue-500"
                              />
                              <span>{centre.eac_no}</span>
                            </label>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">Selected: {form.assigned_eacs.length}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <button
                        type="submit"
                        disabled={loading || (form.password !== form.confirmPassword && form.confirmPassword.length > 0)}
                        className="min-h-[40px] px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? 'Creating…' : 'Create User'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="min-h-[40px] px-4 py-2 bg-rule text-ink text-sm font-medium rounded-lg hover:bg-rule-strong transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Users Table */}
              <div className="overflow-auto max-h-[480px]">
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule bg-surface-sunken">
                      <th className="px-6 py-3 text-left font-semibold text-ink">Full name</th>
                      <th className="px-6 py-3 text-left font-semibold text-ink">First Name</th>
                      <th className="px-6 py-3 text-left font-semibold text-ink">Last Name</th>
                      <th className="px-6 py-3 text-left font-semibold text-ink">Contact Number</th>
                      <th className="px-6 py-3 text-left font-semibold text-ink">Email</th>
                      <th className="px-6 py-3 text-left font-semibold text-ink">Role</th>
                      <th className="px-6 py-3 text-left font-semibold text-ink">Assigned EAC(s)</th>
                      <th className="px-6 py-3 text-left font-semibold text-ink">Status</th>
                      <th className="px-6 py-3 text-left font-semibold text-ink">Edit EAC</th>
                      <th className="px-6 py-3 text-left font-semibold text-ink">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-ink-faint">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => {
                        const roleInfo = getRoleConfig(u.role)
                        return (
                          <tr key={u.id} className="border-b border-rule hover:bg-surface-hover transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                                  {u.username.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-ink">{u.username}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-ink">{u.first_name || '-'}</td>
                            <td className="px-6 py-4 text-ink">{u.last_name || '-'}</td>
                            <td className="px-6 py-4 text-ink">{u.phone_no || '-'}</td>
                            <td className="px-6 py-4 text-ink">{u.email}</td>
                            <td className="px-6 py-4">
                              <select
                                defaultValue={u.role || 'field_volunteer'}
                                onChange={e => handleRoleChange(u.id, e.target.value)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${roleInfo?.color}`}
                              >
                                {ROLE_CONFIG.map(role => (
                                  <option key={role.value} value={role.value}>
                                    {role.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4 text-ink">
                              {u.role === 'field_volunteer'
                                ? (u.centre_eac_no || '-')
                                : u.role === 'dfi_field_staff'
                                  ? (u.assigned_eacs && u.assigned_eacs.length > 0 ? u.assigned_eacs.join(', ') : '-')
                                  : '-'}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="text-xs font-medium text-ink">Active</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {(u.role === 'dfi_field_staff' || u.role === 'field_volunteer') ? (
                                <button
                                  onClick={() => openEditEacModal(u)}
                                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                >
                                  Edit EAC
                                </button>
                              ) : (
                                <span className="text-ink-faint">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleDelete(u.id)}
                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table></div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-rule px-6 py-4 bg-surface-sunken text-sm text-ink-muted">
                <span>Showing {filteredUsers.length} of {users.length} users</span>
              </div>
            </div>

            {/* Delete Confirmation Modal */}
            {editEacUser && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-surface rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-ink">Edit EAC Assignment</h3>
                  <p className="text-sm text-ink-muted">Update EAC assignment for <span className="font-semibold">{editEacUser.username}</span>.</p>

                  {editEacUser.role === 'dfi_field_staff' ? (
                    <>
                      <div className="max-h-60 overflow-y-auto rounded-lg border border-rule-strong p-3 space-y-2">
                        {centres.map((centre) => (
                          <label key={centre.eac_no} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editAssignedEacs.includes(String(centre.eac_no))}
                              onChange={() => toggleEditAssignedEac(String(centre.eac_no))}
                              className="h-4 w-4 rounded border-rule-strong text-blue-600 focus:ring-blue-500"
                            />
                            <span>{centre.eac_no}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-ink-faint">Selected: {editAssignedEacs.length}</p>
                    </>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-2 uppercase">Assign Centre EAC No</label>
                      <select
                        value={editCentreEac}
                        onChange={e => setEditCentreEac(e.target.value)}
                        className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select EAC No</option>
                        {centres.map((centre) => (
                          <option key={centre.eac_no} value={String(centre.eac_no)}>
                            {centre.eac_no}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setEditEacUser(null)
                        setEditAssignedEacs([])
                        setEditCentreEac('')
                        setError('')
                      }}
                      className="flex-1 px-4 py-2 bg-rule text-ink text-sm font-medium rounded-lg hover:bg-rule-strong transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEditedAssignedEacs}
                      disabled={loading || (editEacUser.role === 'dfi_field_staff' ? editAssignedEacs.length === 0 : !editCentreEac)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? 'Saving…' : 'Save EAC'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {deleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-surface rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-ink">Delete user</h3>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      Are you sure you want to delete <span className="font-semibold">{deleteConfirm.username}</span>? This action cannot be undone.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Type the username to confirm deletion:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder={deleteConfirm.username}
                      className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-lg border border-rule-strong text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      autoFocus
                    />
                  </div>

                  {error && deleteConfirm && (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setDeleteConfirm(null)
                        setDeleteConfirmText('')
                        setError('')
                      }}
                      className="flex-1 px-4 py-2 bg-rule text-ink text-sm font-medium rounded-lg hover:bg-rule-strong transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      disabled={deleteConfirmText !== deleteConfirm.username || loading}
                      className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? 'Deleting…' : 'Delete User'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AdminShell>
  )
}
