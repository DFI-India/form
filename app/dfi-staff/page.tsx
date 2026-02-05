'use client'

import { useRequireRole } from '../../lib/hooks'
import { LoadingSpinner } from '../components/UI'
import { Navbar, Sidebar, PageContainer } from '../components/Navbar'
import { ROLE_CONFIG, getRoleCapabilities } from '../../lib/types'

export default function DFIStaffPage() {
  const { profile, loading, isAuthorized } = useRequireRole(['dfi_staff'])

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

          {/* SECTION 1: Data Review Stats */}
          <div className="mb-12">
            <h3 className="text-xl font-bold text-slate-900 mb-4">📊 Data Review Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <p className="text-slate-600 text-sm font-medium mb-2">Under Review</p>
                <p className="text-4xl font-bold text-purple-600">42</p>
                <p className="text-xs text-slate-500 mt-2">8 critical</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <p className="text-slate-600 text-sm font-medium mb-2">Approved</p>
                <p className="text-4xl font-bold text-green-600">156</p>
                <p className="text-xs text-slate-500 mt-2">This month</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <p className="text-slate-600 text-sm font-medium mb-2">Flagged</p>
                <p className="text-4xl font-bold text-red-600">7</p>
                <p className="text-xs text-slate-500 mt-2">Needs attention</p>
              </div>
            </div>
          </div>

          {/* SECTION 2: Data Review Actions */}
          <div className="mb-12">
            <h3 className="text-lg font-bold text-slate-900 mb-4">🔍 Data Verification</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center">
                Review Volunteer Data
              </button>
              <button className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center">
                Verify Field Staff Updates
              </button>
              <button className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center">
                View Analytics
              </button>
            </div>
          </div>

          {/* SECTION 3: Management Access */}
          <div className="mb-12">
            <h3 className="text-lg font-bold text-slate-900 mb-4">⚙️ Administrative Management</h3>
            <p className="text-slate-600 mb-4">As DFI Staff, you have full management access:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a href="/admin" className="bg-indigo-600 text-white px-6 py-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-center">
                👥 User Management
              </a>
              <a href="/admin" className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center">
                🏢 Centre Management
              </a>
            </div>
          </div>

          {/* Capabilities List */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Your Full Capabilities</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map((capability, i) => (
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
