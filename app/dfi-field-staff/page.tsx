'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireRole } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner } from '../components/UI'
import { Navbar, Sidebar, PageContainer } from '../components/Navbar'
import { ROLE_CONFIG, getRoleCapabilities } from '../../lib/types'

export default function DFIFieldStaffPage() {
  const { profile, loading, isAuthorized } = useRequireRole(['dfi_field_staff'])
  const [assignedEacNos, setAssignedEacNos] = useState<number[]>([])
  const [totalChildren, setTotalChildren] = useState(0)
  const [totalVocationalStudents, setTotalVocationalStudents] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboardStats = async () => {
      if (!isAuthorized || !profile) return

      setStatsLoading(true)
      setStatsError(null)

      try {
        const { data: eacs, error: eacError } = await supabase
          .from('dfi_field_staff_assigned_eacs')
          .select('assigned_eac')
          .eq('id', profile.id)

        if (eacError) throw eacError

        const eacNos = (eacs || [])
          .map((row) => Number((row as { assigned_eac: unknown }).assigned_eac))
          .filter((value) => !Number.isNaN(value))

        setAssignedEacNos(eacNos)

        if (eacNos.length === 0) {
          setTotalChildren(0)
          setTotalVocationalStudents(0)
          return
        }

        const [childCountRes, vocationalCountRes] = await Promise.all([
          supabase
            .from('Child_Data')
            .select('*', { count: 'exact', head: true })
            .in('eac_no', eacNos),
          supabase
            .from('vocational_course')
            .select('*', { count: 'exact', head: true })
            .in('eac_no', eacNos),
        ])

        if (childCountRes.error) throw childCountRes.error
        if (vocationalCountRes.error) throw vocationalCountRes.error

        setTotalChildren(childCountRes.count || 0)
        setTotalVocationalStudents(vocationalCountRes.count || 0)
      } catch (error: any) {
        setStatsError(error.message || 'Failed to load dashboard stats')
      } finally {
        setStatsLoading(false)
      }
    }

    loadDashboardStats()
  }, [isAuthorized, profile])

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

  const roleInfo = ROLE_CONFIG.find(r => r.value === 'dfi_field_staff')!
  const capabilities = getRoleCapabilities('dfi_field_staff')

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar
        username={profile.username}
        role="dfi_field_staff"
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color}
      />
      <Sidebar role="dfi_field_staff" />

      <PageContainer>
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">DFI Field Staff Dashboard</h2>
            <p className="text-slate-600 mt-2">{roleInfo.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-slate-600 text-sm font-medium mb-2">Assigned EACs</p>
              <p className="text-4xl font-bold text-green-600">{statsLoading ? '...' : assignedEacNos.length}</p>
              <p className="text-xs text-slate-500 mt-2">
                {assignedEacNos.length > 0 ? `EAC: ${assignedEacNos.join(', ')}` : 'No EAC assigned'}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-slate-600 text-sm font-medium mb-2">Total Children</p>
              <p className="text-4xl font-bold text-blue-600">{statsLoading ? '...' : totalChildren}</p>
              <p className="text-xs text-slate-500 mt-2">From Child_Data in assigned EACs</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-slate-600 text-sm font-medium mb-2">Vocational Students</p>
              <p className="text-4xl font-bold text-orange-600">{statsLoading ? '...' : totalVocationalStudents}</p>
              <p className="text-xs text-slate-500 mt-2">From vocational_course in assigned EACs</p>
            </div>
          </div>

          {statsError && (
            <div className="mb-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {statsError}
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Your Capabilities</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map((capability, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </span>
                  <span className="text-slate-700">{capability}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/dfi-field-staff/approve-data"
              className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg text-center"
            >
              🔍 Review Submitted Data
            </Link>
            <Link
              href="/dfi-field-staff/history"
              className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg text-center"
            >
              📊 View Activity History
            </Link>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
