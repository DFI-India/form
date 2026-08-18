'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { getStandardColumnLabel } from '../../../lib/columnLabels'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { LoadingSpinner } from '../../components/UI'
import { ROLE_CONFIG } from '../../../lib/types'
import { useRequireRole } from '../../../lib/hooks'
import { getErrorMessage } from '../../../lib/errors'

type HistorySubTabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving' | 'vocational' | 'computer'
type MessageState = { type: 'success' | 'error'; text: string } | null

const HISTORY_HIDDEN_COLUMNS = ['status', 'submitted_by', 'verified_by', 'verified_at']

export default function FieldStaffHistoryPage() {
    const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_field_staff'])
    const [message, setMessage] = useState<MessageState>(null)
    const [userEacNos, setUserEacNos] = useState<number[]>([])
    const [activeHistorySubTab, setActiveHistorySubTab] = useState<HistorySubTabType>('child')

    const [historyChildData, setHistoryChildData] = useState<Record<string, unknown>[]>([])
    const [historyFamilyData, setHistoryFamilyData] = useState<Record<string, unknown>[]>([])
    const [historySiblingData, setHistorySiblingData] = useState<Record<string, unknown>[]>([])
    const [historyUniformData, setHistoryUniformData] = useState<Record<string, unknown>[]>([])
    const [historyLeavingData, setHistoryLeavingData] = useState<Record<string, unknown>[]>([])
    const [historyVocationalData, setHistoryVocationalData] = useState<Record<string, unknown>[]>([])
    const [historyComputerData, setHistoryComputerData] = useState<Record<string, unknown>[]>([])

    const [historyChildDateRange, setHistoryChildDateRange] = useState({ start: '', end: '' })
    const [historyFamilyDateRange, setHistoryFamilyDateRange] = useState({ start: '', end: '' })
    const [historySiblingDateRange, setHistorySiblingDateRange] = useState({ start: '', end: '' })
    const [historyUniformDateRange, setHistoryUniformDateRange] = useState({ start: '', end: '' })
    const [historyLeavingDateRange, setHistoryLeavingDateRange] = useState({ start: '', end: '' })
    const [historyVocationalDateRange, setHistoryVocationalDateRange] = useState({ start: '', end: '' })
    const [historyComputerDateRange, setHistoryComputerDateRange] = useState({ start: '', end: '' })

    const [historyChildLoading, setHistoryChildLoading] = useState(false)
    const [historyFamilyLoading, setHistoryFamilyLoading] = useState(false)
    const [historySiblingLoading, setHistorySiblingLoading] = useState(false)
    const [historyUniformLoading, setHistoryUniformLoading] = useState(false)
    const [historyLeavingLoading, setHistoryLeavingLoading] = useState(false)
    const [historyVocationalLoading, setHistoryVocationalLoading] = useState(false)
    const [historyComputerLoading, setHistoryComputerLoading] = useState(false)

    const historySubTabs: { id: HistorySubTabType; label: string }[] = [
        { id: 'child', label: 'Child Data' },
        { id: 'family', label: 'Child Family' },
        { id: 'sibling', label: 'Child Siblings' },
        { id: 'uniform', label: 'Child Uniform' },
        { id: 'leaving', label: 'Child Leaving' },
        { id: 'vocational', label: 'Vocational Course' },
        { id: 'computer', label: 'Computer Course' },
    ]

    useEffect(() => {
        const loadAssignedEacs = async () => {
            if (!isAuthorized || !profile) return

            const { data: user } = await supabase.auth.getUser()
            if (!user.user?.id) {
                setUserEacNos([])
                return
            }

            const { data: eacs, error } = await supabase
                .from('dfi_field_staff_assigned_eacs')
                .select('assigned_eac')
                .eq('id', user.user.id)

            if (error) {
                setMessage({ type: 'error', text: `Unable to load assigned EAC numbers: ${error.message}` })
                setUserEacNos([])
                return
            }

            const assignedEacNos = (eacs || [])
                .map((row) => Number((row as { assigned_eac: unknown }).assigned_eac))
                .filter((value) => !Number.isNaN(value))

            setUserEacNos(assignedEacNos)
        }

        loadAssignedEacs()
    }, [isAuthorized, profile])

    useEffect(() => {
        if (!isAuthorized || !profile || userEacNos.length === 0) return
        handleHistorySubTabChange(activeHistorySubTab)
    }, [isAuthorized, profile, userEacNos])

    useEffect(() => {
        if (!isAuthorized || !profile || userEacNos.length === 0) return

        switch (activeHistorySubTab) {
            case 'child':
                fetchHistoryData('Child_Data', setHistoryChildData, setHistoryChildLoading, historyChildDateRange)
                break
            case 'family':
                fetchHistoryData('childfmly', setHistoryFamilyData, setHistoryFamilyLoading, historyFamilyDateRange)
                break
            case 'sibling':
                fetchHistoryData('childsibling', setHistorySiblingData, setHistorySiblingLoading, historySiblingDateRange)
                break
            case 'uniform':
                fetchHistoryData('childuniform', setHistoryUniformData, setHistoryUniformLoading, historyUniformDateRange)
                break
            case 'leaving':
                fetchHistoryData('childleaving', setHistoryLeavingData, setHistoryLeavingLoading, historyLeavingDateRange)
                break
            case 'vocational':
                fetchHistoryData('vocational_course', setHistoryVocationalData, setHistoryVocationalLoading, historyVocationalDateRange)
                break
            case 'computer':
                fetchHistoryData('computer_course', setHistoryComputerData, setHistoryComputerLoading, historyComputerDateRange)
                break
        }
    }, [
        historyChildDateRange,
        historyFamilyDateRange,
        historySiblingDateRange,
        historyUniformDateRange,
        historyLeavingDateRange,
        historyVocationalDateRange,
        historyComputerDateRange,
    ])

    const fetchHistoryData = async (
        tableName: string,
        setData: (data: Record<string, unknown>[]) => void,
        setLoading: (loading: boolean) => void,
        dateRange: { start: string; end: string }
    ) => {
        setLoading(true)
        try {
            const user = (await supabase.auth.getUser()).data.user
            if (!user?.id || userEacNos.length === 0) {
                throw new Error('User information not found.')
            }

            let query = supabase
                .from(tableName)
                .select('*')
                .eq('verified_by', user.id)
                .eq('status', 'Verified')
                .in('eac_no', userEacNos)

            if (dateRange.start) {
                query = query.gte('verified_at', dateRange.start)
            }
            if (dateRange.end) {
                const endDate = new Date(dateRange.end)
                endDate.setDate(endDate.getDate() + 1)
                query = query.lt('verified_at', endDate.toISOString())
            }

            const { data, error } = await query
            if (error) throw error

            setData(data || [])
        } catch (error: unknown) {
            const fallback = getErrorMessage(error, 'Failed to fetch data')
            setMessage({ type: 'error', text: `Unable to load history data: ${fallback}` })
            setData([])
        } finally {
            setLoading(false)
        }
    }

    const handleHistorySubTabChange = (subTab: HistorySubTabType) => {
        setActiveHistorySubTab(subTab)

        switch (subTab) {
            case 'child':
                fetchHistoryData('Child_Data', setHistoryChildData, setHistoryChildLoading, historyChildDateRange)
                break
            case 'family':
                fetchHistoryData('childfmly', setHistoryFamilyData, setHistoryFamilyLoading, historyFamilyDateRange)
                break
            case 'sibling':
                fetchHistoryData('childsibling', setHistorySiblingData, setHistorySiblingLoading, historySiblingDateRange)
                break
            case 'uniform':
                fetchHistoryData('childuniform', setHistoryUniformData, setHistoryUniformLoading, historyUniformDateRange)
                break
            case 'leaving':
                fetchHistoryData('childleaving', setHistoryLeavingData, setHistoryLeavingLoading, historyLeavingDateRange)
                break
            case 'vocational':
                fetchHistoryData('vocational_course', setHistoryVocationalData, setHistoryVocationalLoading, historyVocationalDateRange)
                break
            case 'computer':
                fetchHistoryData('computer_course', setHistoryComputerData, setHistoryComputerLoading, historyComputerDateRange)
                break
        }
    }

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

    const roleInfo = ROLE_CONFIG.find(r => r.value === 'dfi_field_staff')!

    const currentData = activeHistorySubTab === 'child' ? historyChildData :
        activeHistorySubTab === 'family' ? historyFamilyData :
            activeHistorySubTab === 'sibling' ? historySiblingData :
                activeHistorySubTab === 'uniform' ? historyUniformData :
                    activeHistorySubTab === 'vocational' ? historyVocationalData :
                        activeHistorySubTab === 'computer' ? historyComputerData :
                            historyLeavingData

    const currentLoading = historyChildLoading || historyFamilyLoading || historySiblingLoading ||
        historyUniformLoading || historyLeavingLoading || historyVocationalLoading || historyComputerLoading

    return (
        <main className="min-h-screen bg-slate-50/50">
            <Navbar
                username={profile.username}
                role="dfi_field_staff"
                roleLabel={roleInfo.label}
                roleColor={roleInfo.color} />
            <Sidebar role="dfi_field_staff" />
            <PageContainer>
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Personal History</h1>
                    <p className="mt-1 text-sm text-slate-600">View all records you have verified.</p>
                </header>

                {message && (
                    <div
                        className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${message.type === 'success'
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                <div className="space-y-6">
                    <div className="border-b border-slate-200">
                        <div className="flex flex-wrap gap-2 sm:gap-0">
                            {historySubTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleHistorySubTabChange(tab.id)}
                                    className={`px-4 py-3 text-sm font-medium transition ${activeHistorySubTab === tab.id
                                        ? 'border-b-2 border-amber-600 text-amber-600'
                                        : 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Verified {historySubTabs.find((t) => t.id === activeHistorySubTab)?.label} Records
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                View all records you have verified.
                            </p>
                        </div>

                        <div className="mb-6 flex gap-4 items-end flex-col sm:flex-row">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">From Date (Verified)</label>
                                <input
                                    type="date"
                                    value={
                                        activeHistorySubTab === 'child' ? historyChildDateRange.start :
                                            activeHistorySubTab === 'family' ? historyFamilyDateRange.start :
                                                activeHistorySubTab === 'sibling' ? historySiblingDateRange.start :
                                                    activeHistorySubTab === 'uniform' ? historyUniformDateRange.start :
                                                        activeHistorySubTab === 'vocational' ? historyVocationalDateRange.start :
                                                            activeHistorySubTab === 'computer' ? historyComputerDateRange.start :
                                                                historyLeavingDateRange.start
                                    }
                                    onChange={(e) => handleHistoryDateRangeChange(activeHistorySubTab, 'start', e.target.value)}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">To Date (Verified)</label>
                                <input
                                    type="date"
                                    value={
                                        activeHistorySubTab === 'child' ? historyChildDateRange.end :
                                            activeHistorySubTab === 'family' ? historyFamilyDateRange.end :
                                                activeHistorySubTab === 'sibling' ? historySiblingDateRange.end :
                                                    activeHistorySubTab === 'uniform' ? historyUniformDateRange.end :
                                                        activeHistorySubTab === 'vocational' ? historyVocationalDateRange.end :
                                                            activeHistorySubTab === 'computer' ? historyComputerDateRange.end :
                                                                historyLeavingDateRange.end
                                    }
                                    onChange={(e) => handleHistoryDateRangeChange(activeHistorySubTab, 'end', e.target.value)}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        {currentLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-slate-500">Loading records...</p>
                            </div>
                        ) : currentData.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-slate-500">No verified records found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto overflow-y-auto max-h-96 border border-slate-200 rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            {Object.keys(currentData[0] || {})
                                                .filter((key) => !HISTORY_HIDDEN_COLUMNS.includes(key.toLowerCase()))
                                                .map((key) => (
                                                    <th
                                                        key={key}
                                                        className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap"
                                                        title={key}
                                                    >
                                                        {getStandardColumnLabel(key)}
                                                    </th>
                                                ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentData.map((record, idx) => (
                                            <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                                                {Object.entries(record)
                                                    .filter(([key]) => !HISTORY_HIDDEN_COLUMNS.includes(key.toLowerCase()))
                                                    .map(([key, value]) => {
                                                        const displayValue = value === null || value === undefined ? '-' : String(value)
                                                        const isPhoto = (key.toLowerCase().includes('photo') || key.toLowerCase().includes('image')) && value

                                                        return (
                                                            <td key={key} className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">
                                                                {isPhoto ? (
                                                                    <a
                                                                        href={String(value)}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                                                                    >
                                                                        View
                                                                    </a>
                                                                ) : (
                                                                    displayValue
                                                                )}
                                                            </td>
                                                        )
                                                    })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </PageContainer>
        </main>
    )
}