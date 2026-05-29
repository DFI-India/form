'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { getStandardColumnLabel } from '../../../lib/columnLabels'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { LoadingSpinner } from '../../components/UI'
import { ROLE_CONFIG } from '../../../lib/types'
import { useRequireRole } from '../../../lib/hooks'
import { X } from 'lucide-react'

type ViewSubTabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving'
type SearchByType = 'name' | 'reg_no'
type ChildStatusFilter = 'all' | 'enrolled' | 'left'
type MessageState = { type: 'success' | 'error'; text: string } | null

const VIEW_HIDDEN_COLUMNS = ['status', 'submitted_by', 'verified_by', 'verified_at', 'centre_id']

export default function FieldStaffViewDataPage() {

    const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_field_staff'])
    const [message, setMessage] = useState<MessageState>(null)
    const [viewSubTab, setViewSubTab] = useState<ViewSubTabType>('child')
    const [userEacNos, setUserEacNos] = useState<number[]>([])

    const [viewData, setViewData] = useState<Record<ViewSubTabType, Record<string, unknown>[]>>({
        child: [],
        family: [],
        sibling: [],
        uniform: [],
        leaving: [],
    })

    const [viewLoading, setViewLoading] = useState<Record<ViewSubTabType, boolean>>({
        child: false,
        family: false,
        sibling: false,
        uniform: false,
        leaving: false,
    })

    const [viewSearchQuery, setViewSearchQuery] = useState<Record<ViewSubTabType, string>>({
        child: '',
        family: '',
        sibling: '',
        uniform: '',
        leaving: '',
    })

    const [viewSearchType, setViewSearchType] = useState<Record<ViewSubTabType, SearchByType>>({
        child: 'name',
        family: 'reg_no',
        sibling: 'reg_no',
        uniform: 'reg_no',
        leaving: 'reg_no',
    })

    const [childStatusFilter, setChildStatusFilter] = useState<ChildStatusFilter>('all')

    const [viewPhotoModal, setViewPhotoModal] = useState<{ isOpen: boolean; url: string }>({
        isOpen: false,
        url: '',
    })

    const viewSubTabs: { id: ViewSubTabType; label: string }[] = [
        { id: 'child', label: 'Child Data' },
        { id: 'family', label: 'Child Family' },
        { id: 'sibling', label: 'Child Siblings' },
        { id: 'uniform', label: 'Child Uniform' },
        { id: 'leaving', label: 'Child Leaving' },
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
        fetchViewData(viewSubTab)
    }, [isAuthorized, profile, viewSubTab, userEacNos, viewSearchQuery, viewSearchType, childStatusFilter])

    const fetchViewData = async (tabType: ViewSubTabType) => {
        setViewLoading((prev) => ({ ...prev, [tabType]: true }))
        try {
            const tableMap: Record<ViewSubTabType, string> = {
                child: 'Child_Data',
                family: 'childfmly',
                sibling: 'childsibling',
                uniform: 'childuniform',
                leaving: 'childleaving',
            }

            const tableName = tableMap[tabType]
            const searchQuery = viewSearchQuery[tabType]
            const searchType = viewSearchType[tabType]

            let query = supabase
                .from(tableName)
                .select('*')
                .in('eac_no', userEacNos)
                .eq('status', 'Approved')
                .order('eac_no', { ascending: true })
                .order('reg_no', { ascending: true })

            if (tabType === 'child') {
                if (childStatusFilter === 'enrolled') {
                    query = query.eq('child_left', false)
                }

                if (childStatusFilter === 'left') {
                    query = query.eq('child_left', true)
                }
            }

            if (searchQuery.trim()) {
                if (searchType === 'name') {
                    if (tabType === 'child') {
                        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
                    } else {
                        query = query.ilike('f_name', `%${searchQuery}%`)
                    }
                }

                if (searchType === 'reg_no') {
                    const regNo = Number(searchQuery)
                    if (!Number.isNaN(regNo)) {
                        query = query.eq('reg_no', regNo)
                    }
                }
            }

            const { data, error } = await query
            if (error) throw error

            setViewData((prev) => ({
                ...prev,
                [tabType]: data || [],
            }))
        } catch (error: unknown) {
            const fallback = error instanceof Error ? error.message : 'Failed to fetch data'
            setMessage({ type: 'error', text: `Unable to load ${tabType} data: ${fallback}` })
        } finally {
            setViewLoading((prev) => ({ ...prev, [tabType]: false }))
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
                    <h1 className="text-2xl font-bold text-slate-900">View Data</h1>
                    <p className="mt-1 text-sm text-slate-600">View all approved records for your centre.</p>
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
                            {viewSubTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewSubTab(tab.id)}
                                    className={`px-4 py-3 text-sm font-medium transition ${viewSubTab === tab.id
                                        ? 'border-b-2 border-purple-600 text-purple-600'
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
                                View {viewSubTabs.find((t) => t.id === viewSubTab)?.label} Records
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                View all approved records for your centre.
                            </p>
                        </div>

                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Search Query
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter search term..."
                                    value={viewSearchQuery[viewSubTab]}
                                    onChange={(e) =>
                                        setViewSearchQuery((prev) => ({
                                            ...prev,
                                            [viewSubTab]: e.target.value,
                                        }))
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Search By
                                </label>
                                <select
                                    value={viewSearchType[viewSubTab]}
                                    onChange={(e) =>
                                        setViewSearchType((prev) => ({
                                            ...prev,
                                            [viewSubTab]: e.target.value as SearchByType,
                                        }))
                                    }
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                >
                                    {viewSubTab === 'child' ? (
                                        <>
                                            <option value="name">Name</option>
                                            <option value="reg_no">Registration No</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="reg_no">Registration No</option>
                                            <option value="name">Name</option>
                                        </>
                                    )}
                                </select>
                            </div>
                            {viewSubTab === 'child' && (
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                        Child Status
                                    </label>
                                    <select
                                        value={childStatusFilter}
                                        onChange={(e) => setChildStatusFilter(e.target.value as ChildStatusFilter)}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="all">All</option>
                                        <option value="enrolled">Enrolled</option>
                                        <option value="left">Left</option>
                                    </select>
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    setViewSearchQuery((prev) => ({
                                        ...prev,
                                        [viewSubTab]: '',
                                    }))
                                    if (viewSubTab === 'child') {
                                        setChildStatusFilter('all')
                                    }
                                }}
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                                Clear
                            </button>
                        </div>

                        {viewLoading[viewSubTab] ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-slate-500">Loading records...</p>
                            </div>
                        ) : viewData[viewSubTab].length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-slate-500">No records found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto overflow-y-auto max-h-96 border border-slate-200 rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            {Object.keys(viewData[viewSubTab][0] || {})
                                                .filter((key) => !VIEW_HIDDEN_COLUMNS.includes(key.toLowerCase()))
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
                                        {viewData[viewSubTab].map((record, idx) => (
                                            <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                                                {Object.entries(record)
                                                    .filter(([key]) => !VIEW_HIDDEN_COLUMNS.includes(key.toLowerCase()))
                                                    .map(([key, value]) => {
                                                        const isPhoto = (key.toLowerCase().includes('photo') || key.toLowerCase().includes('image')) && value
                                                        const displayValue = value === null || value === undefined ? '-' : String(value)

                                                        return (
                                                            <td key={key} className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">
                                                                {isPhoto ? (
                                                                    <button
                                                                        onClick={() => setViewPhotoModal({ isOpen: true, url: String(value) })}
                                                                        className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                                                                    >
                                                                        View
                                                                    </button>
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

                        {userEacNos.length > 0 && (
                            <p className="mt-4 text-xs text-slate-500">
                                Showing records for EAC Nos: {userEacNos.join(', ')}
                            </p>
                        )}
                    </section>
                </div>

                {viewPhotoModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                        <div className="rounded-lg bg-white p-6 shadow-lg max-w-2xl max-h-96 flex flex-col">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-900">Photo Preview</h3>
                                <button
                                    onClick={() => setViewPhotoModal({ isOpen: false, url: '' })}
                                    className="text-slate-500 hover:text-slate-700"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 flex items-center justify-center overflow-auto">
                                <img
                                    src={viewPhotoModal.url}
                                    alt="Preview"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={() => setViewPhotoModal({ isOpen: false, url: '' })}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </PageContainer>
        </main>
    )
}