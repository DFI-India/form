'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'

type EntityType = 'child_data' | 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving' | 'vocational_course' | 'computer_course'
type StatusFilter = 'all' | 'Pending' | 'Verified' | 'Approved' | 'Rejected'
type SearchBy = 'name' | 'reg_no'

interface DataRecord {
  record_id: number
  eac_no: string | number
  reg_no?: string | number
  status: string
  created_at: string
  submitter?: { username: string; role: string }
  approver?: { username: string; role: string }
  verified_at?: string
  first_name?: string
  last_name?: string
  trainee_name?: string
  child_name?: string
  f_name?: string
  [key: string]: any
}

const ENTITY_LABELS: { [key in EntityType]: string } = {
  child_data: 'Child Data',
  childfmly: 'Family',
  childsibling: 'Siblings',
  childuniform: 'Uniform',
  childleaving: 'Leaving',
  vocational_course: 'Vocational',
  computer_course: 'Computer'
}

const NON_EDITABLE_FIELDS = new Set([
  'id',
  'record_id',
  'vocational_id',
  'computer_id',
  'submitted_by',
  'verified_by',
  'verified_at',
  'approved_by',
  'approved_at',
  'created_at',
  'updated_at',
  'status',
  'submitter',
  'approver'
])

const HIDDEN_TABLE_METADATA_FIELDS = new Set([
  'submitted_by',
  'verified_by',
  'verified_at',
  'approved_by',
  'approved_at',
  'submitter',
  'approver'
])

const ENTITY_ID_CANDIDATES: Record<EntityType, string[]> = {
  child_data: ['record_id', 'id'],
  childfmly: ['record_id', 'id'],
  childsibling: ['record_id', 'id'],
  childuniform: ['record_id', 'id'],
  childleaving: ['record_id', 'id'],
  vocational_course: ['record_id', 'vocational_id', 'id'],
  computer_course: ['record_id', 'computer_id', 'id']
}

const EXPORTABLE_ENTITY_TYPES: EntityType[] = ['child_data', 'childfmly', 'childsibling', 'childuniform', 'childleaving']

const TABLE_NAME_BY_ENTITY: Record<EntityType, string> = {
  child_data: 'Child_Data',
  childfmly: 'childfmly',
  childsibling: 'childsibling',
  childuniform: 'childuniform',
  childleaving: 'childleaving',
  vocational_course: 'vocational_course',
  computer_course: 'computer_course'
}

