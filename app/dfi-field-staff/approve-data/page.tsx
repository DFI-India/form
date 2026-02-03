'use client'

import {
    useState,
    useEffect,
    type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../../lib/supabase'

type MainTabType = 'verify' | 'view' | 'history'
type VerifySubTabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving'
type ViewSubTabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving'
type SearchByType = 'name' | 'reg_no'

type ApprovalRecord = Record<string, unknown> & {
    approval_id: string   // <-- REAL child_approvals.id
}

type MessageState = { type: 'success' | 'error'; text: string } | null

// Columns we don't show in the table (used for both header and rows)
const HIDDEN_COLUMNS = [
    'approval_id',
    'approval_status',
    'rejection_reason',
    'record_submitted_by',
    'created_at',
    'status',
    'submitted_by',
    'approved_by',
    'approved_at',
]

type Toast = { id: string; type: 'success' | 'error'; text: string }

export default function ApproveDataPage() {
    const router = useRouter()
    const [mainTab, setMainTab] = useState<MainTabType>('verify')
    const [verifySubTab, setVerifySubTab] = useState<VerifySubTabType>('child')
    const [viewSubTab, setViewSubTab] = useState<ViewSubTabType>('child')

    const [checkedAuth, setCheckedAuth] = useState(false)
    const [authorized, setAuthorized] = useState(false)
    const [message, setMessage] = useState<MessageState>(null)
    const [userEacNo, setUserEacNo] = useState<number | null>(null)

    // Verify Data State
    const [verifyData, setVerifyData] = useState<Record<VerifySubTabType, ApprovalRecord[]>>({
        child: [],
        family: [],
        sibling: [],
        uniform: [],
        leaving: [],
    })

    const [verifyLoading, setVerifyLoading] = useState<Record<VerifySubTabType, boolean>>({
        child: false,
        family: false,
        sibling: false,
        uniform: false,
        leaving: false,
    })

    const [verifyPagination, setVerifyPagination] = useState<Record<VerifySubTabType, { page: number; pageSize: number }>>({
        child: { page: 1, pageSize: 10 },
        family: { page: 1, pageSize: 10 },
        sibling: { page: 1, pageSize: 10 },
        uniform: { page: 1, pageSize: 10 },
        leaving: { page: 1, pageSize: 10 },
    })

    // View Data State
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

    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

    // Toast notifications
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = (t: Omit<Toast, 'id'>) => {
        const id = String(Date.now())
        setToasts((prev) => [...prev, { id, ...t }])
        // Auto dismiss
        setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000)
    }

    const removeToast = (id: string) => setToasts((prev) => prev.filter((x) => x.id !== id))

    // Auth Check
    useEffect(() => {
        let isMounted = true

        const verifySession = async () => {
            const { data } = await supabase.auth.getSession()
            if (!isMounted) return

            const hasSession = Boolean(data.session)
            setAuthorized(hasSession)
            setCheckedAuth(true)

            if (!hasSession) {
                router.replace('/sign-in')
            } else {
                // Fetch user's eac_no from profile
                const { data: user } = await supabase.auth.getUser()
                if (user.user?.id) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('centre_eac_no_int')
                        .eq('id', user.user.id)
                        .single()

                    if (profile?.centre_eac_no_int) {
                        setUserEacNo(profile.centre_eac_no_int)
                    }
                }
            }
        }

        verifySession()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return

            const hasSession = Boolean(session)
            setAuthorized(hasSession)
            if (!hasSession) {
                router.replace('/sign-in')
            }
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [router])

    // Fetch data for current verify subtab
    useEffect(() => {
        if (authorized && mainTab === 'verify') {
            fetchVerifyData(verifySubTab)
        }
    }, [authorized, mainTab, verifySubTab, verifyPagination])

    // Fetch data for current view subtab
    useEffect(() => {
        if (authorized && mainTab === 'view' && userEacNo) {
            fetchViewData(viewSubTab)
        }
    }, [authorized, mainTab, viewSubTab, userEacNo, viewSearchQuery, viewSearchType])

    const fetchVerifyData = async (tabType: VerifySubTabType) => {
        setVerifyLoading((prev) => ({ ...prev, [tabType]: true }))
        try {
            const viewMap: Record<VerifySubTabType, string> = {
                child: 'childdata_for_approval',
                family: 'childfmly_for_approval',
                sibling: 'childsibling_for_approval',
                uniform: 'childuniform_for_approval',
                leaving: 'childleaving_for_approval',
            }

            const viewName = viewMap[tabType]
            const pagination = verifyPagination[tabType]
            const from = (pagination.page - 1) * pagination.pageSize
            const to = from + pagination.pageSize - 1

            const { data, error } = await supabase
                .from(viewName)
                .select('*')
                .eq('approval_status', 'Pending')
                .range(from, to)


            if (error) throw error

            setVerifyData((prev) => ({
                ...prev,
                [tabType]: data || [],
            }))
            console.log(data, error);
        } catch (error: unknown) {
            const fallback = error instanceof Error ? error.message : 'Failed to fetch data'
            setMessage({ type: 'error', text: `Unable to load ${tabType} data: ${fallback}` })
        } finally {
            setVerifyLoading((prev) => ({ ...prev, [tabType]: false }))
        }
    }

    const fetchViewData = async (tabType: ViewSubTabType) => {
        setViewLoading((prev) => ({ ...prev, [tabType]: true }))
        try {
            if (!userEacNo) {
                throw new Error('User EAC number not found.')
            }

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
                .eq('eac_no', userEacNo)

            // Apply search filter if provided
            if (searchQuery.trim()) {
                if (searchType === 'name') {
                    if (tabType === 'child') {
                        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
                    } else {
                        query = query.ilike('f_name', `%${searchQuery}%`)
                    }
                } if (searchType === 'reg_no') {
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

    const handleApprove = async (recordId: string) => {
        setActionLoading((prev) => ({ ...prev, [recordId]: true }))
        try {
            const { error } = await supabase
                .from('child_approvals')
                .update({
                    status: 'Approved',
                    decided_by: (await supabase.auth.getUser()).data.user?.id,
                    decided_at: new Date().toISOString(),
                })
                .eq('id', recordId)

            if (error) throw error

            // Show toast and remove from current visible list immediately
            addToast({ type: 'success', text: 'Record approved successfully.' })
            setVerifyData((prev) => ({
                ...prev,
                [verifySubTab]: prev[verifySubTab].filter((r) => r.approval_id !== recordId),
            }))
        } catch (error: unknown) {
            const fallback = error instanceof Error ? error.message : 'Failed to approve'
            addToast({ type: 'error', text: `Unable to approve: ${fallback}` })
        } finally {
            setActionLoading((prev) => ({ ...prev, [recordId]: false }))
        }
    }

    const handleReject = async (recordId: string, reason: string) => {
        if (!reason.trim()) {
            setMessage({ type: 'error', text: 'Please provide a rejection reason.' })
            return
        }

        setActionLoading((prev) => ({ ...prev, [recordId]: true }))
        try {
            const user = (await supabase.auth.getUser()).data.user

            const { error } = await supabase
                .from('child_approvals')
                .update({
                    status: 'Rejected',
                    rejection_reason: reason,
                    decided_by: user?.id,
                    decided_at: new Date().toISOString(),
                })
                .eq('id', recordId)

            if (error) throw error

            // Show toast and remove from current visible list immediately
            addToast({ type: 'success', text: 'Record rejected successfully.' })
            setVerifyData((prev) => ({
                ...prev,
                [verifySubTab]: prev[verifySubTab].filter((r) => r.approval_id !== recordId),
            }))
        } catch (error: unknown) {
            const fallback = error instanceof Error ? error.message : 'Failed to reject'
            addToast({ type: 'error', text: `Unable to reject: ${fallback}` })
        } finally {
            setActionLoading((prev) => ({ ...prev, [recordId]: false }))
        }
    }

    if (!checkedAuth) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-100">
                <p className="text-sm text-slate-500">Checking access…</p>
            </main>
        )
    }

    if (!authorized) {
        return null
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.replace('/sign-in')
    }

    const mainTabs: { id: MainTabType; label: string }[] = [
        { id: 'verify', label: 'Verify Data' },
        { id: 'view', label: 'View Data' },
        { id: 'history', label: 'Personal History' },
    ]

    const verifySubTabs: { id: VerifySubTabType; label: string }[] = [
        { id: 'child', label: 'Child Data' },
        { id: 'family', label: 'Child Family' },
        { id: 'sibling', label: 'Child Siblings' },
        { id: 'uniform', label: 'Child Uniform' },
        { id: 'leaving', label: 'Child Leaving' },
    ]

    // Ensure headers and rows use the same visible keys so columns stay aligned
    const currentRecords = verifyData[verifySubTab] || []
    const visibleKeys: string[] = currentRecords.length > 0
        ? Object.keys(currentRecords[0]).filter((key) => !HIDDEN_COLUMNS.includes(key))
        : []

    return (
        <main className="flex-1">
            <header className="mb-8">
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-start sm:text-left">
                        <Image
                            src="/DFI.png"
                            alt="Debora Foundation India logo"
                            width={180}
                            height={60}
                            priority
                            className="h-auto w-40 sm:w-44"
                        />
                        <span className="text-xl font-semibold text-slate-900">Debora Foundation India</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
                    >
                        Sign out
                    </button>
                </div>

                <p className="text-sm font-semibold tracking-wide text-blue-600">Approval Workflow</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Data Verification & Approval</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Review and approve submitted child management data from field volunteers.
                </p>
            </header>

            {/* Main Tab Navigation */}
            <div className="mb-6 border-b border-slate-200">
                <div className="flex flex-wrap gap-2 sm:gap-0">
                    {mainTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setMainTab(tab.id)}
                            className={`px-4 py-3 text-sm font-medium transition ${mainTab === tab.id
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Message Alert */}
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

            {/* Verify Data Tab */}
            {mainTab === 'verify' && (
                <div className="space-y-6">
                    {/* Verify Subtabs */}
                    <div className="border-b border-slate-200">
                        <div className="flex flex-wrap gap-2 sm:gap-0">
                            {verifySubTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setVerifySubTab(tab.id)}
                                    className={`px-4 py-3 text-sm font-medium transition ${verifySubTab === tab.id
                                        ? 'border-b-2 border-green-600 text-green-600'
                                        : 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Verify Data Table */}
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Pending {verifySubTabs.find((t) => t.id === verifySubTab)?.label} Records
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Review and approve or reject submitted records.
                            </p>
                        </div>

                        {verifyLoading[verifySubTab] ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-slate-500">Loading records...</p>
                            </div>
                        ) : verifyData[verifySubTab].length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-slate-500">No records found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto overflow-y-auto max-h-96 border border-slate-200 rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">Record ID</th>
                                            {visibleKeys.length > 0 && visibleKeys.map((key) => (
                                                <th key={key} className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">
                                                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap sticky right-0 top-0 bg-white z-20 w-[170px]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {verifyData[verifySubTab].map((record) => (
                                            <VerifyDataRow
                                                key={record.approval_id}
                                                record={record}
                                                displayKeys={visibleKeys}
                                                isLoading={actionLoading[record.approval_id] || false}
                                                onApprove={() => handleApprove(record.approval_id)}
                                                onReject={(reason) => handleReject(record.approval_id, reason)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {verifyData[verifySubTab].length > 0 && (
                            <div className="mt-4 flex items-center justify-between">
                                <button
                                    onClick={() =>
                                        setVerifyPagination((prev) => ({
                                            ...prev,
                                            [verifySubTab]: {
                                                ...prev[verifySubTab],
                                                page: Math.max(1, prev[verifySubTab].page - 1),
                                            },
                                        }))
                                    }
                                    disabled={verifyPagination[verifySubTab].page === 1}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-slate-600">
                                    Page {verifyPagination[verifySubTab].page}
                                </span>
                                <button
                                    onClick={() =>
                                        setVerifyPagination((prev) => ({
                                            ...prev,
                                            [verifySubTab]: {
                                                ...prev[verifySubTab],
                                                page: prev[verifySubTab].page + 1,
                                            },
                                        }))
                                    }
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* View Data Tab */}
            {mainTab === 'view' && (
                <div className="space-y-6">
                    {/* View Subtabs */}
                    <div className="border-b border-slate-200">
                        <div className="flex flex-wrap gap-2 sm:gap-0">
                            {verifySubTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewSubTab(tab.id as ViewSubTabType)}
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

                    {/* View Data Section */}
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold text-slate-900">
                                View {verifySubTabs.find((t) => t.id === viewSubTab)?.label} Records
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                View all approved records for your centre.
                            </p>
                        </div>

                        {/* Search Bar */}
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
                            <button
                                onClick={() => {
                                    setViewSearchQuery((prev) => ({
                                        ...prev,
                                        [viewSubTab]: '',
                                    }))
                                }}
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                                Clear
                            </button>
                        </div>

                        {/* Data Table */}
                        {viewLoading[viewSubTab] ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-slate-500">Loading records...</p>
                            </div>
                        ) : viewData[viewSubTab].length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-slate-500">No records found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            {Object.keys(viewData[viewSubTab][0] || {}).map((key) => (
                                                <th
                                                    key={key}
                                                    className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap"
                                                >
                                                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewData[viewSubTab].map((record, idx) => (
                                            <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                                                {Object.entries(record).map(([key, value]) => {
                                                    const isPhoto = (key.toLowerCase().includes('photo') || key.toLowerCase().includes('image')) && value
                                                    const displayValue = value === null || value === undefined ? '-' : String(value)

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

                        {userEacNo && (
                            <p className="mt-4 text-xs text-slate-500">
                                Showing records for EAC No: {userEacNo}
                            </p>
                        )}
                    </section>
                </div>
            )}

            {/* Personal History Tab */}
            {mainTab === 'history' && (
                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Personal History</h2>
                    <p className="text-sm text-slate-600">
                        Track all approvals, rejections, and changes to child records. Integration pending.
                    </p>
                </section>
            )}

            {/* Toasts */}
            {toasts.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
                    {toasts.map((t) => (
                        <div key={t.id} className={`rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${t.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            <div className="flex items-start gap-3">
                                <div className="flex-1">{t.text}</div>
                                <button onClick={() => removeToast(t.id)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    )
}

type VerifyDataRowProps = {
    record: ApprovalRecord
    isLoading: boolean
    onApprove: () => void
    onReject: (reason: string) => void
    displayKeys: string[]
}

function VerifyDataRow({ record, isLoading, onApprove, onReject, displayKeys }: VerifyDataRowProps) {
    const [showRejectInput, setShowRejectInput] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [photoModal, setPhotoModal] = useState<{ isOpen: boolean; url: string }>({
        isOpen: false,
        url: '',
    })

    // Extract record_id, defaulting to id if not present
    const displayId = (record.record_id as string) || (record.approval_id as string)

    // Format cell value for display
    const formatCellValue = (value: unknown): string => {
        if (value === null || value === undefined) return '-'
        if (typeof value === 'object') return JSON.stringify(value)
        if (typeof value === 'boolean') return value ? 'Yes' : 'No'
        return String(value)
    }

    // Check if a key is a photo_link column
    const isPhotoLink = (key: string): boolean => {
        return key.toLowerCase().includes('photo') || key.toLowerCase().includes('image')
    }

    return (
        <>
            <tr className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                    {displayId}
                </td>
                {displayKeys.map((key) => {
                    const value = record[key]
                    const isPhoto = isPhotoLink(key) && value

                    return (
                        <td key={key} className="px-4 py-3 text-sm text-slate-700">
                            {isPhoto ? (
                                <button
                                    onClick={() => setPhotoModal({ isOpen: true, url: String(value) })}
                                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                                >
                                    View Photo
                                </button>
                            ) : (
                                <span className="whitespace-nowrap max-w-xs truncate inline-block" title={formatCellValue(value)}>
                                    {formatCellValue(value)}
                                </span>
                            )}
                        </td>
                    )
                })}
                <td className="px-4 py-3 text-sm sticky right-0 bg-white z-10 w-[170px]">
                    <div className="flex gap-2 flex-nowrap">
                        <button
                            onClick={onApprove}
                            disabled={isLoading}
                            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300 whitespace-nowrap"
                        >
                            {isLoading ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                            onClick={() => setShowRejectInput(!showRejectInput)}
                            disabled={isLoading}
                            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300 whitespace-nowrap"
                        >
                            Reject
                        </button>
                    </div>
                </td>
            </tr>
            {showRejectInput && (
                <tr className="border-b border-slate-200 bg-slate-50">
                    <td colSpan={displayKeys.length + 2} className="px-4 py-4">
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-700">
                                Rejection Reason *
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Enter the reason for rejection..."
                                rows={3}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        onReject(rejectReason)
                                        setShowRejectInput(false)
                                        setRejectReason('')
                                    }}
                                    disabled={isLoading || !rejectReason.trim()}
                                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                                >
                                    {isLoading ? 'Submitting...' : 'Submit Rejection'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowRejectInput(false)
                                        setRejectReason('')
                                    }}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}

            {/* Photo Modal */}
            {photoModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="rounded-lg bg-white p-6 shadow-lg max-w-2xl max-h-96 flex flex-col">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Photo Preview</h3>
                            <button
                                onClick={() => setPhotoModal({ isOpen: false, url: '' })}
                                className="text-slate-500 hover:text-slate-700"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 flex items-center justify-center overflow-auto">
                            <img
                                src={photoModal.url}
                                alt="Preview"
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setPhotoModal({ isOpen: false, url: '' })}
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
