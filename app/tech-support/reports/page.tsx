'use client'

import { useEffect, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { FileText, Columns, Search, Download, Lightbulb } from 'lucide-react'

interface ColumnDef {
  key: string
  label: string
  category: 'basic' | 'family' | 'sibling' | 'uniform' | 'vocational' | 'computer' | 'metadata'
}

const ALL_COLUMNS: ColumnDef[] = [
  // Basic Info
  { key: 'record_id', label: 'Record ID', category: 'basic' },
  { key: 'first_name', label: 'First Name', category: 'basic' },
  { key: 'last_name', label: 'Last Name', category: 'basic' },
  { key: 'adm_date', label: 'Admission Date', category: 'basic' },
  { key: 'gender', label: 'Gender', category: 'basic' },
  { key: 'class_std', label: 'Class/Standard', category: 'basic' },
  { key: 'eac_no', label: 'EAC Number', category: 'basic' },
  { key: 'village_name', label: 'Village Name', category: 'basic' },
  { key: 'status', label: 'Status', category: 'basic' },
  { key: 'reg_no', label: 'Registration Number', category: 'basic' },
  { key: 'aadhar_no', label: 'Aadhar Number', category: 'basic' },
  { key: 'birth_place', label: 'Birth Place', category: 'basic' },
  { key: 'blood_group', label: 'Blood Group', category: 'basic' },
  { key: 'caste', label: 'Caste', category: 'basic' },
  { key: 'mother_tongue', label: 'Mother Tongue', category: 'basic' },
  { key: 'height', label: 'Height', category: 'basic' },
  { key: 'weight', label: 'Weight', category: 'basic' },
  { key: 'health', label: 'Health Status', category: 'basic' },

  // School Info
  { key: 'school_name', label: 'School Name', category: 'basic' },
  { key: 'school_category', label: 'School Category', category: 'basic' },
  { key: 'medium_of_study', label: 'Medium of Study', category: 'basic' },
  { key: 'sats_no', label: 'SATS Number', category: 'basic' },
  { key: 'pen_no', label: 'PEN Number', category: 'basic' },
  { key: 'life_ambition', label: 'Life Ambition', category: 'basic' },
  { key: 'fav_subject', label: 'Favorite Subject', category: 'basic' },
  { key: 'child_other_info', label: 'Other Information', category: 'basic' },

  // Location
  { key: 'centre_id', label: 'Centre ID', category: 'basic' },
  { key: 'district', label: 'District', category: 'basic' },
  { key: 'taluk', label: 'Taluk', category: 'basic' },
  { key: 'panchayat', label: 'Panchayat', category: 'basic' },
  { key: 'village', label: 'Village', category: 'basic' },

  // Metadata
  { key: 'submitted_by', label: 'Submitted By', category: 'metadata' },
  { key: 'verified_by', label: 'Verified By', category: 'metadata' },
  { key: 'verified_at', label: 'Verified At', category: 'metadata' },
  { key: 'created_at', label: 'Created At', category: 'metadata' },
  { key: 'photo_link', label: 'Photo Link', category: 'metadata' },
]

export default function EnhancedReportsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['tech_support', 'admin'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedEac, setSelectedEac] = useState('')
  const [selectedVillage, setSelectedVillage] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')

  // Column selection
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'record_id', 'first_name', 'last_name', 'adm_date', 'gender', 'class_std', 'eac_no', 'village_name', 'status'
  ])

  // Data
  const [previewData, setPreviewData] = useState<any[]>([])
  const [centres, setCentres] = useState<any[]>([])
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token || null
      if (!token) {
        setError('Not signed in')
        return
      }
      setSessionToken(token)
      await loadCentres()
    }
    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  async function loadCentres() {
    try {
      const { data } = await supabase.from('centre_data').select('eac_no, village_name')
      if (data) {
        setCentres(data)
      }
    } catch (err) {
      console.error('Load centres error:', err)
    }
  }

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const selectAllColumns = () => {
    setSelectedColumns(ALL_COLUMNS.map(c => c.key))
  }

  const deselectAllColumns = () => {
    setSelectedColumns([])
  }

  const selectCategory = (category: string) => {
    const catCols = ALL_COLUMNS.filter(c => c.category === category).map(c => c.key)
    setSelectedColumns(prev => {
      const others = prev.filter(k => !ALL_COLUMNS.find(c => c.key === k && c.category === category))
      return [...others, ...catCols]
    })
  }

  async function loadPreview() {
    if (!sessionToken) return setError('Not signed in')
    if (selectedColumns.length === 0) return setError('Please select at least one column')

    setLoading(true)
    setError('')
    setShowPreview(false)

    try {
      let query = supabase.from('Child_Data').select(selectedColumns.join(', '))

      // Apply filters
      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString())
      }
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        query = query.lte('created_at', toDate.toISOString())
      }
      if (selectedEac) {
        query = query.eq('eac_no', selectedEac)
      }
      if (selectedVillage) {
        query = query.eq('village_name', selectedVillage)
      }
      if (selectedStatus) {
        query = query.eq('status', selectedStatus)
      }
      if (selectedGender) {
        query = query.eq('gender', selectedGender)
      }
      if (selectedGrade) {
        query = query.eq('class_std', selectedGrade)
      }

      const { data, error: err } = await query.limit(100)

      if (err) throw err

      setPreviewData(data || [])
      setShowPreview(true)
      setSuccess(`Preview loaded: ${data?.length || 0} records`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Preview error:', err)
      setError(err.message || 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (previewData.length === 0) {
      setError('No data to export. Please load preview first.')
      return
    }

    // Get headers based on selected columns
    const headers = selectedColumns.filter(col =>
      previewData.length > 0 && previewData[0].hasOwnProperty(col)
    )

    const csv = [
      headers.map(h => ALL_COLUMNS.find(c => c.key === h)?.label || h).join(','),
      ...previewData.map(row =>
        headers.map(header => {
          const value = row[header]
          const escaped = String(value || '').replace(/"/g, '""')
          return escaped.includes(',') || escaped.includes('\n') ? `"${escaped}"` : escaped
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    const timestamp = new Date().toISOString().split('T')[0]
    let filename = `export_${timestamp}`
    if (selectedEac) filename += `_${selectedEac}`
    if (selectedStatus) filename += `_${selectedStatus}`
    filename += '.csv'

    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
    setSuccess(`Exported ${filename} with ${previewData.length} records`)
    setTimeout(() => setSuccess(''), 3000)
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

  const columnsByCategory = ALL_COLUMNS.reduce((acc, col) => {
    if (!acc[col.category]) acc[col.category] = []
    acc[col.category].push(col)
    return acc
  }, {} as Record<string, ColumnDef[]>)

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
          <div className="mx-auto max-w-7xl space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Advanced Report Builder</h1>
              <p className="mt-2 text-slate-600">Create custom reports with dynamic filters and column selection</p>
            </div>

            {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
            {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

            {/* Filters Section */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-6 h-6" /> Data Filters
                </h2>
                <button
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                    setSelectedEac('')
                    setSelectedVillage('')
                    setSelectedStatus('')
                    setSelectedGender('')
                    setSelectedGrade('')
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear All Filters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Date Range */}
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

                {/* EAC Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">EAC Number</label>
                  <select
                    value={selectedEac}
                    onChange={e => {
                      setSelectedEac(e.target.value)
                      const centre = centres.find(c => c.eac_no === e.target.value)
                      if (centre) setSelectedVillage(centre.village_name)
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All EACs</option>
                    {centres.map(c => (
                      <option key={c.eac_no} value={c.eac_no}>{c.eac_no}</option>
                    ))}
                  </select>
                </div>

                {/* Village */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Village</label>
                  <select
                    value={selectedVillage}
                    onChange={e => setSelectedVillage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Villages</option>
                    {centres.map(c => (
                      <option key={c.village_name} value={c.village_name}>{c.village_name}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                  <select
                    value={selectedGender}
                    onChange={e => setSelectedGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                {/* Grade */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Class/Standard</label>
                  <input
                    type="text"
                    value={selectedGrade}
                    onChange={e => setSelectedGrade(e.target.value)}
                    placeholder="e.g., 5, 10"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Column Selection */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Columns className="w-6 h-6" /> Column Selection
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllColumns}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={deselectAllColumns}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="text-sm text-slate-600 mb-4">
                Selected: <span className="font-semibold text-slate-900">{selectedColumns.length}</span> columns
              </div>

              {/* Quick category selection */}
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.keys(columnsByCategory).map(category => (
                  <button
                    key={category}
                    onClick={() => selectCategory(category)}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-100 transition-colors"
                  >
                    Select {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>

              {/* Column checkboxes by category */}
              {Object.entries(columnsByCategory).map(([category, cols]) => (
                <div key={category} className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {cols.map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={loadPreview}
                disabled={loading || selectedColumns.length === 0}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? 'Loading...' : (
                  <>
                    <Search className="w-5 h-5" /> Load Preview
                  </>
                )}
              </button>
              <button
                onClick={exportToCSV}
                disabled={!showPreview || previewData.length === 0}
                className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Download className="w-5 h-5" /> Export to CSV
              </button>
            </div>

            {/* Preview Section */}
            {showPreview && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4 bg-slate-50">
                  <h2 className="text-lg font-bold text-slate-900">
                    Data Preview ({previewData.length} records, limited to 100)
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  {previewData.length === 0 ? (
                    <div className="px-6 py-12 text-center text-slate-500">
                      No records found matching your filters
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {selectedColumns.map(col => (
                            <th key={col} className="px-4 py-3 text-left font-semibold text-slate-700">
                              {ALL_COLUMNS.find(c => c.key === col)?.label || col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {selectedColumns.map(col => (
                              <td key={col} className="px-4 py-3 text-slate-700">
                                {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Lightbulb className="w-5 h-5" /> How to Use
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Apply filters to narrow down your data (date range, EAC, status, etc.)</li>
                <li>Select the columns you want to include in your report</li>
                <li>Click "Load Preview" to see the first 100 matching records</li>
                <li>Review the preview and click "Export to CSV" to download the full dataset</li>
                <li>CSV files can be opened in Excel, Google Sheets, or any spreadsheet application</li>
              </ul>
            </div>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
