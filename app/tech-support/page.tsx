'use client'

import { useRequireRole } from '../../lib/hooks'
import { LoadingSpinner } from '../components/UI'
import { Navbar, Sidebar, PageContainer } from '../components/Navbar'
import { ROLE_CONFIG, getRoleCapabilities } from '../../lib/types'
import { Zap, Settings, BarChart, Database, RefreshCw, Ticket, Lock, Users, Building } from 'lucide-react'

export default function TechSupportPage() {
  const { profile, loading, isAuthorized } = useRequireRole(['tech_support'])

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

  const roleInfo = ROLE_CONFIG.find(r => r.value === 'tech_support')!
  const capabilities = getRoleCapabilities('tech_support')

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar 
        username={profile.username} 
        role="tech_support" 
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color}
      />
      <Sidebar role="tech_support" />
      
      <PageContainer>
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Tech Support Dashboard</h2>
            <p className="text-slate-600 mt-2">{roleInfo.description}</p>
          </div>

          {/* SECTION 1: System Health */}
          <div className="mb-12">
            <h3 className="text-xl font-bold text-slate-900 mb-4">🚨 System Health & Monitoring</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <p className="text-slate-600 text-sm font-medium mb-2">Active Alerts</p>
                <p className="text-4xl font-bold text-red-600">3</p>
                <p className="text-xs text-slate-500 mt-2">1 critical</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <p className="text-slate-600 text-sm font-medium mb-2">System Uptime</p>
                <p className="text-4xl font-bold text-green-600">99.8%</p>
                <p className="text-xs text-slate-500 mt-2">Last 30 days</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <p className="text-slate-600 text-sm font-medium mb-2">Open Tickets</p>
                <p className="text-4xl font-bold text-orange-600">12</p>
                <p className="text-xs text-slate-500 mt-2">Avg response 2hrs</p>
              </div>
            </div>
          </div>

          {/* SECTION 2: System Management */}
          <div className="mb-12">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5" /> System Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button className="bg-white border border-slate-200 text-slate-900 px-4 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center flex items-center justify-center gap-2">
                <Settings className="w-5 h-5" /> System Monitoring
              </button>
              <button className="bg-white border border-slate-200 text-slate-900 px-4 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center flex items-center justify-center gap-2">
                <BarChart className="w-5 h-5" /> View Logs
              </button>
              <button className="bg-white border border-slate-200 text-slate-900 px-4 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center flex items-center justify-center gap-2">
                <Database className="w-5 h-5" /> Database Access
              </button>
              <button className="bg-white border border-slate-200 text-slate-900 px-4 py-4 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5" /> System Updates
              </button>
            </div>
          </div>

          {/* SECTION 3: Support & Maintenance */}
          <div className="mb-12">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Ticket className="w-5 h-5" /> Support Tickets & Maintenance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="bg-orange-600 text-white px-6 py-4 rounded-lg hover:bg-orange-700 transition-colors font-medium text-center">
                Manage Support Tickets
              </button>
              <button className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center">
                Bug Tracking & Fixes
              </button>
              <button className="bg-red-600 text-white px-6 py-4 rounded-lg hover:bg-red-700 transition-colors font-medium text-center">
                Emergency Response
              </button>
            </div>
          </div>

          {/* SECTION 4: Administrative Access */}
          <div className="mb-12">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" /> Administrative Access
            </h3>
            <p className="text-slate-600 mb-4">As Tech Support, you have highest-level system access:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a href="/admin" className="bg-indigo-600 text-white px-6 py-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-center flex items-center justify-center gap-2">
                <Users className="w-5 h-5" /> User Management
              </a>
              <a href="/admin" className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center flex items-center justify-center gap-2">
                <Building className="w-5 h-5" /> Centre Management
              </a>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Your Full Capabilities</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map((capability, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm flex-shrink-0 mt-0.5 font-bold">
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
