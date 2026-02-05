'use client'

import { useEffect, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'

export default function ReportsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['tech_support', 'admin'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
    }
    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      setError('No data to export')
      return
    }

    // Get headers
    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header]
          // Escape quotes and wrap in quotes if contains comma
          const escaped = String(value || '').replace(/"/g, '""')
          return escaped.includes(',') ? `"${escaped}"` : escaped
        }).join(',')
      )
    ].join('\n')

    // Download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
    setSuccess(`Exported ${filename}`)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleExport = async (reportType: string) => {
    if (!sessionToken) return setError('Not signed in')
    setLoading(true)
    setError('')

    try {
      let data: any[] = []

      switch (reportType) {
        case 'all-children': {
          const { data: children } = await supabase.from('Child_Data').select('*')
          data = children || []
          break
        }
        case 'pending-approvals': {
          const { data: pending } = await supabase
            .from('Child_Data')
            .select('*')
            .eq('status', 'Pending')
          data = pending || []
          break
        }
        case 'monthly-activity': {
          const { data: activity } = await supabase
            .from('activity_logs')
            .select('*')
            .gte('created_at', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString())
          data = activity || []
          break
        }
        case 'user-activity': {
          const { data: profiles } = await supabase.from('profiles').select('*')
          if (!profiles) break

          // Get submission counts per user
          const { data: submissions } = await supabase.from('Child_Data').select('submitted_by')
          const counts = submissions?.reduce((acc: any, row: any) => {
            acc[row.submitted_by] = (acc[row.submitted_by] || 0) + 1
            return acc
          }, {}) || {}

          data = (profiles || []).map(p => ({
            id: p.id,
            username: p.username,
            email: p.email,
            role: p.role,
            submissions: counts[p.id] || 0
          }))
          break
        }
        case 'by-centre': {
          const { data: centres } = await supabase.from('centre_data').select('*')
          if (!centres) break

          // Get child count per centre
          const { data: children } = await supabase.from('Child_Data').select('eac_no')
          const childCounts = children?.reduce((acc: any, row: any) => {
            acc[row.eac_no] = (acc[row.eac_no] || 0) + 1
            return acc
          }, {}) || {}

          data = (centres || []).map(c => ({
            eac_no: c.eac_no,
            village_name: c.village_name,
            centre_id: c.centre_id,
            district: c.district,
            taluk: c.taluk,
            panchayat: c.panchayat,
            total_children: childCounts[c.eac_no] || 0
          }))
          break
        }
      }

      const timestamp = new Date().toISOString().split('T')[0]
      const filenames: Record<string, string> = {
        'all-children': `children_${timestamp}.csv`,
        'pending-approvals': `pending_approvals_${timestamp}.csv`,
        'monthly-activity': `monthly_activity_${timestamp}.csv`,
        'user-activity': `user_activity_${timestamp}.csv`,
        'by-centre': `children_by_centre_${timestamp}.csv`
      }

      exportToCSV(data, filenames[reportType])
    } catch (err: any) {
      console.error('Export error:', err)
      setError(err.message || 'Failed to export')
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

  const reports = [
    {
      id: 'all-children',
      title: 'All Children Records',
      description: 'Export all registered children with complete details',
      icon: '👶'
    },
    {
      id: 'by-centre',
      title: 'Children by Centre',
      description: 'Summary of children count organized by centre',
      icon: '📍'
    },
    {
      id: 'pending-approvals',
      title: 'Pending Approvals Report',
      description: 'All records awaiting approval',
      icon: '⏳'
    },
    {
      id: 'user-activity',
      title: 'User Activity Report',
      description: 'Submission counts per volunteer',
      icon: '👥'
    },
    {
      id: 'monthly-activity',
      title: 'Monthly Activity Report',
      description: 'All activities from the last 30 days',
      icon: '📅'
    }
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar 
        username={profile.username} 
        role={profile.role!}
        roleLabel={profile.role === 'tech_support' ? 'Tech Support' : 'Admin'}
        roleColor={profile.role === 'tech_support' ? 'bg-orange-100 text-orange-800' : 'bg-indigo-100 text-indigo-800'}
      />
      <Sidebar role={profile.role!} />
      
      <PageContainer>
        <div className="p-8">
          <div className="mx-auto max-w-6xl space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-slate-900">Reports & Export</h1>
                <p className="mt-2 text-slate-600">Generate and download system reports as CSV files</p>
              </div>
            </div>

            {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
            {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((report) => (
                <div key={report.id} className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-4xl mb-4">{report.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{report.title}</h3>
                  <p className="text-sm text-slate-600 mb-6">{report.description}</p>
                  <button
                    onClick={() => handleExport(report.id)}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Exporting...' : '⬇️ Export as CSV'}
                  </button>
                </div>
              ))}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">💡 How to Use</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Click on any report card to download it as a CSV file</li>
                <li>CSV files can be opened in Excel, Google Sheets, or any spreadsheet application</li>
                <li>Files are named with the current date for easy organization</li>
                <li>Reports include data as of the export time</li>
              </ul>
            </div>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
