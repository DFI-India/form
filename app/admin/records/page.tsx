'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'
import {
  ArrowLeft,
  Search as SearchIcon,
  RotateCcw,
  Inbox,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Download,
} from 'lucide-react'

type EntityType = 'child_data' | 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving' | 'vocational_course' | 'computer_course'
type StatusFilter = 'all' | 'Pending' | 'Verified' | 'Approved' | 'Rejected'
type SearchBy = 'name' | 'reg_no' | 'eac_no'
type SortDirection = 'asc' | 'desc'

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

interface StatusSummary {
  Pending: number
  Verified: number
  Approved: number
  Rejected: number
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
  'record_id',
  'centre_id',
  'submitted_by',
  'verified_by',
  'verified_at',
  'approved_by',
  'approved_at',
  'submitter',
  'approver'
])

const COLUMN_GROUPS_BY_ENTITY: Record<EntityType, string[]> = {
  child_data: [
    'reg_no',
    'first_name',
    'last_name',
    'eac_no',
    'village_name',
    'gender',
    'dob',
    'age',
    'class_std_text',
    'adm_date',
    'health_status',
    'blood_group',
    'height',
    'weight',
    'photo_link',
    'status',
    'submitted_by',
    'verified_by',
    'approved_by',
    'verified_at',
    'approved_at',
    'created_at',
    'updated_at'
  ],
  childfmly: [
    'reg_no',
    'eac_no',
    'village_name',
    'f_name',
    'm_name',
    'guardian_name',
    'f_mobile',
    'm_mobile',
    'guardian_mobile',
    'f_occupation',
    'm_occupation',
    'family_income',
    'status',
    'submitted_by',
    'verified_by',
    'approved_by',
    'verified_at',
    'approved_at',
    'created_at',
    'updated_at'
  ],
  childsibling: [
    'reg_no',
    'eac_no',
    'village_name',
    's_name',
    'sibling_name',
    'name',
    'gender',
    'relation',
    'class_std_text',
    'age',
    'status',
    'submitted_by',
    'verified_by',
    'approved_by',
    'verified_at',
    'approved_at',
    'created_at',
    'updated_at'
  ],
  childuniform: [
    'reg_no',
    'eac_no',
    'uniform_size',
    'shoe_size',
    'status',
    'submitted_by',
    'verified_by',
    'approved_by',
    'verified_at',
    'approved_at',
    'created_at',
    'updated_at'
  ],
  childleaving: [
    'reg_no',
    'eac_no',
    'reason',
    'leaving_reason',
    'leave_date',
    'status',
    'submitted_by',
    'verified_by',
    'approved_by',
    'verified_at',
    'approved_at',
    'created_at',
    'updated_at'
  ],
  vocational_course: [
    'reg_no',
    'eac_no',
    'trainee_name',
    'course_name',
    'institution_name',
    'start_date',
    'end_date',
    'status',
    'submitted_by',
    'verified_by',
    'approved_by',
    'verified_at',
    'approved_at',
    'created_at',
    'updated_at'
  ],
  computer_course: [
    'reg_no',
    'eac_no',
    'child_name',
    'course_name',
    'institution_name',
    'start_date',
    'end_date',
    'status',
    'submitted_by',
    'verified_by',
    'approved_by',
    'verified_at',
    'approved_at',
    'created_at',
    'updated_at'
  ]
}

const DEFAULT_PRIORITY_COLUMNS = [
  'reg_no',
  'eac_no',
  'first_name',
  'last_name',
  'child_name',
  'trainee_name',
  'f_name',
  'm_name',
  's_name',
  'sibling_name',
  'name',
  'village_name',
  'gender',
  'class_std_text',
  'status',
  'created_at',
  'updated_at'
]

const DEFAULT_SORT_COLUMN_BY_ENTITY: Record<EntityType, string> = {
  child_data: 'first_name',
  childfmly: 'f_name',
  childsibling: 'reg_no',
  childuniform: 'reg_no',
  childleaving: 'reg_no',
  vocational_course: 'trainee_name',
  computer_course: 'child_name'
}

