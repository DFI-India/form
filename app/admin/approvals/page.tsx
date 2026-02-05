'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'

type EntityType = 'child_data' | 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving' | 'vocational_course' | 'computer_course'
type StatusFilter = 'Pending' | 'Approved' | 'Rejected'

interface ApprovalRecord {
  record_id: number
  eac_no: string | number
  reg_no?: string | number
  status: string
  created_at: string
  submitter?: { username: string; role: string }
  approver?: { username: string; role: string }
  approved_at?: string
  // Child data specific
  first_name?: string
  last_name?: string
  gender?: string
  // Family specific
  f_name?: string
  m_name?: string
  // VTC specific
  trainee_name?: string
  child_name?: string
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

export default function AdminApprovalsPage() {
  const router = useRouter()
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])
  
  const [activeTab, setActiveTab] = useState<EntityType>('child_data')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Pending')
  const [data, setData] = useState<Record<string, ApprovalRecord[]>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  
  // Modal states
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [detailsData, setDetailsData] = useState<any>(null)

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token || null
      if (token) {
        setSessionToken(token)
        await fetchApprovals(token, statusFilter)
      }
    }
    if (isAuthorized) {
      init()
    }
  }, [isAuthorized, statusFilter])

  const fetchApprovals = async (token: string, status: StatusFilter) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/approvals/list?status=${status}&entityType=all`, {
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
      setSuccess('Record approved successfully!')
      setTimeout(() => setSuccess(''), 3000)
      await fetchApprovals(sessionToken, statusFilter)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!sessionToken || !selectedRecord) return
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
          entityId: selectedRecord.record_id,
          reason: rejectReason
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSuccess('Record rejected successfully!')
      setShowRejectModal(false)
      setRejectReason('')
      setSelectedRecord(null)
      setTimeout(() => setSuccess(''), 3000)
      await fetchApprovals(sessionToken, statusFilter)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleViewDetails = async (record: ApprovalRecord) => {
    if (!sessionToken) return
    setSelectedRecord(record)
    setShowDetailsModal(true)
    try {
      const res = await fetch(`/api/admin/approvals/details?entityType=${activeTab}&entityId=${record.record_id}`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDetailsData(json)
    } catch (err: any) {
      setError(err.message)
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
  const currentTabData = data[activeTab] || []

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
              <h2 className="text-3xl font-bold text-slate-900">Approval Queue</h2>
              <p className="text-slate-600 mt-2">Review and approve/reject submissions</p>
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

          {/* Status Filter */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">Filter by Status:</span>
              {(['Pending', 'Approved', 'Rejected'] as StatusFilter[]).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? status === 'Pending' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400'
                        : status === 'Approved' ? 'bg-green-100 text-green-800 border-2 border-green-400'
                        : 'bg-red-100 text-red-800 border-2 border-red-400'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Entity Type Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 mb-6">
            <div className="flex overflow-x-auto">
              {(Object.keys(ENTITY_LABELS) as EntityType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`flex-1 min-w-[120px] px-4 py-4 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === type
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="mr-2">{ENTITY_ICONS[type]}</span>
                  {ENTITY_LABELS[type]}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    counts[type] > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {counts[type] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-slate-600">Loading submissions...</p>
              </div>
            ) : currentTabData.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-4">📭</p>
                <p className="text-slate-600 font-medium">No {statusFilter.toLowerCase()} {ENTITY_LABELS[activeTab]} records</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name/Details</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">EAC No</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Reg No</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Submitted By</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentTabData.map((record) => (
                      <tr key={record.record_id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-900 font-mono">#{record.record_id}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 font-medium">{getRecordName(record)}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{record.eac_no || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{record.reg_no || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {record.submitter?.username || 'Unknown'}
                          <span className="text-xs text-slate-400 ml-1">({record.submitter?.role || '-'})</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(record.created_at)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            record.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            record.status === 'Approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewDetails(record)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              👁️
                            </button>
                            {statusFilter === 'Pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(record)}
                                  disabled={actionLoading}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="Approve"
                                >
                                  ✅
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedRecord(record)
                                    setShowRejectModal(true)
                                  }}
                                  disabled={actionLoading}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="Reject"
                                >
                                  ❌
                                </button>
                              </>
                            )}
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
      {showRejectModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Reject Record</h3>
            <p className="text-slate-600 mb-4">
              Rejecting: <strong>{getRecordName(selectedRecord)}</strong> (#{selectedRecord.record_id})
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
                  setSelectedRecord(null)
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

      {/* Details Modal */}
      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {ENTITY_ICONS[activeTab]} {ENTITY_LABELS[activeTab]} Details
              </h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedRecord(null)
                  setDetailsData(null)
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {!detailsData ? (
                <div className="py-12 text-center">
                  <LoadingSpinner size="lg" />
                  <p className="mt-4 text-slate-600">Loading details...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Main Record */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">Record Information</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(detailsData.data || {}).map(([key, value]) => {
                        if (['submitter', 'approver', 'created_at', 'approved_at'].includes(key)) return null
                        if (value === null || value === undefined) return null
                        return (
                          <div key={key}>
                            <p className="text-xs text-slate-500 uppercase">{key.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-slate-900 font-medium">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Submission Info */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">Submission Info</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Submitted By</p>
                        <p className="text-sm text-slate-900 font-medium">
                          {detailsData.data?.submitter?.username || 'Unknown'}
                          <span className="text-slate-500 ml-1">
                            ({detailsData.data?.submitter?.role || '-'})
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Submitted At</p>
                        <p className="text-sm text-slate-900 font-medium">
                          {detailsData.data?.created_at ? formatDate(detailsData.data.created_at) : '-'}
                        </p>
                      </div>
                      {detailsData.data?.approver && (
                        <>
                          <div>
                            <p className="text-xs text-slate-500">Decided By</p>
                            <p className="text-sm text-slate-900 font-medium">
                              {detailsData.data.approver.username}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Decided At</p>
                            <p className="text-sm text-slate-900 font-medium">
                              {detailsData.data?.approved_at ? formatDate(detailsData.data.approved_at) : '-'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Activity History */}
                  {detailsData.history && detailsData.history.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="font-semibold text-slate-900 mb-3">Activity History</h4>
                      <div className="space-y-2">
                        {detailsData.history.map((log: any) => (
                          <div key={log.id} className="flex items-center gap-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              log.action_type === 'approve' ? 'bg-green-100 text-green-800' :
                              log.action_type === 'reject' ? 'bg-red-100 text-red-800' :
                              log.action_type === 'edit' ? 'bg-blue-100 text-blue-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {log.action_type}
                            </span>
                            <span className="text-slate-600">
                              by {log.user?.username || 'Unknown'}
                            </span>
                            <span className="text-slate-400 text-xs">
                              {formatDate(log.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {selectedRecord.status === 'Pending' && (
                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                      <button
                        onClick={() => {
                          setShowDetailsModal(false)
                          handleApprove(selectedRecord)
                        }}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => {
                          setShowDetailsModal(false)
                          setShowRejectModal(true)
                        }}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
