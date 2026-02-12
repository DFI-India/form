'use client'

import { useRequireRole } from '../../lib/hooks'
import { LoadingSpinner } from '../components/UI'
import { Navbar, Sidebar, PageContainer } from '../components/Navbar'
import { ROLE_CONFIG, getRoleCapabilities } from '../../lib/types'
import { ClipboardList, FileEdit } from 'lucide-react'

export default function FieldVolunteerPage() {
  const { profile, loading, isAuthorized } = useRequireRole(['field_volunteer'])

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
  const capabilities = getRoleCapabilities('field_volunteer')

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
              <p className="text-slate-600 text-sm font-medium mb-2">Assigned Tasks</p>
              <p className="text-4xl font-bold text-blue-600">5</p>
              <p className="text-xs text-slate-500 mt-2">2 overdue</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-slate-600 text-sm font-medium mb-2">Submitted Reports</p>
              <p className="text-4xl font-bold text-green-600">12</p>
              <p className="text-xs text-slate-500 mt-2">8 approved</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-slate-600 text-sm font-medium mb-2">Pending Review</p>
              <p className="text-4xl font-bold text-orange-600">3</p>
              <p className="text-xs text-slate-500 mt-2">Avg 2 days</p>
            </div>
          </div>

          {/* Capabilities */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">What You Can Do</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map((capability, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </span>
                  <span className="text-slate-700">{capability}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg flex items-center justify-center gap-2">
              <ClipboardList className="w-5 h-5" /> View Assigned Tasks
            </button>
            <button className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg flex items-center justify-center gap-2">
              <FileEdit className="w-5 h-5" /> Submit New Report
            </button>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
