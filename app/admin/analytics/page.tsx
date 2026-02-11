'use client'

import { useEffect, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { CheckCircle } from 'lucide-react'

interface AnalyticsData {
  summary: {
    totalPending: number
    totalApproved: number
    totalRejected: number
    totalChildren: number
  }
  byStatus: { pending: number; approved: number; rejected: number }
  byCentre: { eac_no: string; village_name: string; count: number }[]
  topVolunteers: { user_id: string; username: string; count: number }[]
  vocationalCourses: { course: string; count: number }[]
  computerCourses: { course: string; count: number }[]
  timeline: { date: string; pending: number; approved: number; rejected: number }[]
  genderDistribution: Record<string, number>
  ageDistribution: Record<string, number>
  gradeDistribution: Record<string, number>
}

export default function AdminAnalyticsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])
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
        role="admin" 
        roleLabel="Admin"
        roleColor="bg-indigo-100 text-indigo-800"
      />
      <Sidebar role="admin" />
      
      <PageContainer>
        <div className="p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-slate-900">Analytics & Reports</h1>
                <p className="mt-2 text-slate-600">System-wide statistics and trends</p>
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
                    <p className="text-sm text-slate-600 font-medium">Pending Approval</p>
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

                {/* Status Distribution Pie Chart */}
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Status Distribution</h2>
                  <div className="flex flex-col items-center gap-8">
                    <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow">
                      {(() => {
                        const total = analytics.summary.totalChildren || 1
                        const pendingPercent = (analytics.summary.totalPending / total) * 100
                        const approvedPercent = (analytics.summary.totalApproved / total) * 100
                        
                        const pendingAngle = (pendingPercent / 100) * 360
                        const approvedAngle = (approvedPercent / 100) * 360
                        
                        const x1 = 100 + 80 * Math.cos(Math.PI * 2 * (0) - Math.PI / 2)
                        const y1 = 100 + 80 * Math.sin(Math.PI * 2 * (0) - Math.PI / 2)
                        
                        const x2 = 100 + 80 * Math.cos(Math.PI * 2 * (pendingPercent / 100) - Math.PI / 2)
                        const y2 = 100 + 80 * Math.sin(Math.PI * 2 * (pendingPercent / 100) - Math.PI / 2)
                        
                        const x3 = 100 + 80 * Math.cos(Math.PI * 2 * ((pendingPercent + approvedPercent) / 100) - Math.PI / 2)
                        const y3 = 100 + 80 * Math.sin(Math.PI * 2 * ((pendingPercent + approvedPercent) / 100) - Math.PI / 2)
                        
                        const x4 = 100 + 80 * Math.cos(Math.PI * 2 * 1 - Math.PI / 2)
                        const y4 = 100 + 80 * Math.sin(Math.PI * 2 * 1 - Math.PI / 2)

                        return (
                          <>
                            {/* Pending slice */}
                            <path
                              d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${pendingAngle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
                              fill="#FBBF24"
                              stroke="white"
                              strokeWidth="2"
                            />
                            {/* Approved slice */}
                            <path
                              d={`M 100 100 L ${x2} ${y2} A 80 80 0 ${approvedAngle > 180 ? 1 : 0} 1 ${x3} ${y3} Z`}
                              fill="#34D399"
                              stroke="white"
                              strokeWidth="2"
                            />
                            {/* Rejected slice */}
                            <path
                              d={`M 100 100 L ${x3} ${y3} A 80 80 0 0 1 ${x4} ${y4} Z`}
                              fill="#EF4444"
                              stroke="white"
                              strokeWidth="2"
                            />
                          </>
                        )
                      })()}
                    </svg>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                        <span className="text-sm text-slate-700">Pending: {analytics.summary.totalPending}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-400 rounded"></div>
                        <span className="text-sm text-slate-700">Approved: {analytics.summary.totalApproved}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-400 rounded"></div>
                        <span className="text-sm text-slate-700">Rejected: {analytics.summary.totalRejected}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* By Centre */}
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Children by Centre</h2>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {analytics.byCentre.length === 0 ? (
                      <p className="text-slate-500">No data available</p>
                    ) : (
                      analytics.byCentre.sort((a, b) => b.count - a.count).map((centre) => (
                        <div key={centre.eac_no} className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div>
                            <p className="font-medium text-slate-900">{centre.village_name}</p>
                            <p className="text-sm text-slate-500">{centre.eac_no}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-48 bg-slate-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{
                                  width: `${(centre.count / Math.max(...analytics.byCentre.map(c => c.count))) * 100}%`
                                }}
                              ></div>
                            </div>
                            <span className="font-bold text-slate-900 min-w-fit">{centre.count}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Top Volunteers */}
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Top Submitting Volunteers</h2>
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
                          <span className="text-lg font-bold text-blue-600">{vol.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* VTC Trends */}
                {(analytics.vocationalCourses.length > 0 || analytics.computerCourses.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {analytics.vocationalCourses.length > 0 && (
                      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">Vocational Courses</h2>
                        <div className="space-y-2">
                          {analytics.vocationalCourses.sort((a, b) => b.count - a.count).map((course) => (
                            <div key={course.course} className="flex items-center justify-between pb-2">
                              <span className="text-sm text-slate-700">{course.course}</span>
                              <span className="font-semibold text-slate-900">{course.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analytics.computerCourses.length > 0 && (
                      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">Computer Courses</h2>
                        <div className="space-y-2">
                          {analytics.computerCourses.sort((a, b) => b.count - a.count).map((course) => (
                            <div key={course.course} className="flex items-center justify-between pb-2">
                              <span className="text-sm text-slate-700">{course.course}</span>
                              <span className="font-semibold text-slate-900">{course.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline Chart */}
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">30-Day Approval Timeline</h2>
                  <div className="h-64 flex items-end gap-1 overflow-x-auto pb-8">
                    {analytics.timeline.map((day) => {
                      const total = day.pending + day.approved + day.rejected || 1
                      const maxHeight = 200
                      const pendingHeight = (day.pending / total) * maxHeight
                      const approvedHeight = (day.approved / total) * maxHeight
                      const rejectedHeight = (day.rejected / total) * maxHeight

                      return (
                        <div key={day.date} className="flex flex-col items-center gap-1 min-w-max">
                          <div className="flex flex-col h-48 gap-0 bg-slate-50 rounded">
                            {rejectedHeight > 0 && (
                              <div
                                className="bg-red-400"
                                style={{ height: `${rejectedHeight}px` }}
                                title={`Rejected: ${day.rejected}`}
                              ></div>
                            )}
                            {approvedHeight > 0 && (
                              <div
                                className="bg-green-400"
                                style={{ height: `${approvedHeight}px` }}
                                title={`Approved: ${day.approved}`}
                              ></div>
                            )}
                            {pendingHeight > 0 && (
                              <div
                                className="bg-yellow-400"
                                style={{ height: `${pendingHeight}px` }}
                                title={`Pending: ${day.pending}`}
                              ></div>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 mt-2 w-full text-center">
                            {new Date(day.date).getDate()}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-center gap-4 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                      <span>Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded"></div>
                      <span>Approved</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-400 rounded"></div>
                      <span>Rejected</span>
                    </div>
                  </div>
                </div>

                {/* Gender Distribution */}
                {analytics.genderDistribution && Object.keys(analytics.genderDistribution).length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Gender Distribution</h2>
                    <div className="flex flex-col md:flex-row items-center justify-around gap-8">
                      {/* Pie Chart */}
                      <svg width="180" height="180" viewBox="0 0 180 180" className="drop-shadow">
                        {(() => {
                          const colors = ['#3B82F6', '#EC4899', '#94A3B8']
                          const entries = Object.entries(analytics.genderDistribution)
                          const total = entries.reduce((sum, [_, count]) => sum + count, 0) || 1
                          let currentAngle = 0

                          return entries.map(([gender, count], idx) => {
                            const percent = (count / total) * 100
                            const angle = (percent / 100) * 360
                            const startX = 90 + 70 * Math.cos((currentAngle * Math.PI) / 180 - Math.PI / 2)
                            const startY = 90 + 70 * Math.sin((currentAngle * Math.PI) / 180 - Math.PI / 2)
                            const endX = 90 + 70 * Math.cos(((currentAngle + angle) * Math.PI) / 180 - Math.PI / 2)
                            const endY = 90 + 70 * Math.sin(((currentAngle + angle) * Math.PI) / 180 - Math.PI / 2)
                            const largeArc = angle > 180 ? 1 : 0
                            currentAngle += angle

                            return (
                              <path
                                key={gender}
                                d={`M 90 90 L ${startX} ${startY} A 70 70 0 ${largeArc} 1 ${endX} ${endY} Z`}
                                fill={colors[idx % colors.length]}
                                stroke="white"
                                strokeWidth="2"
                              />
                            )
                          })
                        })()}
                      </svg>

                      {/* Legend */}
                      <div className="space-y-3">
                        {Object.entries(analytics.genderDistribution).map(([gender, count], idx) => {
                          const colors = ['bg-blue-500', 'bg-pink-500', 'bg-slate-400']
                          const total = Object.values(analytics.genderDistribution).reduce((a, b) => a + b, 0)
                          const percent = ((count / total) * 100).toFixed(1)
                          return (
                            <div key={gender} className="flex items-center gap-3">
                              <div className={`w-4 h-4 ${colors[idx % colors.length]} rounded`}></div>
                              <div>
                                <p className="font-medium text-slate-900">{gender}</p>
                                <p className="text-sm text-slate-600">{count} ({percent}%)</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Age Distribution */}
                {analytics.ageDistribution && Object.keys(analytics.ageDistribution).length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Age Group Distribution (by Class)</h2>
                    <div className="h-64">
                      <div className="flex items-end justify-around h-56 gap-4 px-4">
                        {Object.entries(analytics.ageDistribution)
                          .sort((a, b) => {
                            const order = ['6-10', '11-14', '15-18', '18+', 'Unknown']
                            return order.indexOf(a[0]) - order.indexOf(b[0])
                          })
                          .map(([ageGroup, count]) => {
                            const maxCount = Math.max(...Object.values(analytics.ageDistribution))
                            const heightPercent = (count / maxCount) * 100
                            return (
                              <div key={ageGroup} className="flex flex-col items-center gap-2 flex-1">
                                <div className="w-full flex flex-col items-center">
                                  <span className="text-sm font-semibold text-slate-900 mb-1">{count}</span>
                                  <div
                                    className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg"
                                    style={{ height: `${heightPercent}%`, minHeight: count > 0 ? '20px' : '0' }}
                                    title={`${ageGroup}: ${count} children`}
                                  ></div>
                                </div>
                                <span className="text-xs font-medium text-slate-600 text-center">{ageGroup}</span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Grade Distribution */}
                {analytics.gradeDistribution && Object.keys(analytics.gradeDistribution).length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Grade-Wise Distribution</h2>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {Object.entries(analytics.gradeDistribution)
                        .filter(([grade]) => grade !== 'Unknown')
                        .sort((a, b) => {
                          const gradeA = parseInt(a[0]) || 999
                          const gradeB = parseInt(b[0]) || 999
                          return gradeA - gradeB
                        })
                        .map(([grade, count]) => {
                          const maxCount = Math.max(...Object.values(analytics.gradeDistribution).filter(v => v > 0))
                          const widthPercent = (count / maxCount) * 100
                          return (
                            <div key={grade} className="flex items-center gap-4">
                              <span className="font-medium text-slate-900 min-w-fit w-20">Grade {grade}</span>
                              <div className="flex-1 bg-slate-200 rounded-full h-6">
                                <div
                                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-6 rounded-full flex items-center justify-end px-3"
                                  style={{ width: `${Math.max(widthPercent, 5)}%` }}
                                >
                                  <span className="text-xs font-semibold text-white">{count}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      {analytics.gradeDistribution['Unknown'] > 0 && (
                        <div className="flex items-center gap-4 pt-2 border-t border-slate-200">
                          <span className="font-medium text-slate-500 min-w-fit w-20">Unknown</span>
                          <div className="flex-1 bg-slate-200 rounded-full h-6">
                            <div
                              className="bg-slate-400 h-6 rounded-full flex items-center justify-end px-3"
                              style={{ 
                                width: `${Math.max((analytics.gradeDistribution['Unknown'] / Math.max(...Object.values(analytics.gradeDistribution))) * 100, 5)}%` 
                              }}
                            >
                              <span className="text-xs font-semibold text-white">{analytics.gradeDistribution['Unknown']}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Approval Rate Card */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-8 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-indigo-100 text-sm font-medium mb-2">Overall Approval Rate</p>
                      <p className="text-5xl font-bold">
                        {analytics.summary.totalChildren > 0 
                          ? Math.round((analytics.summary.totalApproved / analytics.summary.totalChildren) * 100) 
                          : 0}%
                      </p>
                      <p className="text-indigo-100 text-sm mt-2">
                        {analytics.summary.totalApproved} approved out of {analytics.summary.totalChildren} total submissions
                      </p>
                    </div>
                    <CheckCircle className="w-16 h-16 text-green-600" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
