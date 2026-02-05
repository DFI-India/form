'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'

interface ActivityLog {
  id: string
  user_id: string
  action_type: string
  entity_type: string
  entity_id: string
  changes?: Record<string, { old: any; new: any }>
  metadata?: Record<string, any>
  created_at: string
  user?: {
    id: string
    username: string
    role: string
  }
}

interface UserOption {
  id: string
  username: string
  role: string
}

const ACTION_COLORS: Record<string, string> = {
  approve: 'bg-green-100 text-green-800',
  reject: 'bg-red-100 text-red-800',
  edit: 'bg-blue-100 text-blue-800',
  create: 'bg-purple-100 text-purple-800',
  delete: 'bg-gray-100 text-gray-800',
  view: 'bg-yellow-100 text-yellow-800'
}

const ACTION_ICONS: Record<string, string> = {
  approve: '✅',
  reject: '❌',
  edit: '✏️',
  create: '➕',
  delete: '🗑️',
  view: '👁️'
}

const ENTITY_LABELS: Record<string, string> = {
  child_data: 'Child Data',
  childfmly: 'Family',
  childsibling: 'Sibling',
  childuniform: 'Uniform',
  childleaving: 'Leaving',
  vocational_course: 'Vocational',
  computer_course: 'Computer'
}

export default function AdminLogsPage() {
  const router = useRouter()
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin', 'tech_support'])
  
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  
  // Filters
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  
  // Details modal
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token || null
      if (token) {
        setSessionToken(token)
        await fetchLogs(token)
      }
    }
    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  useEffect(() => {
    if (sessionToken) {
      fetchLogs(sessionToken)
    }
  }, [page, actionFilter, entityFilter, userFilter])

  const fetchLogs = async (token: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        actionType: actionFilter,
        entityType: entityFilter,
        userId: userFilter
      })
      const res = await fetch(`/api/admin/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setLogs(json.logs || [])
      setUsers(json.users || [])
      setTotalLogs(json.total || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
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

  const roleInfo = ROLE_CONFIG.find(r => r.value === profile.role)!
  const totalPages = Math.ceil(totalLogs / 50)

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar
        username={profile.username}
        role={profile.role as any}
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color}
      />
      <Sidebar role={profile.role as any} />

      <PageContainer>
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Activity Logs</h2>
              <p className="text-slate-600 mt-2">
                View all system activity and audit trail
                <span className="ml-2 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                  {totalLogs} total entries
                </span>
              </p>
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

          {/* Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Action Type</label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Actions</option>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="edit">Edit</option>
                  <option value="create">Create</option>
                  <option value="view">View</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Entity Type</label>
                <select
                  value={entityFilter}
                  onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Entities</option>
                  <option value="child_data">Child Data</option>
                  <option value="childfmly">Family</option>
                  <option value="childsibling">Sibling</option>
                  <option value="childuniform">Uniform</option>
                  <option value="childleaving">Leaving</option>
                  <option value="vocational_course">Vocational</option>
                  <option value="computer_course">Computer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">User</label>
                <select
                  value={userFilter}
                  onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Users</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  setActionFilter('all')
                  setEntityFilter('all')
                  setUserFilter('all')
                  setPage(1)
                }}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-slate-600">Loading logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-4">📭</p>
                <p className="text-slate-600 font-medium">No activity logs found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Timestamp</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Entity</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Record ID</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="font-medium text-slate-900">{log.user?.username || 'Unknown'}</span>
                            <span className="text-slate-400 ml-1 text-xs">({log.user?.role || '-'})</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${ACTION_COLORS[log.action_type] || 'bg-slate-100 text-slate-800'}`}>
                              {ACTION_ICONS[log.action_type] || '📌'} {log.action_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {ENTITY_LABELS[log.entity_type] || log.entity_type}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                            #{log.entity_id}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                            >
                              View
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
                    Page {page} of {totalPages || 1} ({totalLogs} entries)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Prev
                    </button>
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

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Activity Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase">Timestamp</p>
                  <p className="text-sm text-slate-900 font-medium">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">User</p>
                  <p className="text-sm text-slate-900 font-medium">
                    {selectedLog.user?.username || 'Unknown'} ({selectedLog.user?.role || '-'})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Action</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${ACTION_COLORS[selectedLog.action_type] || 'bg-slate-100 text-slate-800'}`}>
                    {ACTION_ICONS[selectedLog.action_type] || '📌'} {selectedLog.action_type}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Entity</p>
                  <p className="text-sm text-slate-900 font-medium">
                    {ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type} #{selectedLog.entity_id}
                  </p>
                </div>
              </div>

              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-2">Changes Made</p>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    {Object.entries(selectedLog.changes).map(([field, change]) => (
                      <div key={field} className="text-sm">
                        <span className="font-medium text-slate-700">{field}:</span>
                        <span className="text-red-600 line-through ml-2">{String(change.old)}</span>
                        <span className="text-slate-400 mx-2">→</span>
                        <span className="text-green-600">{String(change.new)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-2">Metadata</p>
                  <pre className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
