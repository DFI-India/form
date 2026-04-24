'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { LoadingSpinner } from '../../components/UI'
import { ROLE_CONFIG } from '../../../lib/types'
import { useRequireRole } from '../../../lib/hooks'

type HistorySubTabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving' | 'vocational' | 'computer'

type FormState = {
  eac_no: string
  village_name: string
  centre_id: string
  district: string
  taluk: string
  panchayat: string
  village: string
  adm_date: string
  reg_no: string
  first_name: string
  last_name: string
  gender: string
  aadhar_no: string
  birth_place: string
  height: string
  weight: string
  blood_group: string
  health: string
  caste: string
  mother_tongue: string
  class_std_text: string
  school_name: string
  school_category: string
  sats_no: string
  pen_no: string
  medium_of_study: string
  life_ambition: string
  fav_subject: string
  child_other_info: string
  photo_link: string
}

type HistoryRow = FormState & { record_id?: number }

type MessageState = { type: 'success' | 'error'; text: string } | null

export default function ActivityHistoryPage() {
  const router = useRouter()
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['field_volunteer'])

  // Personal history state
  const [historyData, setHistoryData] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyMessage, setHistoryMessage] = useState<MessageState>(null)

  // Personal history subtabs state
  const [activeHistorySubTab, setActiveHistorySubTab] = useState<HistorySubTabType>('child')

  // History data for each type
  const [historyChildData, setHistoryChildData] = useState<any[]>([])
  const [historyFamilyData, setHistoryFamilyData] = useState<any[]>([])
  const [historySiblingData, setHistorySiblingData] = useState<any[]>([])
  const [historyUniformData, setHistoryUniformData] = useState<any[]>([])
  const [historyLeavingData, setHistoryLeavingData] = useState<any[]>([])
  const [historyVocationalData, setHistoryVocationalData] = useState<any[]>([])
  const [historyComputerData, setHistoryComputerData] = useState<any[]>([])

  // Date range filters for each type
  const [historyChildDateRange, setHistoryChildDateRange] = useState({ start: '', end: '' })
  const [historyFamilyDateRange, setHistoryFamilyDateRange] = useState({ start: '', end: '' })
  const [historySiblingDateRange, setHistorySiblingDateRange] = useState({ start: '', end: '' })
  const [historyUniformDateRange, setHistoryUniformDateRange] = useState({ start: '', end: '' })
  const [historyLeavingDateRange, setHistoryLeavingDateRange] = useState({ start: '', end: '' })
  const [historyVocationalDateRange, setHistoryVocationalDateRange] = useState({ start: '', end: '' })
  const [historyComputerDateRange, setHistoryComputerDateRange] = useState({ start: '', end: '' })

  // Loading states for history subtabs
  const [historyChildLoading, setHistoryChildLoading] = useState(false)
  const [historyFamilyLoading, setHistoryFamilyLoading] = useState(false)
  const [historySiblingLoading, setHistorySiblingLoading] = useState(false)
  const [historyUniformLoading, setHistoryUniformLoading] = useState(false)
  const [historyLeavingLoading, setHistoryLeavingLoading] = useState(false)
  const [historyVocationalLoading, setHistoryVocationalLoading] = useState(false)
  const [historyComputerLoading, setHistoryComputerLoading] = useState(false)

  useEffect(() => {
    if (isAuthorized) {
      fetchPersonalHistory()
    }
  }, [isAuthorized])

  const fetchPersonalHistory = async () => {
    setHistoryLoading(true)
    setHistoryMessage(null)

    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('No user session found.')

      const { data: approvals, error: approvalsError } = await supabase
        .from('child_approvals')
        .select('entity_id')
        .eq('submitted_by', userId)
        .eq('entity_type', 'Child_Data')

      if (approvalsError) throw approvalsError

      const ids: (string | number)[] = (approvals ?? [])
        .map((r: any) => {
          const v = r?.entity_id
          if (v === null || v === undefined || v === '') return null
          if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
          return v
        })
        .filter((v): v is string | number => v !== null && v !== undefined && v !== '')

      if (ids.length === 0) {
        setHistoryData([])
        return
      }

      const { data: rows, error: rowsError } = await supabase
        .from('Child_Data')
        .select('*')
        .in('record_id', ids)

      if (rowsError) throw rowsError

      // Sort descending by record_id for most recent first
      const sorted = (rows ?? []).slice().sort((a: any, b: any) => (b.record_id ?? 0) - (a.record_id ?? 0))
      setHistoryData(sorted as HistoryRow[])
    } catch (error) {
      console.error('Error fetching personal history:', error)
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setHistoryMessage({ type: 'error', text: `Unable to load history: ${fallback}` })
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchHistoryData = async (
    tableName: string,
    entityType: string,
    setData: (data: any[]) => void,
    setLoading: (loading: boolean) => void,
    dateRange: { start: string; end: string },
    approvalsTable: string = 'child_approvals'
  ) => {
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('No user session found.')

      // First, get entity IDs from the appropriate approvals table for this user and entity type
      const { data: approvals, error: approvalsError } = await supabase
        .from(approvalsTable)
        .select('entity_id')
        .eq('submitted_by', userId)
        .eq('entity_type', entityType)

      if (approvalsError) {
        console.error('[History][fetch] approvals query error', { approvalsTable, entityType, error: approvalsError })
        throw approvalsError
      }

      const ids: (string | number)[] = (approvals ?? [])
        .map((r: any) => {
          const v = r?.entity_id
          if (v === null || v === undefined || v === '') return null
          if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
          return v
        })
        .filter((v): v is string | number => v !== null && v !== undefined && v !== '')

      if (ids.length === 0) {
        setData([])
        return
      }

      // Then fetch records from the table using those IDs.
      // Try common `record_id` column first (used by legacy child tables),
      // fall back to `id` column if the former doesn't exist.
      let rows: any[] | null = null
      let rowsError: any = null

      const tryQuery = async (col: string) => {
        try {
          let q = supabase.from(tableName).select('*').in(col, ids)
          if (dateRange.start) q = q.gte('created_at', dateRange.start)
          if (dateRange.end) q = q.lte('created_at', dateRange.end)
          return await q
        } catch (e) {
          return { data: null, error: e }
        }
      }

      try {
        const res = await tryQuery('record_id')
        rows = res.data
        rowsError = res.error
        if (rowsError && rowsError.code === '42703') {
          const res2 = await tryQuery('id')
          rows = res2.data
          rowsError = res2.error
        }
      } catch (e) {
        rowsError = e
      }

      if (rowsError) {
        console.error('[History][fetch] rows query error', { tableName, error: rowsError })
        throw rowsError
      }

      const sorted = (rows ?? []).slice().sort((a: any, b: any) => {
        const aDate = new Date(a.created_at || 0).getTime()
        const bDate = new Date(b.created_at || 0).getTime()
        return bDate - aDate
      })

      setData(sorted)
    } catch (error) {
      console.error(`Error fetching ${tableName} history:`, error)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const handleHistorySubTabChange = (subTab: HistorySubTabType) => {
    setActiveHistorySubTab(subTab)

    // Fetch data for the selected subtab
    switch (subTab) {
      case 'child':
        fetchHistoryData('Child_Data', 'Child_Data', setHistoryChildData, setHistoryChildLoading, historyChildDateRange)
        break
      case 'family':
        fetchHistoryData('childfmly', 'childfmly', setHistoryFamilyData, setHistoryFamilyLoading, historyFamilyDateRange)
        break
      case 'sibling':
        fetchHistoryData('childsibling', 'childsibling', setHistorySiblingData, setHistorySiblingLoading, historySiblingDateRange)
        break
      case 'uniform':
        fetchHistoryData('childuniform', 'childuniform', setHistoryUniformData, setHistoryUniformLoading, historyUniformDateRange)
        break
      case 'leaving':
        fetchHistoryData('childleaving', 'childleaving', setHistoryLeavingData, setHistoryLeavingLoading, historyLeavingDateRange)
        break
      case 'vocational':
        fetchHistoryData('vocational_training_approvals', 'vocational_course', setHistoryVocationalData, setHistoryVocationalLoading, historyVocationalDateRange, 'vocational_training_approvals')
        break
      case 'computer':
        fetchHistoryData('vocational_training_approvals', 'computer_course', setHistoryComputerData, setHistoryComputerLoading, historyComputerDateRange, 'vocational_training_approvals')
        break
    }
  }

  useEffect(() => {
    if (isAuthorized && activeHistorySubTab) {
      handleHistorySubTabChange(activeHistorySubTab)
    }
  }, [isAuthorized, activeHistorySubTab])

  const handleHistoryDateRangeChange = (
    subTab: HistorySubTabType,
    type: 'start' | 'end',
    value: string
  ) => {
    switch (subTab) {
      case 'child':
        setHistoryChildDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'family':
        setHistoryFamilyDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'sibling':
        setHistorySiblingDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'uniform':
        setHistoryUniformDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'leaving':
        setHistoryLeavingDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'vocational':
        setHistoryVocationalDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'computer':
        setHistoryComputerDateRange(prev => ({ ...prev, [type]: value }))
        break
    }
  }

  useEffect(() => {
    if (!isAuthorized) return

    // Re-fetch data when date range changes
    switch (activeHistorySubTab) {
      case 'child':
        fetchHistoryData('Child_Data', 'Child_Data', setHistoryChildData, setHistoryChildLoading, historyChildDateRange)
        break
      case 'family':
        fetchHistoryData('childfmly', 'childfmly', setHistoryFamilyData, setHistoryFamilyLoading, historyFamilyDateRange)
        break
      case 'sibling':
        fetchHistoryData('childsibling', 'childsibling', setHistorySiblingData, setHistorySiblingLoading, historySiblingDateRange)
        break
      case 'uniform':
        fetchHistoryData('childuniform', 'childuniform', setHistoryUniformData, setHistoryUniformLoading, historyUniformDateRange)
        break
      case 'leaving':
        fetchHistoryData('childleaving', 'childleaving', setHistoryLeavingData, setHistoryLeavingLoading, historyLeavingDateRange)
        break
      case 'vocational':
        fetchHistoryData('vocational_course', 'vocational_course', setHistoryVocationalData, setHistoryVocationalLoading, historyVocationalDateRange, 'vocational_training_approvals')
        break
      case 'computer':
        fetchHistoryData('computer_course', 'computer_course', setHistoryComputerData, setHistoryComputerLoading, historyComputerDateRange, 'vocational_training_approvals')
        break
    }
  }, [historyChildDateRange, historyFamilyDateRange, historySiblingDateRange, historyUniformDateRange, historyVocationalDateRange, historyComputerDateRange, historyLeavingDateRange, isAuthorized, activeHistorySubTab])

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

  const roleInfo = ROLE_CONFIG.find(r => r.value === 'field_volunteer')!

  return (
    <main className="min-h-screen bg-slate-50/50">
      <Navbar
        username={profile.username}
        role="field_volunteer"
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color} />
      <Sidebar role="field_volunteer" />
      <PageContainer>
        <div className="py-8">
          <div className="space-y-8">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Personal History</h2>
              <p className="text-sm text-slate-600 mb-6">Track all updates and changes to child records.</p>

              {/* History Subtabs */}
              <div className="mb-6">
                <div className="flex gap-2 flex-wrap border-b border-slate-200">
                  {(['child', 'family', 'sibling', 'uniform', 'leaving', 'vocational', 'computer'] as HistorySubTabType[]).map((subTab) => (
                    <button
                      key={subTab}
                      onClick={() => handleHistorySubTabChange(subTab)}
                      className={`px-4 py-2 font-medium text-sm transition-colors ${activeHistorySubTab === subTab
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      {subTab === 'child' && 'Child Data'}
                      {subTab === 'family' && 'Child Family'}
                      {subTab === 'sibling' && 'Child Sibling'}
                      {subTab === 'uniform' && 'Child Uniform'}
                      {subTab === 'leaving' && 'Child Leaving'}
                      {subTab === 'vocational' && 'Vocational'}
                      {subTab === 'computer' && 'Computer'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="mb-6 flex gap-4 items-end">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">From Date</label>
                  <input
                    type="date"
                    value={
                      activeHistorySubTab === 'child' ? historyChildDateRange.start :
                        activeHistorySubTab === 'family' ? historyFamilyDateRange.start :
                          activeHistorySubTab === 'sibling' ? historySiblingDateRange.start :
                            activeHistorySubTab === 'uniform' ? historyUniformDateRange.start :
                              activeHistorySubTab === 'leaving' ? historyLeavingDateRange.start :
                                activeHistorySubTab === 'vocational' ? historyVocationalDateRange.start :
                                  historyComputerDateRange.start
                    }
                    onChange={(e) => handleHistoryDateRangeChange(activeHistorySubTab, 'start', e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">To Date</label>
                  <input
                    type="date"
                    value={
                      activeHistorySubTab === 'child' ? historyChildDateRange.end :
                        activeHistorySubTab === 'family' ? historyFamilyDateRange.end :
                          activeHistorySubTab === 'sibling' ? historySiblingDateRange.end :
                            activeHistorySubTab === 'uniform' ? historyUniformDateRange.end :
                              activeHistorySubTab === 'leaving' ? historyLeavingDateRange.end :
                                activeHistorySubTab === 'vocational' ? historyVocationalDateRange.end :
                                  historyComputerDateRange.end
                    }
                    onChange={(e) => handleHistoryDateRangeChange(activeHistorySubTab, 'end', e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* History Tables */}
              <div className="rounded border border-slate-100 bg-white overflow-hidden">
                {/* Child Data Table */}
                {activeHistorySubTab === 'child' && (
                  <div>
                    {historyChildLoading ? (
                      <div className="p-4 text-sm text-slate-600">Loading data…</div>
                    ) : historyChildData.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">No child data history found.</div>
                    ) : (
                      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                        <table className="min-w-full table-auto text-sm">
                          <thead className="sticky top-0">
                            <tr className="bg-slate-50 text-left text-slate-700">
                              <th className="px-4 py-3 whitespace-nowrap">Record ID</th>
                              <th className="px-4 py-3 whitespace-nowrap">EAC No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Reg No</th>
                              <th className="px-4 py-3 whitespace-nowrap">First Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Last Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Gender</th>
                              <th className="px-4 py-3 whitespace-nowrap">Aadhar No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Birth Place</th>
                              <th className="px-4 py-3 whitespace-nowrap">Height</th>
                              <th className="px-4 py-3 whitespace-nowrap">Weight</th>
                              <th className="px-4 py-3 whitespace-nowrap">Blood Group</th>
                              <th className="px-4 py-3 whitespace-nowrap">Health</th>
                              <th className="px-4 py-3 whitespace-nowrap">Caste</th>
                              <th className="px-4 py-3 whitespace-nowrap">Mother Tongue</th>
                              <th className="px-4 py-3 whitespace-nowrap">Class</th>
                              <th className="px-4 py-3 whitespace-nowrap">School Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">School Category</th>
                              <th className="px-4 py-3 whitespace-nowrap">Life Ambition</th>
                              <th className="px-4 py-3 whitespace-nowrap">Fav Subject</th>
                              <th className="px-4 py-3 whitespace-nowrap">Created At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyChildData.map((row) => (
                              <tr key={row.record_id} className="border-t border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-700">{row.record_id}</td>
                                <td className="px-4 py-3 text-slate-700">{row.eac_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.reg_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.first_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.last_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.gender}</td>
                                <td className="px-4 py-3 text-slate-700">{row.aadhar_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.birth_place}</td>
                                <td className="px-4 py-3 text-slate-700">{row.height}</td>
                                <td className="px-4 py-3 text-slate-700">{row.weight}</td>
                                <td className="px-4 py-3 text-slate-700">{row.blood_group}</td>
                                <td className="px-4 py-3 text-slate-700">{row.health}</td>
                                <td className="px-4 py-3 text-slate-700">{row.caste}</td>
                                <td className="px-4 py-3 text-slate-700">{row.mother_tongue}</td>
                                <td className="px-4 py-3 text-slate-700">{row.class_std_text}</td>
                                <td className="px-4 py-3 text-slate-700">{row.school_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.school_category}</td>
                                <td className="px-4 py-3 text-slate-700">{row.life_ambition}</td>
                                <td className="px-4 py-3 text-slate-700">{row.fav_subject}</td>
                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Child Family Table */}
                {activeHistorySubTab === 'family' && (
                  <div>
                    {historyFamilyLoading ? (
                      <div className="p-4 text-sm text-slate-600">Loading data…</div>
                    ) : historyFamilyData.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">No family data history found.</div>
                    ) : (
                      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                        <table className="min-w-full table-auto text-sm">
                          <thead className="sticky top-0">
                            <tr className="bg-slate-50 text-left text-slate-700">
                              <th className="px-4 py-3 whitespace-nowrap">Record ID</th>
                              <th className="px-4 py-3 whitespace-nowrap">EAC No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Reg No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Father's Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Father's Occupation</th>
                              <th className="px-4 py-3 whitespace-nowrap">Father's Income</th>
                              <th className="px-4 py-3 whitespace-nowrap">Father's Aadhar</th>
                              <th className="px-4 py-3 whitespace-nowrap">Father's Mobile</th>
                              <th className="px-4 py-3 whitespace-nowrap">Mother's Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Mother's Occupation</th>
                              <th className="px-4 py-3 whitespace-nowrap">Mother's Income</th>
                              <th className="px-4 py-3 whitespace-nowrap">Mother's Aadhar</th>
                              <th className="px-4 py-3 whitespace-nowrap">Mother's Mobile</th>
                              <th className="px-4 py-3 whitespace-nowrap">Address 1</th>
                              <th className="px-4 py-3 whitespace-nowrap">Address 2</th>
                              <th className="px-4 py-3 whitespace-nowrap">Address 3</th>
                              <th className="px-4 py-3 whitespace-nowrap">Pincode</th>
                              <th className="px-4 py-3 whitespace-nowrap">Remarks</th>
                              <th className="px-4 py-3 whitespace-nowrap">Created At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyFamilyData.map((row) => (
                              <tr key={row.record_id} className="border-t border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-700">{row.record_id}</td>
                                <td className="px-4 py-3 text-slate-700">{row.eac_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.reg_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.f_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.f_occup}</td>
                                <td className="px-4 py-3 text-slate-700">{row.f_inc ?? row.f_inc_int ?? ''}</td>
                                <td className="px-4 py-3 text-slate-700">{row.f_aadhar}</td>
                                <td className="px-4 py-3 text-slate-700">{row.f_mobile}</td>
                                <td className="px-4 py-3 text-slate-700">{row.m_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.m_occup}</td>
                                <td className="px-4 py-3 text-slate-700">{row.m_inc ?? row.m_inc_int ?? ''}</td>
                                <td className="px-4 py-3 text-slate-700">{row.m_aadhar}</td>
                                <td className="px-4 py-3 text-slate-700">{row.m_mobile}</td>
                                <td className="px-4 py-3 text-slate-700">{row.fmly_addr1}</td>
                                <td className="px-4 py-3 text-slate-700">{row.fmly_addr2}</td>
                                <td className="px-4 py-3 text-slate-700">{row.fmly_addr3}</td>
                                <td className="px-4 py-3 text-slate-700">{row.fmly_pincode}</td>
                                <td className="px-4 py-3 text-slate-700">{row.fmly_remarks}</td>
                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Child Sibling Table */}
                {activeHistorySubTab === 'sibling' && (
                  <div>
                    {historySiblingLoading ? (
                      <div className="p-4 text-sm text-slate-600">Loading data…</div>
                    ) : historySiblingData.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">No sibling data history found.</div>
                    ) : (
                      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                        <table className="min-w-full table-auto text-sm">
                          <thead className="sticky top-0">
                            <tr className="bg-slate-50 text-left text-slate-700">
                              <th className="px-4 py-3 whitespace-nowrap">Record ID</th>
                              <th className="px-4 py-3 whitespace-nowrap">EAC No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Reg No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 1 Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 1 Age</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 1 Gender</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 1 Class/Occup</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 2 Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 2 Age</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 2 Gender</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 2 Class/Occup</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 3 Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 3 Age</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 3 Gender</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 3 Class/Occup</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 4 Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 4 Age</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 4 Gender</th>
                              <th className="px-4 py-3 whitespace-nowrap">Sibling 4 Class/Occup</th>
                              <th className="px-4 py-3 whitespace-nowrap">Remarks</th>
                              <th className="px-4 py-3 whitespace-nowrap">Created At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historySiblingData.map((row) => (
                              <tr key={row.record_id} className="border-t border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-700">{row.record_id}</td>
                                <td className="px-4 py-3 text-slate-700">{row.eac_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.reg_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.names_1}</td>
                                <td className="px-4 py-3 text-slate-700">{row.ages_1}</td>
                                <td className="px-4 py-3 text-slate-700">{row.genders_1}</td>
                                <td className="px-4 py-3 text-slate-700">{row.class_occup_1}</td>
                                <td className="px-4 py-3 text-slate-700">{row.names_2}</td>
                                <td className="px-4 py-3 text-slate-700">{row.ages_2}</td>
                                <td className="px-4 py-3 text-slate-700">{row.genders_2}</td>
                                <td className="px-4 py-3 text-slate-700">{row.class_occup_2}</td>
                                <td className="px-4 py-3 text-slate-700">{row.names_3}</td>
                                <td className="px-4 py-3 text-slate-700">{row.ages_3}</td>
                                <td className="px-4 py-3 text-slate-700">{row.genders_3}</td>
                                <td className="px-4 py-3 text-slate-700">{row.class_occup_3}</td>
                                <td className="px-4 py-3 text-slate-700">{row.names_4}</td>
                                <td className="px-4 py-3 text-slate-700">{row.ages_4}</td>
                                <td className="px-4 py-3 text-slate-700">{row.genders_4}</td>
                                <td className="px-4 py-3 text-slate-700">{row.class_occup_4}</td>
                                <td className="px-4 py-3 text-slate-700">{row.sibling_remarks}</td>
                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Child Uniform Table */}
                {activeHistorySubTab === 'uniform' && (
                  <div>
                    {historyUniformLoading ? (
                      <div className="p-4 text-sm text-slate-600">Loading data…</div>
                    ) : historyUniformData.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">No uniform data history found.</div>
                    ) : (
                      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                        <table className="min-w-full table-auto text-sm">
                          <thead className="sticky top-0">
                            <tr className="bg-slate-50 text-left text-slate-700">
                              <th className="px-4 py-3 whitespace-nowrap">Record ID</th>
                              <th className="px-4 py-3 whitespace-nowrap">EAC No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Reg No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Shirt Size</th>
                              <th className="px-4 py-3 whitespace-nowrap">Knicker Size</th>
                              <th className="px-4 py-3 whitespace-nowrap">Pant/Skirt Size</th>
                              <th className="px-4 py-3 whitespace-nowrap">Chudidhar Size</th>
                              <th className="px-4 py-3 whitespace-nowrap">Top/Pant Size</th>
                              <th className="px-4 py-3 whitespace-nowrap">Footwear Size</th>
                              <th className="px-4 py-3 whitespace-nowrap">Uniform Updated</th>
                              <th className="px-4 py-3 whitespace-nowrap">Created At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyUniformData.map((row) => (
                              <tr key={row.record_id} className="border-t border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-700">{row.record_id}</td>
                                <td className="px-4 py-3 text-slate-700">{row.eac_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.reg_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.shirtsize}</td>
                                <td className="px-4 py-3 text-slate-700">{row.knickersize}</td>
                                <td className="px-4 py-3 text-slate-700">{row.pant_skirtsize}</td>
                                <td className="px-4 py-3 text-slate-700">{row.chudidharsize}</td>
                                <td className="px-4 py-3 text-slate-700">{row.top_pantsize}</td>
                                <td className="px-4 py-3 text-slate-700">{row.footwearsize}</td>
                                <td className="px-4 py-3 text-slate-700">{row.uniform_updated ? new Date(row.uniform_updated).toLocaleDateString() : ''}</td>
                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Child Leaving Table */}
                {activeHistorySubTab === 'leaving' && (
                  <div>
                    {historyLeavingLoading ? (
                      <div className="p-4 text-sm text-slate-600">Loading data…</div>
                    ) : historyLeavingData.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">No leaving data history found.</div>
                    ) : (
                      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                        <table className="min-w-full table-auto text-sm">
                          <thead className="sticky top-0">
                            <tr className="bg-slate-50 text-left text-slate-700">
                              <th className="px-4 py-3 whitespace-nowrap">Record ID</th>
                              <th className="px-4 py-3 whitespace-nowrap">EAC No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Reg No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Reason</th>
                              <th className="px-4 py-3 whitespace-nowrap">Leaving Class</th>
                              <th className="px-4 py-3 whitespace-nowrap">Leaving Date</th>
                              <th className="px-4 py-3 whitespace-nowrap">Address 1</th>
                              <th className="px-4 py-3 whitespace-nowrap">Address 2</th>
                              <th className="px-4 py-3 whitespace-nowrap">Address 3</th>
                              <th className="px-4 py-3 whitespace-nowrap">Pincode</th>
                              <th className="px-4 py-3 whitespace-nowrap">Remarks</th>
                              <th className="px-4 py-3 whitespace-nowrap">Created At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyLeavingData.map((row) => (
                              <tr key={row.record_id} className="border-t border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-700">{row.record_id}</td>
                                <td className="px-4 py-3 text-slate-700">{row.eac_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.reg_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.reason}</td>
                                <td className="px-4 py-3 text-slate-700">{row.leav_class}</td>
                                <td className="px-4 py-3 text-slate-700">{row.leav_date ? new Date(row.leav_date).toLocaleDateString() : ''}</td>
                                <td className="px-4 py-3 text-slate-700">{row.leav_addr1}</td>
                                <td className="px-4 py-3 text-slate-700">{row.leav_addr2}</td>
                                <td className="px-4 py-3 text-slate-700">{row.leav_addr3}</td>
                                <td className="px-4 py-3 text-slate-700">{row.leav_pincode}</td>
                                <td className="px-4 py-3 text-slate-700">{row.leav_remarks}</td>
                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Vocational Table */}
                {activeHistorySubTab === 'vocational' && (
                  <div>
                    {historyVocationalLoading ? (
                      <div className="p-4 text-sm text-slate-600">Loading data…</div>
                    ) : historyVocationalData.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">No vocational data history found.</div>
                    ) : (
                      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                        <table className="min-w-full table-auto text-sm">
                          <thead className="sticky top-0">
                            <tr className="bg-slate-50 text-left text-slate-700">
                              <th className="px-4 py-3 whitespace-nowrap">Record ID</th>
                              <th className="px-4 py-3 whitespace-nowrap">Trainee Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Batch No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Enrolled Course</th>
                              <th className="px-4 py-3 whitespace-nowrap">Date of Admission</th>
                              <th className="px-4 py-3 whitespace-nowrap">Gender</th>
                              <th className="px-4 py-3 whitespace-nowrap">Aadhar No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Date of Birth</th>
                              <th className="px-4 py-3 whitespace-nowrap">Blood Group</th>
                              <th className="px-4 py-3 whitespace-nowrap">Mother Tongue</th>
                              <th className="px-4 py-3 whitespace-nowrap">Marital Status</th>
                              <th className="px-4 py-3 whitespace-nowrap">Father/Husband Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Mother Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Present Status</th>
                              <th className="px-4 py-3 whitespace-nowrap">Created At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyVocationalData.map((row) => (
                              <tr key={row.record_id ?? row.id} className="border-t border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-700">{row.record_id ?? row.id}</td>
                                <td className="px-4 py-3 text-slate-700">{row.trainee_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.batch_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.enrolled_course}</td>
                                <td className="px-4 py-3 text-slate-700">{row.date_of_admission ? new Date(row.date_of_admission).toLocaleDateString() : ''}</td>
                                <td className="px-4 py-3 text-slate-700">{row.gender}</td>
                                <td className="px-4 py-3 text-slate-700">{row.aadhar_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString() : ''}</td>
                                <td className="px-4 py-3 text-slate-700">{row.blood_group}</td>
                                <td className="px-4 py-3 text-slate-700">{row.mother_tongue}</td>
                                <td className="px-4 py-3 text-slate-700">{row.marital_status}</td>
                                <td className="px-4 py-3 text-slate-700">{row.father_or_husband_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.mother_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.present_status}</td>
                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Computer Table */}
                {activeHistorySubTab === 'computer' && (
                  <div>
                    {historyComputerLoading ? (
                      <div className="p-4 text-sm text-slate-600">Loading data…</div>
                    ) : historyComputerData.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">No computer data history found.</div>
                    ) : (
                      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                        <table className="min-w-full table-auto text-sm">
                          <thead className="sticky top-0">
                            <tr className="bg-slate-50 text-left text-slate-700">
                              <th className="px-4 py-3 whitespace-nowrap">Record ID</th>
                              <th className="px-4 py-3 whitespace-nowrap">Child Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Batch No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Date of Admission</th>
                              <th className="px-4 py-3 whitespace-nowrap">Reg No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Gender</th>
                              <th className="px-4 py-3 whitespace-nowrap">Aadhar No</th>
                              <th className="px-4 py-3 whitespace-nowrap">Date of Birth</th>
                              <th className="px-4 py-3 whitespace-nowrap">Class Standard</th>
                              <th className="px-4 py-3 whitespace-nowrap">School Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Course Name</th>
                              <th className="px-4 py-3 whitespace-nowrap">Completion Date</th>
                              <th className="px-4 py-3 whitespace-nowrap">Attendance %</th>
                              <th className="px-4 py-3 whitespace-nowrap">Final Score</th>
                              <th className="px-4 py-3 whitespace-nowrap">Certificate Issued</th>
                              <th className="px-4 py-3 whitespace-nowrap">Created At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyComputerData.map((row) => (
                              <tr key={row.record_id ?? row.id} className="border-t border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-700">{row.record_id ?? row.id}</td>
                                <td className="px-4 py-3 text-slate-700">{row.child_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.batch_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.date_of_admission ? new Date(row.date_of_admission).toLocaleDateString() : ''}</td>
                                <td className="px-4 py-3 text-slate-700">{row.reg_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.gender}</td>
                                <td className="px-4 py-3 text-slate-700">{row.aadhar_no}</td>
                                <td className="px-4 py-3 text-slate-700">{row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString() : ''}</td>
                                <td className="px-4 py-3 text-slate-700">{row.class_standard}</td>
                                <td className="px-4 py-3 text-slate-700">{row.school_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.course_name}</td>
                                <td className="px-4 py-3 text-slate-700">{row.completion_date ? new Date(row.completion_date).toLocaleDateString() : ''}</td>
                                <td className="px-4 py-3 text-slate-700">{row.attendance_percentage}</td>
                                <td className="px-4 py-3 text-slate-700">{row.final_assessment_score}</td>
                                <td className="px-4 py-3 text-slate-700">{row.certificate_issued_on ? new Date(row.certificate_issued_on).toLocaleDateString() : ''}</td>
                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}