const SORTABLE_COLUMNS_BY_ENTITY: Record<EntityType, Set<string>> = {
  child_data: new Set([
    'record_id', 'id', 'reg_no', 'eac_no', 'first_name', 'last_name', 'village_name', 'gender', 'class_std_text', 'adm_date', 'status', 'created_at', 'updated_at',
  ]),
  childfmly: new Set([
    'record_id', 'id', 'reg_no', 'eac_no', 'f_name', 'm_name', 'guardian_name', 'village_name', 'f_mobile', 'm_mobile', 'status', 'created_at', 'updated_at',
  ]),
  childsibling: new Set([
    'record_id', 'id', 'reg_no', 'eac_no', 'sibling_name', 'name', 'gender', 'class_std_text', 'age', 'status', 'created_at', 'updated_at',
  ]),
  childuniform: new Set([
    'record_id', 'id', 'reg_no', 'eac_no', 'uniform_size', 'shoe_size', 'status', 'created_at', 'updated_at',
  ]),
  childleaving: new Set([
    'record_id', 'id', 'reg_no', 'eac_no', 'reason', 'leaving_reason', 'leave_date', 'status', 'created_at', 'updated_at',
  ]),
  vocational_course: new Set([
    'record_id', 'vocational_id', 'id', 'reg_no', 'eac_no', 'trainee_name', 'course_name', 'institution_name', 'status', 'created_at', 'updated_at',
  ]),
  computer_course: new Set([
    'record_id', 'computer_id', 'id', 'reg_no', 'eac_no', 'child_name', 'course_name', 'institution_name', 'status', 'created_at', 'updated_at',
  ]),
}

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
  const [statusSummary, setStatusSummary] = useState<StatusSummary>({
    Pending: 0,
    Verified: 0,
    Approved: 0,
    Rejected: 0,
  })

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
  const [sortColumn, setSortColumn] = useState<string>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

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

    const tabPriority = COLUMN_GROUPS_BY_ENTITY[activeTab] || []
    const prioritized = [...tabPriority, ...DEFAULT_PRIORITY_COLUMNS].filter(
      (column, index, arr) => arr.indexOf(column) === index && filteredColumns.includes(column)
    )

    const remaining = filteredColumns
      .filter((column) => !prioritized.includes(column))
      .sort((a, b) => a.localeCompare(b))

    return [...prioritized, ...remaining]
  }, [records, activeTab])

  useEffect(() => {
    setSortColumn(DEFAULT_SORT_COLUMN_BY_ENTITY[activeTab])
    setSortDirection('asc')
    setPage(1)
  }, [activeTab])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setPage(1)
    setSortColumn(column)
    setSortDirection('asc')
  }

  const getColumnLabel = (field: string) => {
    if (field === 'village_name') return 'EAC VILLAGE'
    return field.replace(/_/g, ' ')
  }

  const getStatusBadgeClass = (status: string) => {
    if (status === 'Pending') return 'bg-yellow-100 text-yellow-800'
    if (status === 'Approved') return 'bg-green-100 text-green-800'
    if (status === 'Verified') return 'bg-blue-100 text-blue-800'
    return 'bg-red-100 text-red-800'
  }

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
    const allowedSortColumns = SORTABLE_COLUMNS_BY_ENTITY[activeTab]
    const defaultSort = DEFAULT_SORT_COLUMN_BY_ENTITY[activeTab]
    const normalizedSortColumn = allowedSortColumns.has(sortColumn) ? sortColumn : defaultSort

    if (normalizedSortColumn !== sortColumn) {
      setSortColumn(normalizedSortColumn)
      return
    }

    if (sessionToken) {
      fetchRecords(sessionToken, {
        sortColumn: normalizedSortColumn,
      })
    }
  }, [activeTab, statusFilter, page, sortColumn, sortDirection, sessionToken])

  const fetchRecords = async (
    token: string,
    overrides?: Partial<{
      entityType: EntityType
      status: StatusFilter
      search: string
      searchBy: SearchBy
      sortColumn: string
      sortDirection: SortDirection
      page: number
    }>
  ) => {
    setLoading(true)
    setError('')
    try {
      const entityType = overrides?.entityType || activeTab
      const allowedSortColumns = SORTABLE_COLUMNS_BY_ENTITY[entityType]
      const requestedSortColumn = overrides?.sortColumn || sortColumn
      const effectiveSortColumn = allowedSortColumns.has(requestedSortColumn)
        ? requestedSortColumn
        : DEFAULT_SORT_COLUMN_BY_ENTITY[entityType]

      const params = new URLSearchParams({
        entityType,
        status: overrides?.status || statusFilter,
        search: overrides?.search ?? searchQuery,
        searchBy: overrides?.searchBy || searchBy,
        sortColumn: effectiveSortColumn,
        sortDirection: overrides?.sortDirection || sortDirection,
        page: String(overrides?.page || page),
        limit: '20'
      })
      const res = await fetch(`/api/admin/records/list?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setRecords(json.data || [])
      setTotalRecords(json.total || 0)
      setStatusSummary(json.statusSummary || { Pending: 0, Verified: 0, Approved: 0, Rejected: 0 })
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
      fetchRecords(sessionToken, {
        page: 1,
        search: searchQuery,
        searchBy,
      })
    }
  }

  const handleRefreshFilters = () => {
    setSearchQuery('')
    setSearchBy('name')
    setStatusFilter('all')
    setPage(1)
    if (sessionToken) {
      fetchRecords(sessionToken, {
        page: 1,
        status: 'all',
        search: '',
        searchBy: 'name',
      })
    }
  }

  const getStickyHeaderClass = (field: string) => {
    if (field === 'reg_no') {
      return 'sticky left-24 z-20 bg-slate-50 min-w-[9rem] shadow-[2px_0_0_0_#e2e8f0]'
    }

    if (field === 'first_name') {
      const leftClass = visibleColumns.includes('reg_no') ? 'left-[15rem]' : 'left-24'
      return `sticky ${leftClass} z-20 bg-slate-50 min-w-[11rem] shadow-[2px_0_0_0_#e2e8f0]`
    }

    return ''
  }

  const getStickyCellClass = (field: string) => {
    if (field === 'reg_no') {
      return 'sticky left-24 z-10 min-w-[9rem] bg-white group-hover:bg-slate-50 shadow-[2px_0_0_0_#e2e8f0]'
    }

    if (field === 'first_name') {
      const leftClass = visibleColumns.includes('reg_no') ? 'left-[15rem]' : 'left-24'
      return `sticky ${leftClass} z-10 min-w-[11rem] bg-white group-hover:bg-slate-50 shadow-[2px_0_0_0_#e2e8f0]`
    }

    return ''
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
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? 'Exporting...' : 'Export as CSV'}
                </button>
              )}
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Active Entity</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{ENTITY_LABELS[activeTab]}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Matching Results</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{totalRecords}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Pending</p>
              <p className="text-lg font-semibold text-yellow-700 mt-1">{statusSummary.Pending}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Verified</p>
              <p className="text-lg font-semibold text-blue-700 mt-1">{statusSummary.Verified}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Approved</p>
              <p className="text-lg font-semibold text-emerald-700 mt-1">{statusSummary.Approved}</p>
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
                  placeholder={searchBy === 'reg_no' ? 'Search by Reg No' : searchBy === 'eac_no' ? 'Search by EAC No' : 'Search by Name'}
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
                  <option value="eac_no">EAC No</option>
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
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <SearchIcon className="w-4 h-4" /> Search
                </button>
                <button
                  type="button"
                  onClick={handleRefreshFilters}
                  className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Refresh
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
                <Inbox className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">No records found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap sticky left-0 z-30 bg-slate-50 w-24 min-w-24 shadow-[2px_0_0_0_#e2e8f0]">Actions</th>
                        {visibleColumns.map((field: string) => (
                          <th key={field} className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap ${getStickyHeaderClass(field)}`}>
                            <div className="flex items-center gap-2">
                              <span>{getColumnLabel(field)}</span>
                              <button
                                type="button"
                                onClick={() => handleSort(field)}
                                className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                              >
                                {sortColumn === field ? (sortDirection === 'asc' ? 'ASC' : 'DESC') : 'SORT'}
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {records.map((record) => (
                        <tr key={String(getEntityIdentity(record)?.value ?? record.record_id)} className="group hover:bg-slate-50">
                          <td className="px-4 py-3 text-left sticky left-0 z-20 bg-white group-hover:bg-slate-50 w-24 min-w-24 shadow-[2px_0_0_0_#e2e8f0]">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(record)}
                                aria-label="Edit record"
                                title="Edit"
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex items-center justify-center"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingRecord(record)}
                                aria-label="Delete record"
                                title="Delete"
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors inline-flex items-center justify-center"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          {visibleColumns.map((field: string) => (
                            <td key={`${String(getEntityIdentity(record)?.value ?? record.record_id)}-${field}`} className={`px-4 py-3 text-sm text-slate-600 whitespace-nowrap align-top ${getStickyCellClass(field)}`}>
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
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(record.status)}`}>
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
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <span className="px-3 py-1 text-slate-600">
                      Page {page} of {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      Next <ChevronRight className="w-4 h-4" />
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
              <h3 className="text-xl font-bold text-slate-900">Edit {ENTITY_LABELS[activeTab]}</h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {uploadingPhoto ? 'Uploading Photo...' : saving ? 'Saving...' : 'Save Changes'}
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
                <X className="w-5 h-5" />
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
              Are you sure you want to delete this {ENTITY_LABELS[activeTab]} entry?
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
