'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRequireRole } from '../../lib/hooks'
import { LoadingSpinner } from '../components/UI'
import { Navbar, Sidebar, PageContainer } from '../components/Navbar'
import { ROLE_CONFIG } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { ClipboardList, FileEdit, Check } from 'lucide-react'

export default function FieldVolunteerPage() {
  const { profile, loading, isAuthorized } = useRequireRole(['field_volunteer'])
  const [statsLoading, setStatsLoading] = useState(true)
  const [childrenEnrolled, setChildrenEnrolled] = useState(0)
  const [girlsCount, setGirlsCount] = useState(0)
  const [boysCount, setBoysCount] = useState(0)

  useEffect(() => {
    const loadStats = async () => {
      try {
        setStatsLoading(true)

        const [{ count: totalCount }, { count: girls }, { count: boys }] = await Promise.all([
          supabase.from('Child_Data').select('*', { count: 'exact', head: true }),
          supabase.from('Child_Data').select('*', { count: 'exact', head: true }).eq('gender', 'Female'),
          supabase.from('Child_Data').select('*', { count: 'exact', head: true }).eq('gender', 'Male'),
        ])

        setChildrenEnrolled(totalCount ?? 0)
        setGirlsCount(girls ?? 0)
        setBoysCount(boys ?? 0)
      } catch (error) {
        console.error('Failed to load field volunteer stats:', error)
        setChildrenEnrolled(0)
        setGirlsCount(0)
        setBoysCount(0)
      } finally {
        setStatsLoading(false)
      }
    }

    if (isAuthorized && profile) {
      loadStats()
    }
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

  const roleInfo = ROLE_CONFIG.find(r => r.value === 'field_volunteer')!
  const capabilities = ['Update field data', 'View personal activity history']

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar
        username={profile.username}
        role="field_volunteer"
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color}
      />
      <Sidebar role="field_volunteer" />

      <PageContainer>
        <div className="p-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Field Volunteer Dashboard</h2>
            <p className="text-slate-600 mt-2">{roleInfo.description}</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-slate-600 text-sm font-medium mb-2">Children Enrolled</p>
              <p className="text-4xl font-bold text-blue-600">{statsLoading ? '...' : childrenEnrolled}</p>
              <p className="text-xs text-slate-500 mt-2">Total records in Child_Data</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-slate-600 text-sm font-medium mb-2">Number of Girls</p>
              <p className="text-4xl font-bold text-pink-600">{statsLoading ? '...' : girlsCount}</p>
              <p className="text-xs text-slate-500 mt-2">Gender = Female in Child_Data</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-slate-600 text-sm font-medium mb-2">Number of Boys</p>
              <p className="text-4xl font-bold text-emerald-600">{statsLoading ? '...' : boysCount}</p>
              <p className="text-xs text-slate-500 mt-2">Gender = Male in Child_Data</p>
            </div>
          </div>

          {/* Capabilities */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">What You Can Do</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map((capability, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm flex-shrink-0 mt-0.5 font-bold">
                    <Check className="w-3 h-3" />
                  </span>
                  <span className="text-slate-700">{capability}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/field-volunteer/child-data-entry"
              className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg flex items-center justify-center gap-2"
            >
              <FileEdit className="w-5 h-5" /> Update field data
            </Link>
            <Link
              href="/field-volunteer/history"
              className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg flex items-center justify-center gap-2"
            >
              <ClipboardList className="w-5 h-5" /> View personal activity history
            </Link>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
