'use client'

import {
    useState,
    useEffect,
    type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import DFILogo from '../../../public/DFI.png'
import { supabase } from '../../../lib/supabase'
import { useRequireRole } from '../../../lib/hooks'
import { LoadingSpinner } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG, getRoleCapabilities } from '../../../lib/types'

type VerifySubTabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving' | 'vocational' | 'computer'

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
    'verified_by',
    'verified_at',
]

const HISTORY_HIDDEN_COLUMNS = [
    'status',
    'submitted_by',
    'verified_by',
    'verified_at',
]

type Toast = { id: string; type: 'success' | 'error'; text: string }

export default function ApproveDataPage() {
    const router = useRouter()
    const [verifySubTab, setVerifySubTab] = useState<VerifySubTabType>('child')

    const [checkedAuth, setCheckedAuth] = useState(false)
    const [authorized, setAuthorized] = useState(false)
    const [message, setMessage] = useState<MessageState>(null)
    const [userEacNos, setUserEacNos] = useState<number[]>([])
    const [userId, setUserId] = useState<string | null>(null)

    // Verify Data State
    const [verifyData, setVerifyData] = useState<Record<VerifySubTabType, ApprovalRecord[]>>({
        child: [],
        family: [],
        sibling: [],
        uniform: [],
        leaving: [],
        vocational: [],
        computer: [],
    })

    const [verifyLoading, setVerifyLoading] = useState<Record<VerifySubTabType, boolean>>({
        child: false,
        family: false,
        sibling: false,
        uniform: false,
        leaving: false,
        vocational: false,
        computer: false,
    })

    const [verifyPagination, setVerifyPagination] = useState<Record<VerifySubTabType, { page: number; pageSize: number }>>({
        child: { page: 1, pageSize: 10 },
        family: { page: 1, pageSize: 10 },
        sibling: { page: 1, pageSize: 10 },
        uniform: { page: 1, pageSize: 10 },
        leaving: { page: 1, pageSize: 10 },
        vocational: { page: 1, pageSize: 10 },
        computer: { page: 1, pageSize: 10 },
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
                // Fetch assigned EAC numbers for this user and user id
                const { data: user } = await supabase.auth.getUser()
                if (user.user?.id) {
                    setUserId(user.user.id)
                    console.log('[Auth] Set userId after login:', user.user.id)

                    const { data: eacs } = await supabase
                        .from('dfi_field_staff_assigned_eacs')
                        .select('assigned_eac')
                        .eq('id', user.user.id)

                    const assignedEacNos = (eacs || [])
                        .map((row) => Number((row as { assigned_eac: unknown }).assigned_eac))
                        .filter((value) => !Number.isNaN(value))

                    setUserEacNos(assignedEacNos)
                } else {
                    setUserId(null)
                    setUserEacNos([])
                    console.warn('[Auth] No userId found after login')
                }
            }
        }

        verifySession()


        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return

            const hasSession = Boolean(session)
            setAuthorized(hasSession)
            if (!hasSession) {
                router.replace('/sign-in')
            } else {
                // Update userId and assigned EACs on auth state change
                const { data: user } = await supabase.auth.getUser()
                if (user.user?.id) {
                    setUserId(user.user.id)
                    console.log('[AuthStateChange] Set userId:', user.user.id)

                    const { data: eacs } = await supabase
                        .from('dfi_field_staff_assigned_eacs')
                        .select('assigned_eac')
                        .eq('id', user.user.id)

                    const assignedEacNos = (eacs || [])
                        .map((row) => Number((row as { assigned_eac: unknown }).assigned_eac))
                        .filter((value) => !Number.isNaN(value))

                    setUserEacNos(assignedEacNos)
                } else {
                    setUserId(null)
                    setUserEacNos([])
                    console.warn('[AuthStateChange] No userId found')
                }
            }
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [router])

    // Fetch data for current verify subtab
    useEffect(() => {
        if (authorized) {
            fetchVerifyData(verifySubTab)
        }
    }, [authorized, verifySubTab, verifyPagination])

    const fetchVerifyData = async (tabType: VerifySubTabType) => {
        setVerifyLoading((prev) => ({ ...prev, [tabType]: true }))
        try {
            const viewMap: Record<VerifySubTabType, string> = {
                child: 'childdata_for_approval',
                family: 'childfmly_for_approval',
                sibling: 'childsibling_for_approval',
                uniform: 'childuniform_for_approval',
                leaving: 'childleaving_for_approval',
                vocational: 'vocational_course_for_approval',
                computer: 'computer_course_for_approval',
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

            // Map id to approval_id and preserve record_id for API
            // For vocational/computer courses, use id as the entity ID; for others use record_id
            const enrichedData = (data || []).map((record: any) => ({
                ...record,
                approval_id: record.id, // approval table id
                record_id: ['vocational', 'computer'].includes(tabType) ? record.id : record.record_id // use id for vocational/computer
            }))

            console.log('Fetched vocational/computer data:', enrichedData);
            setVerifyData((prev) => ({
                ...prev,
                [tabType]: enrichedData,
            }))
        } catch (error: unknown) {
            const fallback = error instanceof Error ? error.message : 'Failed to fetch data'
            setMessage({ type: 'error', text: `Unable to load ${tabType} data: ${fallback}` })
        } finally {
            setVerifyLoading((prev) => ({ ...prev, [tabType]: false }))
        }
    }



    const handleVerify = async (recordId: string) => {
        setActionLoading((prev) => ({ ...prev, [recordId]: true }))
        try {
            // Map verifySubTab to entityType used by the API
            const entityTypeMap: Record<VerifySubTabType, string> = {
                child: 'child_data',
                family: 'childfmly',
                sibling: 'childsibling',
                uniform: 'childuniform',
                leaving: 'childleaving',
                vocational: 'vocational_course',
                computer: 'computer_course',
            }
            const entityType = entityTypeMap[verifySubTab]
            // Find the record in verifyData to get the correct record_id
            const record = verifyData[verifySubTab].find(r => r.approval_id === recordId)
            const entityId = record?.record_id
            if (!entityId) throw new Error('No record_id found for this record.');
            // Get access token
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;
            if (!accessToken) throw new Error('No access token found. Please sign in again.');
            const res = await fetch('/api/admin/approvals/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ entityType, entityId }),
                credentials: 'include',
            })
            const json = await res.json()
            if (json && json.success) {
                addToast({ type: 'success', text: json.message || 'Record verified successfully.' })
                // Refetch data to sync with actual backend state
                await fetchVerifyData(verifySubTab)
            } else if (!res.ok || json.error) {
                throw new Error(json.error || 'Approval failed')
            } else {
                // fallback: unknown error
                throw new Error('Unknown error during verification')
            }
        } catch (error: unknown) {
            const fallback = error instanceof Error ? error.message : 'Failed to verify'
            addToast({ type: 'error', text: `Unable to verify: ${fallback}` })
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
            // Map verifySubTab to entityType used by the API
            const entityTypeMap: Record<VerifySubTabType, string> = {
                child: 'child_data',
                family: 'childfmly',
                sibling: 'childsibling',
                uniform: 'childuniform',
                leaving: 'childleaving',
                vocational: 'vocational_course',
                computer: 'computer_course',
            }
            const entityType = entityTypeMap[verifySubTab]
            // Find the record in verifyData to get the correct record_id
            const record = verifyData[verifySubTab].find(r => r.approval_id === recordId)
            const entityId = record?.record_id
            if (!entityId) throw new Error('No record_id found for this record.');
            // Get access token
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;
            if (!accessToken) throw new Error('No access token found. Please sign in again.');
            const res = await fetch('/api/admin/approvals/reject', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ entityType, entityId, reason }),
                credentials: 'include',
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Rejection failed')
            addToast({ type: 'success', text: 'Record rejected successfully.' })
            // Refetch data to sync with actual backend state
            await fetchVerifyData(verifySubTab)
        } catch (error: unknown) {
            const fallback = error instanceof Error ? error.message : 'Failed to reject'
            addToast({ type: 'error', text: `Unable to reject: ${fallback}` })
        } finally {
            setActionLoading((prev) => ({ ...prev, [recordId]: false }))
        }
    }





    // Ensure role hook is called before any early returns so hook order stays stable
    const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_field_staff'])

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



    const verifySubTabs: { id: VerifySubTabType; label: string }[] = [
        { id: 'child', label: 'Child Data' },
        { id: 'family', label: 'Child Family' },
        { id: 'sibling', label: 'Child Siblings' },
        { id: 'uniform', label: 'Child Uniform' },
        { id: 'leaving', label: 'Child Leaving' },
        { id: 'vocational', label: 'Vocational Course' },
        { id: 'computer', label: 'Computer Course' },
    ]

    // Ensure headers and rows use the same visible keys so columns stay aligned
    const currentRecords = verifyData[verifySubTab] || []
    const visibleKeys: string[] = currentRecords.length > 0
        ? Object.keys(currentRecords[0]).filter((key) => !HIDDEN_COLUMNS.includes(key))
        : []

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
        <main className="flex-1">
            <Navbar
                username={profile.username}
                role="dfi_field_staff"
                roleLabel={roleInfo.label}
                roleColor={roleInfo.color} />
            <Sidebar role="dfi_field_staff" />
            {/* <header className="mb-8">
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-start sm:text-left">
                        <Image
                            src={DFILogo}
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
            </header> */}
            <PageContainer>
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Data Verification & Approval</h1>
                    <p className="mt-1 text-sm text-slate-600">Review and verify submitted child management data from field volunteers.</p>
                </header>

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
                                Review and verify or reject submitted records.
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
                                                onApprove={() => handleVerify(record.approval_id)}
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

            </PageContainer>
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
                            {isLoading ? 'Processing...' : 'Verify'}
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
