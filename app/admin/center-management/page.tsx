'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'

type CentreRecord = {
  id: string
  eac_no: string | number
  village_name: string | null
  centre_id: string | null
  district: string | null
  taluk: string | null
  panchayat: string | null
  village: string | null
}

type CentreFormState = {
  eac_no: string
  village_name: string
  centre_id: string
  district: string
  taluk: string
  panchayat: string
  village: string
}

const emptyForm: CentreFormState = {
  eac_no: '',
  village_name: '',
  centre_id: '',
  district: '',
  taluk: '',
  panchayat: '',
  village: '',
}

export default function CenterManagementPage() {
  const router = useRouter()
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [centres, setCentres] = useState<CentreRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState<CentreFormState>(emptyForm)
  const [editCentre, setEditCentre] = useState<CentreRecord | null>(null)
  const [editForm, setEditForm] = useState<CentreFormState>(emptyForm)
  const [deleteCentre, setDeleteCentre] = useState<CentreRecord | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token || null
      if (!token) {
        setError('Not signed in')
        setLoading(false)
        return
      }
      setSessionToken(token)
      await loadCentres(token)
    }

    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  const loadCentres = async (token: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/list-centres', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load centres')
      setCentres(json.centres || [])
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionToken) return

    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/centres/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(createForm),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create centre')

      setCreateForm(emptyForm)
      setSuccess('Centre created successfully!')
      await loadCentres(sessionToken)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setActionLoading(false)
    }
  }

  const openEditModal = (centre: CentreRecord) => {
    setError('')
    setEditCentre(centre)
    setEditForm({
      eac_no: String(centre.eac_no || ''),
      village_name: centre.village_name || '',
      centre_id: centre.centre_id || '',
      district: centre.district || '',
      taluk: centre.taluk || '',
      panchayat: centre.panchayat || '',
      village: centre.village || '',
    })
  }

  const handleUpdate = async () => {
    if (!sessionToken || !editCentre) return

    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/centres/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ id: editCentre.id, ...editForm }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update centre')

      setEditCentre(null)
      setSuccess('Centre updated successfully!')
      await loadCentres(sessionToken)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!sessionToken || !deleteCentre) return

    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/centres/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ id: deleteCentre.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete centre')

      setDeleteCentre(null)
      setSuccess('Centre deleted successfully!')
      await loadCentres(sessionToken)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setActionLoading(false)
    }
  }

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

  const roleInfo = ROLE_CONFIG.find(r => r.value === 'admin')!

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar
        username={profile.username}
        role="admin"
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color}
      />
      <Sidebar role="admin" />

      <PageContainer>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Centre Management</h1>
              <p className="mt-1 text-slate-600">Create, edit, and delete centre records.</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>

          {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
          {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create Centre</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="number"
                placeholder="EAC No"
                value={createForm.eac_no}
                onChange={e => setCreateForm({ ...createForm, eac_no: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Village Name"
                value={createForm.village_name}
                onChange={e => setCreateForm({ ...createForm, village_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Centre ID"
                value={createForm.centre_id}
                onChange={e => setCreateForm({ ...createForm, centre_id: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="District"
                value={createForm.district}
                onChange={e => setCreateForm({ ...createForm, district: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Taluk"
                value={createForm.taluk}
                onChange={e => setCreateForm({ ...createForm, taluk: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Panchayat"
                value={createForm.panchayat}
                onChange={e => setCreateForm({ ...createForm, panchayat: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Village"
                value={createForm.village}
                onChange={e => setCreateForm({ ...createForm, village: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Creating…' : 'Create Centre'}
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : centres.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No centres found</div>
            ) : (
              <div className="overflow-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">EAC No</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Village Name</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Centre ID</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">District</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Taluk</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Panchayat</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Village</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {centres.map((centre) => (
                      <tr key={centre.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-900 font-medium">{centre.eac_no}</td>
                        <td className="px-6 py-4 text-slate-700">{centre.village_name}</td>
                        <td className="px-6 py-4 text-slate-700">{centre.centre_id}</td>
                        <td className="px-6 py-4 text-slate-700">{centre.district}</td>
                        <td className="px-6 py-4 text-slate-700">{centre.taluk}</td>
                        <td className="px-6 py-4 text-slate-700">{centre.panchayat}</td>
                        <td className="px-6 py-4 text-slate-700">{centre.village}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openEditModal(centre)}
                              className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteCentre(centre)}
                              className="text-red-600 hover:text-red-700 font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageContainer>

      {editCentre && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Edit Centre</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="EAC No"
                value={editForm.eac_no}
                onChange={e => setEditForm({ ...editForm, eac_no: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Village Name"
                value={editForm.village_name}
                onChange={e => setEditForm({ ...editForm, village_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Centre ID"
                value={editForm.centre_id}
                onChange={e => setEditForm({ ...editForm, centre_id: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="District"
                value={editForm.district}
                onChange={e => setEditForm({ ...editForm, district: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Taluk"
                value={editForm.taluk}
                onChange={e => setEditForm({ ...editForm, taluk: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Panchayat"
                value={editForm.panchayat}
                onChange={e => setEditForm({ ...editForm, panchayat: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Village"
                value={editForm.village}
                onChange={e => setEditForm({ ...editForm, village: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
                required
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditCentre(null)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCentre && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Delete Centre</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete centre <span className="font-semibold">EAC {deleteCentre.eac_no}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteCentre(null)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
