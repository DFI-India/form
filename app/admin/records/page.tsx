'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'

type EntityType = 'child_data' | 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving' | 'vocational_course' | 'computer_course'
type StatusFilter = 'all' | 'Pending' | 'Approved' | 'Rejected'

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

// Fields to display for each entity type
const DISPLAY_FIELDS: { [key in EntityType]: string[] } = {
  child_data: ['first_name', 'last_name', 'gender', 'aadhar_no', 'school_name', 'class_std'],
  childfmly: ['f_name', 'f_occup', 'f_mobile', 'm_name', 'm_occup', 'm_mobile'],
  childsibling: ['names_1', 'ages_1', 'genders_1', 'names_2', 'ages_2', 'genders_2'],
  childuniform: ['shirtsize', 'knickersize', 'pant_skirtsize', 'footwearsize'],
  childleaving: ['reason', 'leav_class', 'leav_date', 'leav_addr1'],
  vocational_course: ['trainee_name', 'enrolled_course', 'batch_no', 'district'],
  computer_course: ['child_name', 'course_name', 'batch_no', 'school_name']
}

export default function AdminRecordsPage() {
  const router = useRouter()
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [activeTab, setActiveTab] = useState<EntityType>('child_data')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
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

  const handleEdit = (record: DataRecord) => {
    setEditingRecord(record)
    // Create a copy for editing, excluding meta fields
    const editableFields: { [key: string]: any } = { ...record }
    delete editableFields['submitter']
    delete editableFields['approver']
    delete editableFields['created_at']
    delete editableFields['verified_at']
    setEditFormData(editableFields)
  }

  const handleSaveEdit = async () => {
    if (!sessionToken || !editingRecord) return
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
          entityId: editingRecord.record_id,
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

  const getRecordName = (record: DataRecord): string => {
    if (record.first_name && record.last_name) {
      return `${record.first_name} ${record.last_name}`
    }
    if (record.trainee_name) return record.trainee_name
    if (record.child_name) return record.child_name
    if (record.f_name) return `Father: ${record.f_name}`
    return `Record #${record.record_id}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
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
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Alerts */}
          {error && <Alert type="error" message={error} className="mb-6" />}
          {success && <Alert type="success" message={success} className="mb-6" />}

          {/* Search & Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
            <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Reg No, Name, Aadhar..."
                className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔍 Search
              </button>
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">EAC</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reg No</th>
                        {DISPLAY_FIELDS[activeTab].slice(0, 3).map((field: string) => (
                          <th key={field} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                            {field.replace(/_/g, ' ')}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {records.map((record) => (
                        <tr key={record.record_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900 font-mono">#{record.record_id}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-medium">{getRecordName(record)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{record.eac_no || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{record.reg_no || '-'}</td>
                          {DISPLAY_FIELDS[activeTab].slice(0, 3).map((field: string) => (
                            <td key={field} className="px-4 py-3 text-sm text-slate-600">
                              {record[field] || '-'}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                record.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                  'bg-red-100 text-red-800'
                              }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleEdit(record)}
                              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              ✏️ Edit
                            </button>
                          </td>
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
                Edit {ENTITY_LABELS[activeTab]} - #{editingRecord.record_id}
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
                  // Skip non-editable fields
                  if (['record_id', 'id', 'submitted_by', 'verified_by', 'status'].includes(key)) {
                    return null
                  }
                  return (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      <input
                        type={key.includes('date') ? 'date' : 'text'}
                        value={String(value ?? '')}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
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
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