export default function AdminRecordsPage() {
  const router = useRouter()
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [activeTab, setActiveTab] = useState<EntityType>('child_data')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchBy, setSearchBy] = useState<SearchBy>('name')
  const [searchQuery, setSearchQuery] = useState('')
  const [records, setRecords] = useState<DataRecord[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Edit modal state
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null)
  const [editFormData, setEditFormData] = useState<{ [key: string]: any }>({})
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreviewModal, setPhotoPreviewModal] = useState<{ isOpen: boolean; url: string }>({
    isOpen: false,
    url: ''
  })
  const [deletingRecord, setDeletingRecord] = useState<DataRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const getEntityIdentity = (record: DataRecord) => {
    const keys = ENTITY_ID_CANDIDATES[activeTab]
    for (const key of keys) {
      const value = record[key]
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return { key, value }
      }
    }
    return null
  }

  const visibleColumns = useMemo(() => {
    if (records.length === 0) return []
    const allColumns = Array.from(new Set(records.flatMap((record) => Object.keys(record))))
    const filteredColumns = allColumns.filter((column) => {
      if (HIDDEN_TABLE_METADATA_FIELDS.has(column)) return false
      if ((activeTab === 'vocational_course' || activeTab === 'computer_course') && column === 'record_id') return false
      return true
    })

    const columnsToReposition = ['dateofbirth', 'religion', 'class_std_text'].filter((column) =>
      filteredColumns.includes(column)
    )

    if (columnsToReposition.length === 0) return filteredColumns

    const baseColumns = filteredColumns.filter((column) => !columnsToReposition.includes(column))
    const lastNameIndex = baseColumns.indexOf('last_name')

    if (lastNameIndex === -1) {
      return [...baseColumns, ...columnsToReposition]
    }

    return [
      ...baseColumns.slice(0, lastNameIndex + 1),
      ...columnsToReposition,
      ...baseColumns.slice(lastNameIndex + 1)
    ]
  }, [records])

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token || null
      if (token) {
        setSessionToken(token)
        await fetchRecords(token)
      }
    }
    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  useEffect(() => {
    if (sessionToken) {
      fetchRecords(sessionToken)
    }
  }, [activeTab, statusFilter, page])

  const fetchRecords = async (token: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        entityType: activeTab,
        status: statusFilter,
        search: searchQuery,
        searchBy,
        page: String(page),
        limit: '20'
      })
      const res = await fetch(`/api/admin/records/list?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setRecords(json.data || [])
      setTotalRecords(json.total || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (sessionToken) {
      setPage(1)
      fetchRecords(sessionToken)
    }
  }

  const handleRefreshFilters = () => {
    setSearchQuery('')
    setSearchBy('name')
    setStatusFilter('all')
    setPage(1)
    if (sessionToken) {
      const params = new URLSearchParams({
        entityType: activeTab,
        status: 'all',
        search: '',
        searchBy: 'name',
        page: '1',
        limit: '20'
      })
      fetch(`/api/admin/records/list?${params}`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      })
        .then((res) => res.json())
        .then((json) => {
          if (!json?.error) {
            setRecords(json.data || [])
            setTotalRecords(json.total || 0)
          }
        })
        .catch(() => {
          // no-op: existing error state handled by normal fetch flow
        })
    }
  }

  const handleEdit = (record: DataRecord) => {
    setEditingRecord(record)
    // Create a copy for editing, excluding meta fields
    const editableFields: { [key: string]: any } = { ...record }
    Array.from(NON_EDITABLE_FIELDS).forEach((field) => {
      delete editableFields[field]
    })
    setEditFormData(editableFields)
  }

  const handlePhotoUpload = async (file: File) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5MB or smaller')
      return
    }

    setUploadingPhoto(true)
    setError('')

    try {
      const safeName = file.name.replace(/\s+/g, '-')
      const fileName = `${Date.now()}-${safeName}`
      const filePath = `admin_records_photos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('profiles').getPublicUrl(filePath)
      setEditFormData((prev) => ({
        ...prev,
        photo_link: data.publicUrl
      }))
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!sessionToken || !editingRecord) return
    const identity = getEntityIdentity(editingRecord)
    if (!identity) {
      setError('Unable to determine record identity for update')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/records/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          entityType: activeTab,
          entityId: identity.value,
          entityKey: identity.key,
          updates: editFormData
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSuccess('Record updated successfully!')
      setEditingRecord(null)
      setTimeout(() => setSuccess(''), 3000)
      await fetchRecords(sessionToken)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!sessionToken || !deletingRecord) return

    const identity = getEntityIdentity(deletingRecord)
    if (!identity) {
      setError('Unable to determine record identity for delete')
      return
    }

    setDeleting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/records/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          entityType: activeTab,
          entityId: identity.value,
          entityKey: identity.key,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      setSuccess('Record deleted successfully!')
      setDeletingRecord(null)
      setTimeout(() => setSuccess(''), 3000)
      await fetchRecords(sessionToken)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleExportCSV = async () => {
    if (!EXPORTABLE_ENTITY_TYPES.includes(activeTab)) {
      setError('CSV export is only available for child data tables.')
      return
    }

    setExporting(true)
    setError('')

    try {
      const tableName = TABLE_NAME_BY_ENTITY[activeTab]
      const pageSize = 1000
      let from = 0
      const rows: Record<string, any>[] = []

      while (true) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)

        if (error) throw error

        const chunk = (data || []) as Record<string, any>[]
        rows.push(...chunk)

        if (chunk.length < pageSize) break
        from += pageSize
      }

      if (rows.length === 0) {
        setError(`No records found in ${ENTITY_LABELS[activeTab]} to export.`)
        return
      }

      const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))

      const escapeCsv = (value: unknown) => {
        if (value === null || value === undefined) return ''
        const str = String(value)
        const escaped = str.replace(/"/g, '""')
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
      }

      const csv = [
        headers.join(','),
        ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStamp = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `${activeTab}_${dateStamp}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSuccess(`Exported ${rows.length} records from ${ENTITY_LABELS[activeTab]}.`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV')
    } finally {
      setExporting(false)
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
  const totalPages = Math.ceil(totalRecords / 20)

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
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">All Records</h2>
              <p className="text-slate-600 mt-2">View, search, and edit all records</p>
            </div>
            <div className="flex items-center gap-3">
              {EXPORTABLE_ENTITY_TYPES.includes(activeTab) && (
                <button
                  onClick={handleExportCSV}
                  disabled={exporting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : 'Export as CSV'}
                </button>
              )}
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>

          {/* Alerts */}
          {error && <Alert type="error" message={error} className="mb-6" />}
          {success && <Alert type="success" message={success} className="mb-6" />}

          {/* Search & Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchBy === 'reg_no' ? 'Search by Reg No' : 'Search by Name'}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Search By</label>
                <select
                  value={searchBy}
                  onChange={(e) => setSearchBy(e.target.value as SearchBy)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="name">Name</option>
                  <option value="reg_no">Reg No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status Filter</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Verified">Verified</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="md:col-span-4 flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  🔍 Search
                </button>
                <button
                  type="button"
                  onClick={handleRefreshFilters}
                  className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  ↻ Refresh
                </button>
              </div>
            </form>
          </div>

          {/* Entity Type Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 mb-6">
            <div className="flex overflow-x-auto">
              {(Object.keys(ENTITY_LABELS) as EntityType[]).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setActiveTab(type)
                    setPage(1)
                  }}
                  className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === type
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {ENTITY_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-slate-600">Loading records...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-4">📭</p>
                <p className="text-slate-600 font-medium">No records found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">Actions</th>
                        {visibleColumns.map((field: string) => (
                          <th key={field} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">
                            {field.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {records.map((record) => (
                        <tr key={String(getEntityIdentity(record)?.value ?? record.record_id)} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-left">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(record)}
                                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => setDeletingRecord(record)}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                          {visibleColumns.map((field: string) => (
                            <td key={`${String(getEntityIdentity(record)?.value ?? record.record_id)}-${field}`} className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap align-top">
                              {field === 'photo_link' ? (
                                record[field] ? (
                                  <button
                                    onClick={() => setPhotoPreviewModal({ isOpen: true, url: String(record[field]) })}
                                    className="px-2.5 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-medium"
                                  >
                                    View Photo
                                  </button>
                                ) : '-'
                              ) : field === 'status' ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                  record.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                    record.status === 'Verified' ? 'bg-blue-100 text-blue-800' :
                                      'bg-red-100 text-red-800'
                                  }`}>
                                  {String(record[field] ?? '-')}
                                </span>
                              ) : (
                                String(record[field] ?? '-')
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, totalRecords)} of {totalRecords}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Prev
                    </button>
                    <span className="px-3 py-1 text-slate-600">
                      Page {page} of {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </PageContainer>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                Edit {ENTITY_LABELS[activeTab]} - #{String(getEntityIdentity(editingRecord)?.value ?? '-')}
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(editFormData).map(([key, value]: [string, unknown]) => {
                  if (NON_EDITABLE_FIELDS.has(key)) {
                    return null
                  }
                  return (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      {key === 'photo_link' ? (
                        <div className="space-y-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handlePhotoUpload(file)
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                          {uploadingPhoto && <p className="text-xs text-slate-500">Uploading image...</p>}
                          {value ? (
                            <a href={String(value)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                              {String(value)}
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <input
                          type={key.includes('date') ? 'date' : 'text'}
                          value={String(value ?? '')}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                <button
                  onClick={() => setEditingRecord(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || uploadingPhoto}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {uploadingPhoto ? 'Uploading Photo...' : saving ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {photoPreviewModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Photo Preview</h3>
              <button
                onClick={() => setPhotoPreviewModal({ isOpen: false, url: '' })}
                className="text-slate-600 hover:text-slate-900"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex justify-center bg-slate-50">
              <img
                src={photoPreviewModal.url}
                alt="Record photo"
                className="max-h-[70vh] w-auto rounded-lg border border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {deletingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-3">Delete Record</h3>
            <p className="text-slate-600 mb-5">
              Are you sure you want to delete record <span className="font-semibold">#{String(getEntityIdentity(deletingRecord)?.value ?? '-')}</span> from {ENTITY_LABELS[activeTab]}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingRecord(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
