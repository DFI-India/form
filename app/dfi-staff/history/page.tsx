'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'

type EntityType =
    | 'child_data'
    | 'childfmly'
    | 'childsibling'
    | 'childuniform'
    | 'childleaving'
    | 'vocational_course'
    | 'computer_course'

type DateField = 'all' | 'approved_at' | 'verified_at'

type ActivityRecord = Record<string, any>

const TABS: { key: EntityType; label: string }[] = [
    { key: 'child_data', label: 'Child Data' },
    { key: 'childfmly', label: 'Child Family' },
    { key: 'childsibling', label: 'Child Sibling' },
    { key: 'childuniform', label: 'Child Uniform' },
    { key: 'childleaving', label: 'Child Leaving' },
    { key: 'vocational_course', label: 'Vocational Courses' },
    { key: 'computer_course', label: 'Computer Courses' }
]

const TAB_TABLES: Record<EntityType, string[]> = {
    child_data: ['Child_Data'],
    childfmly: ['childfmly'],
    childsibling: ['childsibling'],
    childuniform: ['childuniform'],
    childleaving: ['childleaving'],
    vocational_course: ['vocational_courses', 'vocational_course'],
    computer_course: ['computer_courses', 'computer_course']
}

const HIDDEN_META_COLUMNS = new Set([
    'status',
    'created_at',
    'updated_at',
    'approved_by',
    'verified_by',
    'decided_by',
    'decided_at',
    'submitted_by',
    'rejection_reason',
    '_decision_status',
    '_entity_id'
])

const toTitle = (value: string) =>
    value
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

