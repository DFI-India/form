'use client'

import { useEffect, useMemo, useState } from 'react'
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
  district: string | null
  taluk: string | null
  panchayat: string | null
  start_date: string | null
  end_date: string | null
  cbv_name: string | null
  in_charge: string | null
  panchayat_member: string | null
  head_master: string | null
  anganvadi: string | null
  asha_worker: string | null
  head_master_mobile: string | null
  in_charge_mobile: string | null
  cbv_mobile: string | null
  panchayat_member_mobile: string | null
  anganvadi_mobile: string | null
  asha_worker_mobile: string | null
  cbv_email: string | null
}

type CentreFormState = {
  eac_no: string
  village_name: string
  district: string
  taluk: string
  panchayat: string
  start_date: string
  end_date: string
  cbv_name: string
  in_charge: string
  panchayat_member: string
  head_master: string
  anganvadi: string
  asha_worker: string
  head_master_mobile: string
  in_charge_mobile: string
  cbv_mobile: string
  panchayat_member_mobile: string
  anganvadi_mobile: string
  asha_worker_mobile: string
  cbv_email: string
}

const emptyForm: CentreFormState = {
  eac_no: '',
  village_name: '',
  district: '',
  taluk: '',
  panchayat: '',
  start_date: '',
  end_date: '',
  cbv_name: '',
  in_charge: '',
  panchayat_member: '',
  head_master: '',
  anganvadi: '',
  asha_worker: '',
  head_master_mobile: '',
  in_charge_mobile: '',
  cbv_mobile: '',
  panchayat_member_mobile: '',
  anganvadi_mobile: '',
  asha_worker_mobile: '',
  cbv_email: '',
}

const tableColumns: Array<{ key: keyof CentreFormState; label: string }> = [
  { key: 'eac_no', label: 'EAC No' },
  { key: 'village_name', label: 'Village Name' },
  { key: 'district', label: 'District' },
  { key: 'taluk', label: 'Taluk' },
  { key: 'panchayat', label: 'Panchayat' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'End Date' },
  { key: 'cbv_name', label: 'CBV Name' },
  { key: 'in_charge', label: 'In Charge' },
  { key: 'panchayat_member', label: 'Panchayat Member' },
  { key: 'head_master', label: 'Head Master' },
  { key: 'anganvadi', label: 'Anganvadi' },
  { key: 'asha_worker', label: 'ASHA Worker' },
  { key: 'head_master_mobile', label: 'Head Master Mobile' },
  { key: 'in_charge_mobile', label: 'In Charge Mobile' },
  { key: 'cbv_mobile', label: 'CBV Mobile' },
  { key: 'panchayat_member_mobile', label: 'Panchayat Member Mobile' },
  { key: 'anganvadi_mobile', label: 'Anganvadi Mobile' },
  { key: 'asha_worker_mobile', label: 'ASHA Worker Mobile' },
  { key: 'cbv_email', label: 'CBV Email' },
]

type SortDirection = 'asc' | 'desc'
type SortableColumn = keyof CentreFormState

