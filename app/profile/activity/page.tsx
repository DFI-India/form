'use client'

import { useEffect, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'

interface ActivityLog {
  id: string
  user_id: string
  action_type: string
  entity_type: string
  entity_id: string
  changes?: Record<string, any>
  metadata?: Record<string, any>
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  approve: 'bg-green-100 text-green-800',
  reject: 'bg-red-100 text-red-800',
  edit: 'bg-blue-100 text-blue-800',
  create: 'bg-purple-100 text-purple-800',
  delete: 'bg-gray-100 text-gray-800',
  submit: 'bg-indigo-100 text-indigo-800'
}

const ACTION_ICONS: Record<string, string> = {
  approve: '✅',
  reject: '❌',
  edit: '✏️',
  create: '➕',
  delete: '🗑️',
  submit: '📤'
}

export default function MyActivityPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['field_volunteer', 'dfi_field_staff', 'dfi_staff', 'admin'])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token || null
      if (!token) {
        setError('Not signed in')
        return
      }
      setSessionToken(token)
      await loadActivities(token)
    }
    if (isAuthorized && profile) {
      init()
    }
  }, [isAuthorized, profile])

  async function loadActivities(token: string) {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (err) throw err

      let filtered = data as ActivityLog[]

      if (filterAction) {
        filtered = filtered.filter(a => a.action_type === filterAction)
      }

      if (filterEntity) {
        filtered = filtered.filter(a => a.entity_type === filterEntity)
      }

      if (dateFrom) {
        filtered = filtered.filter(a => new Date(a.created_at) >= new Date(dateFrom))
      }

      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        filtered = filtered.filter(a => new Date(a.created_at) <= toDate)
      }

      setActivities(filtered)
    } catch (err: any) {
      console.error('Load activities error:', err)
      setError(err.message || 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = async () => {
    if (sessionToken) {
      await loadActivities(sessionToken)
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

  const uniqueActions = Array.from(new Set(activities.map(a => a.action_type)))
  const uniqueEntities = Array.from(new Set(activities.map(a => a.entity_type)))

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar 
        username={profile.username} 
        role={profile.role!}
        roleLabel={profile.role!.replace(/_/g, ' ')}
        roleColor="bg-blue-100 text-blue-800"
      />
      <Sidebar role={profile.role!} />
      
      <PageContainer>
        <div className="p-8">
          <div className="mx-auto max-w-6xl space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-slate-900">My Activity History</h1>
                <p className="mt-2 text-slate-600">Track your actions and interactions</p>
              </div>
            </div>

            {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

            {/* Filters */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Filter Activity</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Action Type</label>
                  <select
                    value={filterAction}
                    onChange={e => setFilterAction(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Actions</option>
                    {uniqueActions.map(action => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Entity Type</label>
                  <select
                    value={filterEntity}
                    onChange={e => setFilterEntity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    {uniqueEntities.map(entity => (
                      <option key={entity} value={entity}>{entity}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleFilter}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            </div>

            {/* Activity List */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4 bg-slate-50">
                <h2 className="text-lg font-bold text-slate-900">
                  Activity Logs ({activities.length})
                </h2>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : activities.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-500">
                  No activities found
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {activities.map((activity) => (
                    <div key={activity.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="text-2xl mt-1">
                          {ACTION_ICONS[activity.action_type] || '📋'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                ACTION_COLORS[activity.action_type] || 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {activity.action_type.toUpperCase()}
                            </span>
                            <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded text-xs font-semibold">
                              {activity.entity_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-slate-900 font-medium">
                            {activity.action_type} {activity.entity_type} {activity.entity_id}
                          </p>
                          {activity.changes && Object.keys(activity.changes).length > 0 && (
                            <details className="mt-2 cursor-pointer">
                              <summary className="text-sm text-blue-600 hover:text-blue-700">
                                View changes ({Object.keys(activity.changes).length})
                              </summary>
                              <div className="mt-2 bg-slate-50 p-3 rounded text-xs font-mono text-slate-700 overflow-x-auto">
                                <pre>{JSON.stringify(activity.changes, null, 2)}</pre>
                              </div>
                            </details>
                          )}
                          <p className="text-xs text-slate-500 mt-2">
                            {new Date(activity.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