const formatDateTime = (value: any) => {
    if (!value) return '-'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return String(value)
    return parsed.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

const renderCellValue = (key: string, value: any) => {
    if (value === null || value === undefined || value === '') return '-'

    if (key === 'approved_at' || key === 'verified_at') {
        return formatDateTime(value)
    }

    if (typeof value === 'boolean') return value ? 'Yes' : 'No'

    const asString = typeof value === 'string' ? value : JSON.stringify(value)
    const lowerKey = key.toLowerCase()
    const isLink = /^https?:\/\//i.test(asString)
    const isImageLink =
        isLink &&
        (lowerKey.includes('photo') ||
            lowerKey.includes('image') ||
            /\.(jpg|jpeg|png|webp|gif)$/i.test(asString))

    if (isLink) {
        return (
            <a
                href={asString}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
            >
                {isImageLink ? 'View' : asString}
            </a>
        )
    }

    return asString
}

export default function DFIStaffPersonalActivityPage() {
    const router = useRouter()
    const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_staff'])

    const [activeTab, setActiveTab] = useState<EntityType>('child_data')
    const [recordsByTab, setRecordsByTab] = useState<Record<EntityType, ActivityRecord[]>>({
        child_data: [],
        childfmly: [],
        childsibling: [],
        childuniform: [],
        childleaving: [],
        vocational_course: [],
        computer_course: []
    })
    const [counts, setCounts] = useState<Record<EntityType, { total: number; approved: number; rejected: number }>>({
        child_data: { total: 0, approved: 0, rejected: 0 },
        childfmly: { total: 0, approved: 0, rejected: 0 },
        childsibling: { total: 0, approved: 0, rejected: 0 },
        childuniform: { total: 0, approved: 0, rejected: 0 },
        childleaving: { total: 0, approved: 0, rejected: 0 },
        vocational_course: { total: 0, approved: 0, rejected: 0 },
        computer_course: { total: 0, approved: 0, rejected: 0 }
    })

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [dateField, setDateField] = useState<DateField>('all')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')

    const matchesDateFilter = (row: ActivityRecord) => {
        if (!fromDate && !toDate) return true

        const approvedAt = row.approved_at ? new Date(row.approved_at) : null
        const verifiedAt = row.verified_at ? new Date(row.verified_at) : null
        const from = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null
        const to = toDate ? new Date(`${toDate}T23:59:59.999Z`) : null

        const inRange = (date: Date | null) => {
            if (!date) return false
            if (from && date < from) return false
            if (to && date > to) return false
            return true
        }

        if (dateField === 'approved_at') return inRange(approvedAt)
        if (dateField === 'verified_at') return inRange(verifiedAt)
        return inRange(approvedAt) || inRange(verifiedAt)
    }

    const fetchFromFirstAvailableTable = async (tableNames: string[], userId: string) => {
        for (const tableName of tableNames) {
            // Try to fetch records where user is approved_by or verified_by
            let query = supabase
                .from(tableName)
                .select('*')

            // Build OR condition to check if user acted on the record
            const { data: allData, error: allError } = await query

            if (!allError && allData) {
                // Filter records where user is approved_by or verified_by, and status is Approved or Rejected
                const filtered = allData.filter((record: any) => {
                    const isActedByUser = record.approved_by === userId || record.verified_by === userId
                    const status = String(record.status || '').toLowerCase()
                    const isRelevantStatus = status === 'approved' || status === 'rejected'
                    return isActedByUser && isRelevantStatus
                })
                return filtered
            }
        }

        return []
    }

    const loadRecords = async () => {
        setLoading(true)
        setError('')

        try {
            const { data: userData } = await supabase.auth.getUser()
            const userId = userData.user?.id
            if (!userId) {
                throw new Error('Not signed in')
            }

            const tabDataEntries = await Promise.all(
                TABS.map(async (tab) => {
                    const rawData = await fetchFromFirstAvailableTable(TAB_TABLES[tab.key], userId)
                    const filteredData = rawData.filter(matchesDateFilter)

                    filteredData.sort((a, b) => {
                        const first = new Date(a.approved_at || a.verified_at || 0).getTime()
                        const second = new Date(b.approved_at || b.verified_at || 0).getTime()
                        return second - first
                    })

                    return [tab.key, filteredData] as const
                })
            )

            const nextRecords = {
                child_data: [],
                childfmly: [],
                childsibling: [],
                childuniform: [],
                childleaving: [],
                vocational_course: [],
                computer_course: []
            } as Record<EntityType, ActivityRecord[]>

            const nextCounts = {
                child_data: { total: 0, approved: 0, rejected: 0 },
                childfmly: { total: 0, approved: 0, rejected: 0 },
                childsibling: { total: 0, approved: 0, rejected: 0 },
                childuniform: { total: 0, approved: 0, rejected: 0 },
                childleaving: { total: 0, approved: 0, rejected: 0 },
                vocational_course: { total: 0, approved: 0, rejected: 0 },
                computer_course: { total: 0, approved: 0, rejected: 0 }
            } as Record<EntityType, { total: number; approved: number; rejected: number }>

            for (const [key, records] of tabDataEntries) {
                nextRecords[key] = records
                const approvedCount = records.filter((record) => {
                    const status = String(record.status || '').toLowerCase()
                    return status === 'approved'
                }).length
                const rejectedCount = records.filter((record) => {
                    const status = String(record.status || '').toLowerCase()
                    return status === 'rejected'
                }).length
                nextCounts[key] = {
                    total: records.length,
                    approved: approvedCount,
                    rejected: rejectedCount
                }
            }

            setRecordsByTab(nextRecords)
            setCounts(nextCounts)
        } catch (err: any) {
            setError(err.message || 'Failed to load personal activity')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthorized) {
            loadRecords()
        }
    }, [isAuthorized, dateField, fromDate, toDate])

    const currentRecords = recordsByTab[activeTab] || []

    const visibleColumns = useMemo(() => {
        if (currentRecords.length === 0) return []

        const allColumns = Array.from(
            new Set(currentRecords.flatMap((row) => Object.keys(row)))
        )

        const filtered = allColumns.filter((col) => {
            const normalized = col.toLowerCase()
            if (normalized === 'approved_at' || normalized === 'verified_at') return true
            return !HIDDEN_META_COLUMNS.has(normalized)
        })

        filtered.sort((a, b) => {
            if (a === 'approved_at') return 1
            if (b === 'approved_at') return -1
            if (a === 'verified_at') return 1
            if (b === 'verified_at') return -1
            return a.localeCompare(b)
        })

        return filtered
    }, [currentRecords])

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

    const roleInfo = ROLE_CONFIG.find((r) => r.value === 'dfi_staff')!
    const totalRecords = Object.values(counts).reduce((sum, item) => sum + (item?.total || 0), 0)
    const totalApproved = Object.values(counts).reduce((sum, item) => sum + (item?.approved || 0), 0)
    const totalRejected = Object.values(counts).reduce((sum, item) => sum + (item?.rejected || 0), 0)

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
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900">Personal Activity</h2>
                            <p className="text-slate-600 mt-2">
                                Approved and rejected records acted on by you
                                <span className="ml-2 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                                    {totalRecords} total
                                </span>
                                <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                    {totalApproved} approved
                                </span>
                                <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                                    {totalRejected} rejected
                                </span>
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/dfi-staff')}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            ← Dashboard
                        </button>
                    </div>

                    {error && <Alert type="error" message={error} className="mb-6" />}

                    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
                        <div className="flex flex-wrap items-end gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Filter By Date Field</label>
                                <select
                                    value={dateField}
                                    onChange={(e) => setDateField(e.target.value as DateField)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="all">Approved At or Verified At</option>
                                    <option value="approved_at">Approved At</option>
                                    <option value="verified_at">Verified At</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    setDateField('all')
                                    setFromDate('')
                                    setToDate('')
                                }}
                                className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 mb-6">
                        <div className="flex overflow-x-auto">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex-1 min-w-[160px] px-4 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.key
                                            ? 'border-purple-600 text-purple-600 bg-purple-50'
                                            : 'border-transparent text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {tab.label}
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                                        {counts[tab.key]?.total || 0}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center">
                                <LoadingSpinner size="lg" />
                                <p className="mt-4 text-slate-600">Loading your activity...</p>
                            </div>
                        ) : currentRecords.length === 0 ? (
                            <div className="p-12 text-center">
                                <p className="text-slate-600 font-medium">No records found for this tab and date filter.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                                        <tr>
                                            {visibleColumns.map((column) => (
                                                <th
                                                    key={column}
                                                    className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap"
                                                >
                                                    {toTitle(column)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentRecords.map((row, index) => (
                                            <tr key={String(row.record_id || row.id || index)} className="border-b border-slate-200 hover:bg-slate-50">
                                                {visibleColumns.map((column) => (
                                                    <td key={`${String(row.record_id || row.id || index)}-${column}`} className="px-4 py-3 text-slate-700 whitespace-nowrap align-top">
                                                        {renderCellValue(column, row[column])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </PageContainer>
        </main>
    )
}
