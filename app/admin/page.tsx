'use client'

import { useEffect, useState } from 'react'
import { useRequireRole } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { ROLE_CONFIG, ROLE_CAPABILITIES, getRoleConfig, getRoleCapabilities } from '../../lib/types'
import type { UserProfile, CreateUserForm, DeleteConfirmState } from '../../lib/types'
import { Alert, LoadingSpinner } from '../components/UI'
import { Navbar, Sidebar, PageContainer } from '../components/Navbar'
import { CheckCircle, ClipboardList, TrendingUp, FileEdit } from 'lucide-react'

export default function AdminPage() {
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
  const [resetPasswordResult, setResetPasswordResult] = useState<{ username: string; temporaryPassword: string } | null>(null)
  const [passwordCopied, setPasswordCopied] = useState(false)

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthorized || !profile) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You don't have permission to access this page.</p>
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

  const resetUserPassword = async (user: UserProfile) => {
    if (!sessionToken) {
      setError('Not signed in')
      return
    }

    const isConfirmed = window.confirm(`Reset password for ${user.username}?`)
    if (!isConfirmed) return

    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ id: user.id }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error || 'Failed to reset password')
      return
    }

    setResetPasswordResult({ username: user.username, temporaryPassword: json.temporaryPassword })
    setPasswordCopied(false)
  }

  const copyTemporaryPassword = async () => {
    if (!resetPasswordResult) return
    try {
      await navigator.clipboard.writeText(resetPasswordResult.temporaryPassword)
      setPasswordCopied(true)
    } catch {
      setError('Failed to copy password to clipboard')
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesRole = !filterRole || u.role === filterRole
    return matchesSearch && matchesRole
  })

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar
        username={profile.username}
        role="admin"
        roleLabel="Admin"
        roleColor="bg-indigo-100 text-indigo-800"
      />
      <Sidebar role="admin" />

      <PageContainer>
        <div className="p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="mt-2 text-slate-600">Manage users, approvals, and system settings.</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <a
                href="/admin/approvals"
                className="bg-white rounded-lg border border-slate-200 p-6 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <CheckCircle className="w-8 h-8 mb-2 text-slate-700 group-hover:text-blue-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">Approvals Queue</h3>
                <p className="text-sm text-slate-600 mt-1">Review pending submissions</p>
              </a>
              <a
                href="/admin/records"
                className="bg-white rounded-lg border border-slate-200 p-6 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <ClipboardList className="w-8 h-8 mb-2 text-slate-700 group-hover:text-blue-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">All Records</h3>
                <p className="text-sm text-slate-600 mt-1">View and edit all data</p>
              </a>
              <a
                href="/admin/analytics"
                className="bg-white rounded-lg border border-slate-200 p-6 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <TrendingUp className="w-8 h-8 mb-2 text-slate-700 group-hover:text-blue-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">Analytics</h3>
                <p className="text-sm text-slate-600 mt-1">View reports & statistics</p>
              </a>
              <a
                href="/admin/logs"
                className="bg-white rounded-lg border border-slate-200 p-6 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <FileEdit className="w-8 h-8 mb-2 text-slate-700 group-hover:text-blue-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">Activity Logs</h3>
                <p className="text-sm text-slate-600 mt-1">View system activity</p>
              </a>
            </div>

            {/* User Management Section Header */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
              <p className="text-slate-600 mt-1">Manage your team members and their account permissions.</p>
            </div>

            {/* Messages */}
            {error && (
              <Alert type="error" message={error} onDismiss={() => setError('')} />
            )}
            {success && (
              <Alert type="success" message="User created successfully!" onDismiss={() => setSuccess(false)} />
            )}

            {/* User Management Section */}
            <div className="rounded-lg bg-white border border-slate-200 shadow-sm">
              {/* Top Bar with Controls */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1 max-w-xs">
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Add User
                </button>
              </div>

              {/* Create User Form - Expandable */}
              {showForm && (
                <div className="border-b border-slate-200 p-6 bg-slate-50">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">First Name</label>
                        <input
                          type="text"
                          placeholder="John"
                          value={form.first_name}
                          onChange={e => setForm({ ...form, first_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Last Name</label>
                        <input
                          type="text"
                          placeholder="Doe"
                          value={form.last_name}
                          onChange={e => setForm({ ...form, last_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Contact Number</label>
                        <input
                          type="tel"
                          placeholder="9876543210"
                          value={form.phone_no}
                          onChange={e => setForm({ ...form, phone_no: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Username</label>
                        <input
                          type="text"
                          placeholder="john.doe"
                          value={form.username}
                          onChange={e => setForm({ ...form, username: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Email</label>
                        <input
                          type="email"
                          placeholder="john@example.com"
                          value={form.email}
                          onChange={e => setForm({ ...form, email: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={form.password}
                          onChange={e => setForm({ ...form, password: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Confirm Password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={form.confirmPassword}
                          onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${form.password && form.confirmPassword && form.password !== form.confirmPassword
                            ? 'border-red-300 focus:ring-red-500 bg-red-50'
                            : 'border-slate-300 focus:ring-blue-500'
                            }`}
                          required
                        />
                        {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                          <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Role</label>
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
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Assign Centre EAC No</label>
                        <select
                          value={form.centre_eac_no}
                          onChange={e => setForm({ ...form, centre_eac_no: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Assign EAC Nos</label>
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-300 bg-white p-3 space-y-2">
                          {centres.map((centre) => (
                            <label key={centre.eac_no} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.assigned_eacs.includes(String(centre.eac_no))}
                                onChange={() => toggleCreateAssignedEac(String(centre.eac_no))}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>{centre.eac_no}</span>
                            </label>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Selected: {form.assigned_eacs.length}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <button
                        type="submit"
                        disabled={loading || (form.password !== form.confirmPassword && form.confirmPassword.length > 0)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? 'Creating…' : 'Create User'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Users Table */}
              <div className="overflow-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Full name</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">First Name</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Last Name</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Contact Number</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Email</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Role</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Assigned EAC(s)</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Status</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Edit EAC</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Reset Password</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => {
                        const roleInfo = getRoleConfig(u.role)
                        return (
                          <tr key={u.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                                  {u.username.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-900">{u.username}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-700">{u.first_name || '-'}</td>
                            <td className="px-6 py-4 text-slate-700">{u.last_name || '-'}</td>
                            <td className="px-6 py-4 text-slate-700">{u.phone_no || '-'}</td>
                            <td className="px-6 py-4 text-slate-700">{u.email}</td>
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
                            <td className="px-6 py-4 text-slate-700">
                              {u.role === 'field_volunteer'
                                ? (u.centre_eac_no || '-')
                                : u.role === 'dfi_field_staff'
                                  ? (u.assigned_eacs && u.assigned_eacs.length > 0 ? u.assigned_eacs.join(', ') : '-')
                                  : '-'}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="text-xs font-medium text-slate-700">Active</span>
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
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => resetUserPassword(u)}
                                className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                              >
                                Reset Password
                              </button>
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
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50 text-sm text-slate-600">
                <span>Showing {filteredUsers.length} of {users.length} users</span>
              </div>
            </div>

            {/* Centre Management Section */}
            <div className="rounded-lg bg-white border border-slate-200 shadow-sm">
              {/* Header */}
              <div className="border-b border-slate-200 p-6 bg-slate-50">
                <h2 className="text-2xl font-bold text-slate-900">Centre Management</h2>
                <p className="text-slate-600 mt-1">Manage data collection centres and their details.</p>
              </div>

              {/* Centres Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">EAC No</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Village Name</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Centre ID</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">District</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Taluk</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Panchayat</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Village</th>
                    </tr>
                  </thead>
                  <tbody>
                    {centres.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          No centres found
                        </td>
                      </tr>
                    ) : (
                      centres.map((centre) => (
                        <tr key={centre.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-900">{centre.eac_no}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-700">{centre.village_name}</td>
                          <td className="px-6 py-4 text-slate-700">{centre.centre_id}</td>
                          <td className="px-6 py-4 text-slate-700">{centre.district}</td>
                          <td className="px-6 py-4 text-slate-700">{centre.taluk}</td>
                          <td className="px-6 py-4 text-slate-700">{centre.panchayat}</td>
                          <td className="px-6 py-4 text-slate-700">{centre.village}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50 text-sm text-slate-600">
                <span>Showing {centres.length} centre{centres.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Delete Confirmation Modal */}
            {editEacUser && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Edit EAC Assignment</h3>
                  <p className="text-sm text-slate-600">Update EAC assignment for <span className="font-semibold">{editEacUser.username}</span>.</p>

                  {editEacUser.role === 'dfi_field_staff' ? (
                    <>
                      <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-300 p-3 space-y-2">
                        {centres.map((centre) => (
                          <label key={centre.eac_no} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editAssignedEacs.includes(String(centre.eac_no))}
                              onChange={() => toggleEditAssignedEac(String(centre.eac_no))}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{centre.eac_no}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">Selected: {editAssignedEacs.length}</p>
                    </>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase">Assign Centre EAC No</label>
                      <select
                        value={editCentreEac}
                        onChange={e => setEditCentreEac(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-colors"
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
                <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Delete user</h3>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      Are you sure you want to delete <span className="font-semibold">{deleteConfirm.username}</span>? This action cannot be undone.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Type the username to confirm deletion:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder={deleteConfirm.username}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
                      className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-colors"
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

            {resetPasswordResult && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Temporary Password Generated</h3>
                  <p className="text-sm text-slate-600">
                    Temporary password for <span className="font-semibold">{resetPasswordResult.username}</span>:
                  </p>
                  <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 break-all">
                    {resetPasswordResult.temporaryPassword}
                  </div>
                  <p className="text-xs text-slate-500">This password remains valid until it is changed again.</p>
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={copyTemporaryPassword}
                      className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      {passwordCopied ? 'Copied' : 'Copy Password'}
                    </button>
                    <button
                      onClick={() => {
                        setResetPasswordResult(null)
                        setPasswordCopied(false)
                      }}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
