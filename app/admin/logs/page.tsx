'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '../../components/AppShell'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { ROLE_CONFIG } from '../../../lib/types'
import {
  CheckCircle,
  XCircle,
  Pencil,
  Plus,
  Trash2,
  Eye,
  Pin,
  ArrowLeft,
  Inbox,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
} from 'lucide-react'

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
  approve: 'bg-status-approved-bg text-status-approved-fg',
  reject: 'bg-status-returned-bg text-status-returned-fg',
  edit: 'bg-accent-bg text-accent-fg',
  create: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  delete: 'bg-gray-100 text-gray-800',
  view: 'bg-status-pending-bg text-status-pending-fg'
}

const getActionIcon = (actionType: string) => {
  const iconProps = { className: 'w-3.5 h-3.5' }
  switch (actionType) {
    case 'approve': return <CheckCircle {...iconProps} />
    case 'reject': return <XCircle {...iconProps} />
    case 'edit': return <Pencil {...iconProps} />
    case 'create': return <Plus {...iconProps} />
    case 'delete': return <Trash2 {...iconProps} />
    case 'view': return <Eye {...iconProps} />
    default: return <Pin {...iconProps} />
  }
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

  const roleInfo = ROLE_CONFIG.find(r => r.value === profile.role)!
  const totalPages = Math.ceil(totalLogs / 50)

  return (
      <AppShell
        role="admin"
        active="/admin/logs"
        breadcrumb={['Admin', 'Activity log']}
        username={profile.username}
      >
        <div className="px-4 py-5 sm:px-6 sm:py-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl text-ink">Activity Logs</h2>
              <p className="text-ink-muted mt-2">
                View all system activity and audit trail
                <span className="ml-2 px-2 py-1 bg-surface-hover text-ink-muted rounded-full text-sm">
                  {totalLogs} total entries
                </span>
              </p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="min-h-[40px] px-4 py-2 bg-surface-hover text-ink rounded-lg hover:bg-rule transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
          </div>

          {/* Alerts */}
          {error && <Alert type="error" message={error} className="mb-6" />}

          {/* Filters */}
          <div className="bg-surface rounded-lg border border-rule p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs text-ink-faint mb-1">Action Type</label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-rule-strong rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-xs text-ink-faint mb-1">Entity Type</label>
                <select
                  value={entityFilter}
                  onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-rule-strong rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-xs text-ink-faint mb-1">User</label>
                <select
                  value={userFilter}
                  onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-rule-strong rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
                className="min-h-[40px] px-4 py-2 bg-surface-hover text-ink-muted rounded-lg hover:bg-rule text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-surface rounded-lg border border-rule overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-ink-muted">Loading logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <Inbox className="w-14 h-14 text-rule-strong mx-auto mb-4" />
                <p className="text-ink-muted font-medium">No activity logs found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-sunken border-b border-rule">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase">Timestamp</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase">Entity</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase">Record ID</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-ink-muted uppercase">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-surface-hover">
                          <td className="px-4 py-3 text-sm text-ink-muted whitespace-nowrap">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="font-medium text-ink">{log.user?.username || 'Unknown'}</span>
                            <span className="text-ink-faint ml-1 text-xs">({log.user?.role || '-'})</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${ACTION_COLORS[log.action_type] || 'bg-surface-hover text-ink'}`}>
                              {getActionIcon(log.action_type)} {log.action_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-ink-muted">
                            {ENTITY_LABELS[log.entity_type] || log.entity_type}
                          </td>
                          <td className="px-4 py-3 text-sm text-ink-muted font-mono">
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
                <div className="px-6 py-4 border-t border-rule flex items-center justify-between">
                  <p className="text-sm text-ink-muted">
                    Page {page} of {totalPages || 1} ({totalLogs} entries)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 bg-surface-hover text-ink rounded hover:bg-rule disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1 bg-surface-hover text-ink rounded hover:bg-rule disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-rule px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-ink">Activity Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-ink-faint uppercase">Timestamp</p>
                  <p className="text-sm text-ink font-medium">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint uppercase">User</p>
                  <p className="text-sm text-ink font-medium">
                    {selectedLog.user?.username || 'Unknown'} ({selectedLog.user?.role || '-'})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint uppercase">Action</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${ACTION_COLORS[selectedLog.action_type] || 'bg-surface-hover text-ink'}`}>
                    {getActionIcon(selectedLog.action_type)} {selectedLog.action_type}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-ink-faint uppercase">Entity</p>
                  <p className="text-sm text-ink font-medium">
                    {ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type} #{selectedLog.entity_id}
                  </p>
                </div>
              </div>

              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <p className="text-xs text-ink-faint uppercase mb-2">Changes Made</p>
                  <div className="bg-surface-sunken rounded-lg p-4 space-y-2">
                    {Object.entries(selectedLog.changes).map(([field, change]) => (
                      <div key={field} className="text-sm">
                        <span className="font-medium text-ink">{field}:</span>
                        <span className="text-red-600 line-through ml-2">{String(change.old)}</span>
                        <span className="text-ink-faint mx-2 inline-flex align-middle"><ArrowRight className="w-4 h-4" /></span>
                        <span className="text-green-600">{String(change.new)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-xs text-ink-faint uppercase mb-2">Metadata</p>
                  <pre className="bg-surface-sunken rounded-lg p-4 text-sm text-ink overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
