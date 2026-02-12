'use client'

import { useEffect, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { Search, CheckCircle } from 'lucide-react'

interface AnalyticsData {
  summary: {
    totalPending: number
    totalApproved: number
    totalRejected: number
    totalChildren: number
  }
  byStatus: { pending: number; approved: number; rejected: number }
  topVolunteers: { user_id: string; username: string; count: number }[]
}

export default function DFIStaffAnalyticsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_staff', 'dfi_field_staff'])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token || null
      if (!token) {
        setError('Not signed in')
        return
      }
      setSessionToken(token)
      await loadAnalytics(token)
    }
    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  async function loadAnalytics(token: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/analytics/summary', { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Failed to load analytics')
        return
      }

      const json = await res.json()
      setAnalytics(json)
    } catch (err: any) {
      console.error('Load analytics error:', err)
      setError(err.message || 'Error loading analytics')
    } finally {
      setLoading(false)
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

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar 
        username={profile.username} 
        role={profile.role!} 
        roleLabel={profile.role === 'dfi_staff' ? 'DFI Staff' : 'DFI Field Staff'}
        roleColor={profile.role === 'dfi_staff' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}
      />
      <Sidebar role={profile.role!} />
      
      <PageContainer>
        <div className="p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-slate-900">My Analytics</h1>
                <p className="mt-2 text-slate-600">Statistics for your assigned centre</p>
              </div>
            </div>

            {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : analytics ? (
              <div className="space-y-8">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                    <p className="text-sm text-slate-600 font-medium">Total Children</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {analytics.summary.totalChildren}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                    <p className="text-sm text-slate-600 font-medium">Pending Review</p>
                    <p className="text-3xl font-bold text-yellow-600 mt-2">
                      {analytics.summary.totalPending}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                    <p className="text-sm text-slate-600 font-medium">Approved</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                      {analytics.summary.totalApproved}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                    <p className="text-sm text-slate-600 font-medium">Rejected</p>
                    <p className="text-3xl font-bold text-red-600 mt-2">
                      {analytics.summary.totalRejected}
                    </p>
                  </div>
                </div>

                {/* Approval Rate */}
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Approval Statistics</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <p className="text-5xl font-bold text-slate-900">
                        {analytics.summary.totalChildren > 0 
                          ? Math.round((analytics.summary.totalApproved / analytics.summary.totalChildren) * 100) 
                          : 0}%
                      </p>
                      <p className="text-sm text-slate-600 mt-2">Approval Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-5xl font-bold text-yellow-600">
                        {analytics.summary.totalPending}
                      </p>
                      <p className="text-sm text-slate-600 mt-2">Awaiting Review</p>
                    </div>
                    <div className="text-center">
                      <p className="text-5xl font-bold text-green-600">
                        {analytics.summary.totalApproved}
                      </p>
                      <p className="text-sm text-slate-600 mt-2">Total Approved</p>
                    </div>
                  </div>
                </div>

                {/* Top Volunteers in Centre */}
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Top Volunteers in Your Centre</h2>
                  <div className="space-y-3">
                    {analytics.topVolunteers.length === 0 ? (
                      <p className="text-slate-500">No data available</p>
                    ) : (
                      analytics.topVolunteers.map((vol, idx) => (
                        <div key={vol.user_id} className="flex items-center gap-4 pb-3 border-b border-slate-100">
                          <span className="font-bold text-lg text-slate-500 min-w-fit w-8">{idx + 1}.</span>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{vol.username}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-32 bg-slate-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{
                                  width: `${(vol.count / Math.max(...analytics.topVolunteers.map(v => v.count))) * 100}%`
                                }}
                              ></div>
                            </div>
                            <span className="font-bold text-slate-900">{vol.count}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <a
                    href="/dfi-staff/review-queue"
                    className="bg-white rounded-lg border border-slate-200 p-6 hover:border-blue-400 hover:shadow-md transition-all group"
                  >
                    <Search className="w-8 h-8 mb-2 text-slate-700 group-hover:text-blue-600" />
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">Review Queue</h3>
                    <p className="text-sm text-slate-600 mt-1">Review submitted data before approval</p>
                  </a>
                  <a
                    href="/dfi-staff/approvals"
                    className="bg-white rounded-lg border border-slate-200 p-6 hover:border-blue-400 hover:shadow-md transition-all group"
                  >
                    <CheckCircle className="w-8 h-8 mb-2 text-slate-700 group-hover:text-blue-600" />
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">Approvals</h3>
                    <p className="text-sm text-slate-600 mt-1">Approve or reject reviewed data</p>
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
