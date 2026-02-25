'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRequireRole } from '../../lib/hooks'
import { LoadingSpinner } from '../components/UI'
import { Navbar, Sidebar, PageContainer } from '../components/Navbar'
import { ROLE_CONFIG, getRoleCapabilities } from '../../lib/types'
import { supabase } from '../../lib/supabase'

interface DashboardAnalytics {
  summary: {
    totalEacs: number
    totalChildren: number
    totalVocationalStudents: number
    totalApprovedChildren?: number
    totalApprovedVocationalStudents?: number
  }
  byCentre: {
    eac_no: string | number
    village_name?: string
    count: number
  }[]
}

const PIE_COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed', '#ea580c', '#0d9488']

export default function DFIStaffPage() {
  const { profile, loading, isAuthorized } = useRequireRole(['dfi_staff'])
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    const loadDashboardStats = async () => {
      setDataLoading(true)
      setDataError('')
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) {
          setDataError('Not signed in')
          return
        }

        const res = await fetch('/api/admin/analytics/summary', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || 'Failed to load dashboard stats')
        }

        setAnalytics({
          summary: {
            totalEacs: json.summary?.totalEacs || 0,
            totalChildren: json.summary?.totalChildren || 0,
            totalVocationalStudents: json.summary?.totalVocationalStudents || 0,
            totalApprovedChildren: json.summary?.totalApprovedChildren || 0,
            totalApprovedVocationalStudents: json.summary?.totalApprovedVocationalStudents || 0
          },
          byCentre: json.byCentre || []
        })
      } catch (err: any) {
        setDataError(err.message || 'Failed to load dashboard stats')
      } finally {
        setDataLoading(false)
      }
    }

    if (isAuthorized) {
      loadDashboardStats()
    }
  }, [isAuthorized])

  const pieData = useMemo(() => {
    const rows = analytics?.byCentre || []
    const total = rows.reduce((sum, row) => sum + (row.count || 0), 0)
    if (total === 0) return []

    let currentAngle = -90
    return rows.map((row, index) => {
      const value = row.count || 0
      const sweep = (value / total) * 360
      const percentage = (value / total) * 100
      const startAngle = currentAngle
      const endAngle = currentAngle + sweep
      currentAngle = endAngle

      const cx = 120
      const cy = 120
      const radius = 90

      const startRad = (Math.PI / 180) * startAngle
      const endRad = (Math.PI / 180) * endAngle
      const x1 = cx + radius * Math.cos(startRad)
      const y1 = cy + radius * Math.sin(startRad)
      const x2 = cx + radius * Math.cos(endRad)
      const y2 = cy + radius * Math.sin(endRad)
      const largeArc = sweep > 180 ? 1 : 0
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

      return {
        key: String(row.eac_no),
        eac: row.eac_no,
        count: value,
        percentage,
        color: PIE_COLORS[index % PIE_COLORS.length],
        path
      }
    })
  }, [analytics])

  if (loading) {
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
  const capabilities = getRoleCapabilities('dfi_staff')
  const visibleCapabilities = capabilities.filter(
    (capability) => capability.trim().toLowerCase() !== 'update assigned records'
  )

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
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">DFI Staff Dashboard</h2>
            <p className="text-slate-600 mt-2">{roleInfo.description}</p>
          </div>

          {dataError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {dataError}
            </div>
          )}

          {/* SECTION 1: Data Review Stats */}
          <div className="mb-12">
            <h3 className="text-xl font-bold text-slate-900 mb-4">📊 Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <p className="text-slate-600 text-sm font-medium mb-2">Total EACs</p>
                <p className="text-4xl font-bold text-indigo-600">{analytics?.summary.totalEacs ?? 0}</p>
                <p className="text-xs text-slate-500 mt-2">From centre_data</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <p className="text-slate-600 text-sm font-medium mb-2">Total Children</p>
                <p className="text-4xl font-bold text-blue-600">{analytics?.summary.totalApprovedChildren ?? 0}</p>
                <p className="text-xs text-slate-500 mt-2">Approved rows in Child_Data</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <p className="text-slate-600 text-sm font-medium mb-2">Vocational Students</p>
                <p className="text-4xl font-bold text-emerald-600">{analytics?.summary.totalApprovedVocationalStudents ?? 0}</p>
                <p className="text-xs text-slate-500 mt-2">Approved rows in vocational_course</p>
              </div>
            </div>
          </div>

          <div className="mb-12 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Children Distribution by EAC</h3>
            {dataLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : pieData.length === 0 ? (
              <p className="text-slate-600">No data available.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                <div className="flex justify-center">
                  <svg width="260" height="260" viewBox="0 0 240 240" role="img" aria-label="Children by EAC pie chart">
                    {pieData.map((slice) => (
                      <path key={slice.key} d={slice.path} fill={slice.color} stroke="#fff" strokeWidth="1">
                        <title>{`EAC ${String(slice.eac)}: ${slice.count} children (${slice.percentage.toFixed(1)}%)`}</title>
                      </path>
                    ))}
                  </svg>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {pieData.map((slice) => (
                    <div key={`legend-${slice.key}`} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: slice.color }} />
                        <span className="text-slate-700">EAC {String(slice.eac)}</span>
                      </div>
                      <span className="font-medium text-slate-900">{slice.count} ({slice.percentage.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Data Review Actions */}
          <div className="mb-12">
            <h3 className="text-lg font-bold text-slate-900 mb-4">🔍 Data Verification</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a href="/dfi-staff/approvals" className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center">
                Approve Data
              </a>
              <a href="/dfi-staff/all-records" className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center">
                Manage Data
              </a>
              <a href="/dfi-staff/history" className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center">
                View Approval History
              </a>
            </div>
          </div>

          {/* Capabilities List */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Your Full Capabilities</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleCapabilities.map((capability, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </span>
                  <span className="text-slate-700">{capability}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