const nonSortableColumns = new Set<SortableColumn>([
  'head_master_mobile',
  'in_charge_mobile',
  'cbv_mobile',
  'panchayat_member_mobile',
  'anganvadi_mobile',
  'asha_worker_mobile',
  'cbv_email',
])

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
  const [sortColumn, setSortColumn] = useState<SortableColumn>('eac_no')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const sortedCentres = useMemo(() => {
    const rows = [...centres]

    rows.sort((a, b) => {
      const aValue = a[sortColumn as keyof CentreRecord]
      const bValue = b[sortColumn as keyof CentreRecord]

      if (aValue === null || aValue === undefined || aValue === '') return 1
      if (bValue === null || bValue === undefined || bValue === '') return -1

      if (sortColumn === 'eac_no') {
        const left = Number(aValue)
        const right = Number(bValue)
        if (left < right) return sortDirection === 'asc' ? -1 : 1
        if (left > right) return sortDirection === 'asc' ? 1 : -1
        return 0
      }

      const left = String(aValue).toLowerCase()
      const right = String(bValue).toLowerCase()
      if (left < right) return sortDirection === 'asc' ? -1 : 1
      if (left > right) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return rows
  }, [centres, sortColumn, sortDirection])

  const toggleSort = (column: SortableColumn) => {
    if (nonSortableColumns.has(column)) return

    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortColumn(column)
    setSortDirection('asc')
  }

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
      district: centre.district || '',
      taluk: centre.taluk || '',
      panchayat: centre.panchayat || '',
      start_date: centre.start_date || '',
      end_date: centre.end_date || '',
      cbv_name: centre.cbv_name || '',
      in_charge: centre.in_charge || '',
      panchayat_member: centre.panchayat_member || '',
      head_master: centre.head_master || '',
      anganvadi: centre.anganvadi || '',
      asha_worker: centre.asha_worker || '',
      head_master_mobile: centre.head_master_mobile || '',
      in_charge_mobile: centre.in_charge_mobile || '',
      cbv_mobile: centre.cbv_mobile || '',
      panchayat_member_mobile: centre.panchayat_member_mobile || '',
      anganvadi_mobile: centre.anganvadi_mobile || '',
      asha_worker_mobile: centre.asha_worker_mobile || '',
      cbv_email: centre.cbv_email || '',
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
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                type="date"
                placeholder="Start Date"
                value={createForm.start_date}
                onChange={e => setCreateForm({ ...createForm, start_date: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                placeholder="End Date"
                value={createForm.end_date}
                onChange={e => setCreateForm({ ...createForm, end_date: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="CBV Name"
                value={createForm.cbv_name}
                onChange={e => setCreateForm({ ...createForm, cbv_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="In Charge"
                value={createForm.in_charge}
                onChange={e => setCreateForm({ ...createForm, in_charge: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Panchayat Member"
                value={createForm.panchayat_member}
                onChange={e => setCreateForm({ ...createForm, panchayat_member: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Head Master"
                value={createForm.head_master}
                onChange={e => setCreateForm({ ...createForm, head_master: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Anganvadi"
                value={createForm.anganvadi}
                onChange={e => setCreateForm({ ...createForm, anganvadi: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="ASHA Worker"
                value={createForm.asha_worker}
                onChange={e => setCreateForm({ ...createForm, asha_worker: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Head Master Mobile"
                value={createForm.head_master_mobile}
                onChange={e => setCreateForm({ ...createForm, head_master_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="In Charge Mobile"
                value={createForm.in_charge_mobile}
                onChange={e => setCreateForm({ ...createForm, in_charge_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="CBV Mobile"
                value={createForm.cbv_mobile}
                onChange={e => setCreateForm({ ...createForm, cbv_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Panchayat Member Mobile"
                value={createForm.panchayat_member_mobile}
                onChange={e => setCreateForm({ ...createForm, panchayat_member_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Anganvadi Mobile"
                value={createForm.anganvadi_mobile}
                onChange={e => setCreateForm({ ...createForm, anganvadi_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="ASHA Worker Mobile"
                value={createForm.asha_worker_mobile}
                onChange={e => setCreateForm({ ...createForm, asha_worker_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="CBV Email"
                value={createForm.cbv_email}
                onChange={e => setCreateForm({ ...createForm, cbv_email: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 md:col-span-3"
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
              <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
                <table className="min-w-[2600px] w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {tableColumns.map((column) => (
                        <th key={column.key} className="px-6 py-3 text-left font-semibold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{column.label}</span>
                            {!nonSortableColumns.has(column.key) && (
                              <button
                                type="button"
                                onClick={() => toggleSort(column.key)}
                                className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                {sortColumn === column.key ? (sortDirection === 'asc' ? 'ASC' : 'DESC') : 'Sort'}
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCentres.map((centre) => (
                      <tr key={centre.id} className="border-b border-slate-200 hover:bg-slate-50">
                        {tableColumns.map((column) => {
                          const value = centre[column.key as keyof CentreRecord]
                          return (
                            <td
                              key={`${centre.id}-${column.key}`}
                              className={`px-6 py-4 whitespace-nowrap ${column.key === 'eac_no' ? 'text-slate-900 font-medium' : 'text-slate-700'}`}
                            >
                              {value || '-'}
                            </td>
                          )
                        })}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
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
                type="date"
                placeholder="Start Date"
                value={editForm.start_date}
                onChange={e => setEditForm({ ...editForm, start_date: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                placeholder="End Date"
                value={editForm.end_date}
                onChange={e => setEditForm({ ...editForm, end_date: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="CBV Name"
                value={editForm.cbv_name}
                onChange={e => setEditForm({ ...editForm, cbv_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="In Charge"
                value={editForm.in_charge}
                onChange={e => setEditForm({ ...editForm, in_charge: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Panchayat Member"
                value={editForm.panchayat_member}
                onChange={e => setEditForm({ ...editForm, panchayat_member: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Head Master"
                value={editForm.head_master}
                onChange={e => setEditForm({ ...editForm, head_master: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Anganvadi"
                value={editForm.anganvadi}
                onChange={e => setEditForm({ ...editForm, anganvadi: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="ASHA Worker"
                value={editForm.asha_worker}
                onChange={e => setEditForm({ ...editForm, asha_worker: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Head Master Mobile"
                value={editForm.head_master_mobile}
                onChange={e => setEditForm({ ...editForm, head_master_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="In Charge Mobile"
                value={editForm.in_charge_mobile}
                onChange={e => setEditForm({ ...editForm, in_charge_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="CBV Mobile"
                value={editForm.cbv_mobile}
                onChange={e => setEditForm({ ...editForm, cbv_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Panchayat Member Mobile"
                value={editForm.panchayat_member_mobile}
                onChange={e => setEditForm({ ...editForm, panchayat_member_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Anganvadi Mobile"
                value={editForm.anganvadi_mobile}
                onChange={e => setEditForm({ ...editForm, anganvadi_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="ASHA Worker Mobile"
                value={editForm.asha_worker_mobile}
                onChange={e => setEditForm({ ...editForm, asha_worker_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="CBV Email"
                value={editForm.cbv_email}
                onChange={e => setEditForm({ ...editForm, cbv_email: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
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
