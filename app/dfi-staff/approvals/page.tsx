'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'

type EntityType = 'child_data' | 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving' | 'vocational_course' | 'computer_course'

interface ApprovalRecord {
  record_id: number
  eac_no: string | number
  reg_no?: string | number
  status: string
  created_at: string
  submitter?: { username: string; role: string }
  first_name?: string
  last_name?: string
  trainee_name?: string
  child_name?: string
  f_name?: string
  [key: string]: any
}

const ENTITY_LABELS: Record<EntityType, string> = {
  child_data: 'Child Data',
  childfmly: 'Family',
  childsibling: 'Siblings',
  childuniform: 'Uniform',
  childleaving: 'Leaving',
  vocational_course: 'Vocational',
  computer_course: 'Computer'
}

const ENTITY_ICONS: Record<EntityType, string> = {
  child_data: '👶',
  childfmly: '👨‍👩‍👧',
  childsibling: '👧‍👦',
  childuniform: '👕',
  childleaving: '🚪',
  vocational_course: '🎓',
  computer_course: '💻'
}

export default function DFIStaffApprovalsPage() {
  const router = useRouter()
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_staff'])
  
  const [activeTab, setActiveTab] = useState<EntityType>('child_data')
  const [data, setData] = useState<Record<string, ApprovalRecord[]>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set())
  
  // Modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectingRecord, setRejectingRecord] = useState<ApprovalRecord | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token || null
      if (token) {
        setSessionToken(token)
        await fetchPendingRecords(token)
      }
    }
    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  const fetchPendingRecords = async (token: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/approvals/list?status=Pending&entityType=all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setData(json.data || {})
      setCounts(json.counts || {})
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (record: ApprovalRecord) => {
    if (!sessionToken) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          entityType: activeTab,
          entityId: record.record_id
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSuccess('Record approved!')
      setTimeout(() => setSuccess(''), 3000)
      await fetchPendingRecords(sessionToken)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkApprove = async () => {
    if (!sessionToken || selectedRecords.size === 0) return
    setActionLoading(true)
    setError('')
    try {
      const promises = Array.from(selectedRecords).map(id =>
        fetch('/api/admin/approvals/approve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            entityType: activeTab,
            entityId: id
          })
        })
      )
      await Promise.all(promises)
      setSuccess(`${selectedRecords.size} records approved!`)
      setSelectedRecords(new Set())
      setTimeout(() => setSuccess(''), 3000)
      await fetchPendingRecords(sessionToken)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!sessionToken || !rejectingRecord) return
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason')
      return
    }
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          entityType: activeTab,
          entityId: rejectingRecord.record_id,
          reason: rejectReason
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSuccess('Record rejected')
      setShowRejectModal(false)
      setRejectReason('')
      setRejectingRecord(null)
      setTimeout(() => setSuccess(''), 3000)
      await fetchPendingRecords(sessionToken)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const toggleSelectRecord = (id: number) => {
    setSelectedRecords(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    const currentRecords = data[activeTab] || []
    if (selectedRecords.size === currentRecords.length) {
      setSelectedRecords(new Set())
    } else {
      setSelectedRecords(new Set(currentRecords.map(r => r.record_id)))
    }
  }

  const getRecordName = (record: ApprovalRecord): string => {
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

  const roleInfo = ROLE_CONFIG.find(r => r.value === 'dfi_staff')!
  const currentTabData = data[activeTab] || []
  const totalPending = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar
        username={profile.username}
        role="dfi_staff"
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color}
      />
      <Sidebar role="dfi_staff" />

      <PageContainer>
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Final Approvals</h2>
              <p className="text-slate-600 mt-2">
                Approve or reject pending submissions
                <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  {totalPending} pending
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dfi-staff/review-queue')}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
              >
                🔍 Review Queue
              </button>
              <button
                onClick={() => router.push('/dfi-staff')}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                ← Dashboard
              </button>
            </div>
          </div>

          {/* Alerts */}
          {error && <Alert type="error" message={error} className="mb-6" />}
          {success && <Alert type="success" message={success} className="mb-6" />}

          {/* Bulk Actions */}
          {selectedRecords.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
              <span className="text-blue-800 font-medium">
                {selectedRecords.size} record(s) selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedRecords(new Set())}
                  className="px-3 py-1 bg-white text-slate-600 rounded border border-slate-300 hover:bg-slate-50"
                >
                  Clear Selection
                </button>
                <button
                  onClick={handleBulkApprove}
                  disabled={actionLoading}
                  className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  ✅ Approve All Selected
                </button>
              </div>
            </div>
          )}

          {/* Entity Type Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 mb-6">
            <div className="flex overflow-x-auto">
              {(Object.keys(ENTITY_LABELS) as EntityType[]).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setActiveTab(type)
                    setSelectedRecords(new Set())
                  }}
                  className={`flex-1 min-w-[120px] px-4 py-4 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === type
                      ? 'border-green-600 text-green-600 bg-green-50'
                      : 'border-transparent text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="mr-2">{ENTITY_ICONS[type]}</span>
                  {ENTITY_LABELS[type]}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    counts[type] > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {counts[type] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-slate-600">Loading submissions...</p>
              </div>
            ) : currentTabData.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-4">✅</p>
                <p className="text-slate-600 font-medium">No pending {ENTITY_LABELS[activeTab]} records</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedRecords.size === currentTabData.length && currentTabData.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">EAC No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reg No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Submitted By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentTabData.map((record) => (
                      <tr key={record.record_id} className={`hover:bg-slate-50 ${
                        selectedRecords.has(record.record_id) ? 'bg-blue-50' : ''
                      }`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRecords.has(record.record_id)}
                            onChange={() => toggleSelectRecord(record.record_id)}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-mono">#{record.record_id}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">{getRecordName(record)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{record.eac_no || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{record.reg_no || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{record.submitter?.username || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(record.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(record)}
                              disabled={actionLoading}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm font-medium"
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => {
                                setRejectingRecord(record)
                                setShowRejectModal(true)
                              }}
                              disabled={actionLoading}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
                            >
                              ❌ Reject
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

      {/* Reject Modal */}
      {showRejectModal && rejectingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Reject Record</h3>
            <p className="text-slate-600 mb-4">
              Rejecting: <strong>{getRecordName(rejectingRecord)}</strong> (#{rejectingRecord.record_id})
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason (required)..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                  setRejectingRecord(null)
                }}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
