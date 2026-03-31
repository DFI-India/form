'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'
import { Search, Pencil, RefreshCw } from 'lucide-react'

type EntityType =
    | 'child_data'
    | 'childfmly'
    | 'childsibling'
    | 'childuniform'
    | 'childleaving'
    | 'vocational_course'
    | 'computer_course'

type SearchType = 'name' | 'reg_no'

type DataRecord = Record<string, any>

const ENTITY_LABELS: Record<EntityType, string> = {
    child_data: 'Child Data',
    childfmly: 'Child Family',
    childsibling: 'Child Siblings',
    childuniform: 'Child Uniform',
    childleaving: 'Child Leaving',
    vocational_course: 'Vocational Course',
    computer_course: 'Computer Course',
}

const VISIBLE_ENTITY_TABS: EntityType[] = [
    'child_data',
    'childfmly',
    'childsibling',
    'childuniform',
    'childleaving',
]

const HIDDEN_COLUMNS = new Set([
    'id',
    'status',
    'submitted_by',
    'verified_by',
    'verified_at',
    'approved_by',
    'approved_at',
    'created_at',
    'updated_at',
])

const NON_EDITABLE_FIELDS = new Set([
    'id',
    'record_id',
    'vocational_id',
    'computer_id',
    'created_at',
    'updated_at',
    'submitted_by',
    'verified_by',
    'verified_at',
    'status',
    'approved_by',
    'approved_at',
    'approval_status',
    'rejection_reason',
])

const ENTITY_ID_CANDIDATES: Record<EntityType, string[]> = {
    child_data: ['record_id', 'id'],
    childfmly: ['record_id', 'id'],
    childsibling: ['record_id', 'id'],
    childuniform: ['record_id', 'id'],
    childleaving: ['record_id', 'id'],
    vocational_course: ['record_id', 'vocational_id', 'id'],
    computer_course: ['record_id', 'computer_id', 'id'],
}

const LIMIT = 20

export default function DFIStaffAllRecordsPage() {
    const router = useRouter()
    const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_staff'])

    const [activeTab, setActiveTab] = useState<EntityType>('child_data')
    const [sessionToken, setSessionToken] = useState<string | null>(null)

    const [rowsByTab, setRowsByTab] = useState<Record<EntityType, DataRecord[]>>({
        child_data: [],
        childfmly: [],
        childsibling: [],
        childuniform: [],
        childleaving: [],
        vocational_course: [],
        computer_course: [],
    })

    const [loadingByTab, setLoadingByTab] = useState<Record<EntityType, boolean>>({
        child_data: false,
        childfmly: false,
        childsibling: false,
        childuniform: false,
        childleaving: false,
        vocational_course: false,
        computer_course: false,
    })

    const [totalsByTab, setTotalsByTab] = useState<Record<EntityType, number>>({
        child_data: 0,
        childfmly: 0,
        childsibling: 0,
        childuniform: 0,
        childleaving: 0,
        vocational_course: 0,
        computer_course: 0,
    })

    const [pageByTab, setPageByTab] = useState<Record<EntityType, number>>({
        child_data: 1,
        childfmly: 1,
        childsibling: 1,
        childuniform: 1,
        childleaving: 1,
        vocational_course: 1,
        computer_course: 1,
    })

    const [searchByTab, setSearchByTab] = useState<Record<EntityType, string>>({
        child_data: '',
        childfmly: '',
        childsibling: '',
        childuniform: '',
        childleaving: '',
        vocational_course: '',
        computer_course: '',
    })

    const [searchTypeByTab, setSearchTypeByTab] = useState<Record<EntityType, SearchType>>({
        child_data: 'name',
        childfmly: 'name',
        childsibling: 'name',
        childuniform: 'name',
        childleaving: 'name',
        vocational_course: 'name',
        computer_course: 'name',
    })

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null)
    const [editDraft, setEditDraft] = useState<DataRecord>({})
    const [savingEdit, setSavingEdit] = useState(false)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [photoPreviewModal, setPhotoPreviewModal] = useState<{ isOpen: boolean; url: string }>({
        isOpen: false,
        url: '',
    })

    const getEntityIdentity = (tab: EntityType, record: DataRecord) => {
        const keys = ENTITY_ID_CANDIDATES[tab]
        for (const key of keys) {
            const value = record[key]
            if (value !== null && value !== undefined && value !== '') {
                return { key, value }
            }
        }
        return null
    }

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

    useEffect(() => {
        if (!isAuthorized || !sessionToken) return
        fetchTabRecords(activeTab)
    }, [isAuthorized, sessionToken, activeTab, pageByTab, searchByTab, searchTypeByTab])

    const fetchTabRecords = async (tab: EntityType) => {
        if (!sessionToken) return

        setLoadingByTab((prev) => ({ ...prev, [tab]: true }))
        setError('')

        try {
            const params = new URLSearchParams({
                entityType: tab,
                status: 'reviewable',
                search: searchByTab[tab].trim(),
                searchBy: searchTypeByTab[tab],
                page: String(pageByTab[tab]),
                limit: String(LIMIT),
            })

            const res = await fetch(`/api/admin/records/list?${params.toString()}`, {
                headers: {
                    Authorization: `Bearer ${sessionToken}`,
                },
            })

            const json = await res.json()
            if (!res.ok) {
                throw new Error(json.error || 'Failed to load records')
            }

            setRowsByTab((prev) => ({ ...prev, [tab]: json.data || [] }))
            setTotalsByTab((prev) => ({ ...prev, [tab]: json.total || 0 }))
        } catch (err: any) {
            setError(err.message || 'Error loading records')
        } finally {
            setLoadingByTab((prev) => ({ ...prev, [tab]: false }))
        }
    }

    const currentRows = rowsByTab[activeTab] || []
    const currentLoading = loadingByTab[activeTab]
    const currentPage = pageByTab[activeTab]
    const totalRows = totalsByTab[activeTab]
    const totalPages = Math.max(1, Math.ceil(totalRows / LIMIT))

    const visibleColumns = useMemo(() => {
        if (currentRows.length === 0) return []
        return Object.keys(currentRows[0]).filter((key) => !HIDDEN_COLUMNS.has(key))
    }, [currentRows])

    const onSearch = () => {
        setPageByTab((prev) => ({ ...prev, [activeTab]: 1 }))
        fetchTabRecords(activeTab)
    }

    const openEditModal = (record: DataRecord) => {
        setEditingRecord(record)
        setEditDraft({ ...record })
    }

    const closeEditModal = () => {
        setEditingRecord(null)
        setEditDraft({})
        setUploadingPhoto(false)
    }

    const handlePhotoUpload = async (file: File) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be 5MB or smaller')
            return
        }

        setUploadingPhoto(true)
        setError('')

        try {
            const safeName = file.name.replace(/\s+/g, '-')
            const fileName = `${Date.now()}-${safeName}`
            const filePath = `all_records_photos/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('profiles')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage.from('profiles').getPublicUrl(filePath)
            setEditDraft((prev) => ({
                ...prev,
                photo_link: data.publicUrl,
            }))
        } catch (err: any) {
            setError(err.message || 'Failed to upload image')
        } finally {
            setUploadingPhoto(false)
        }
    }

    const handleSaveEdit = async () => {
        if (!sessionToken || !editingRecord) return

        const status = String(editingRecord.status || '').trim()
        if (!['Verified', 'Approved'].includes(status)) {
            setError('Only Verified or Approved records can be edited here')
            return
        }

        const identity = getEntityIdentity(activeTab, editingRecord)
        if (!identity) {
            setError('This record cannot be edited because its primary key is missing')
            return
        }

        const updates: Record<string, any> = {}
        for (const [key, value] of Object.entries(editDraft)) {
            if (NON_EDITABLE_FIELDS.has(key)) continue
            if (editingRecord[key] !== value) {
                updates[key] = value
            }
        }

        if (Object.keys(updates).length === 0) {
            closeEditModal()
            return
        }

        setSavingEdit(true)
        setError('')

        try {
            const res = await fetch('/api/admin/records/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({
                    entityType: activeTab,
                    entityId: identity.value,
                    entityKey: identity.key,
                    updates,
                }),
            })

            const json = await res.json()
            if (!res.ok) {
                throw new Error(json.error || 'Failed to update record')
            }

            setSuccess('Record updated successfully')
            closeEditModal()
            fetchTabRecords(activeTab)
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: any) {
            setError(err.message || 'Failed to update record')
        } finally {
            setSavingEdit(false)
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
                    <p className="text-slate-600">You don&apos;t have permission to access this page.</p>
                </div>
            </main>
        )
    }

    const roleInfo = ROLE_CONFIG.find((r) => r.value === profile.role)!

    return (
        <main className="min-h-screen bg-slate-50">
            <Navbar
                username={profile.username}
                role={profile.role as any}
                roleLabel={roleInfo.label}
                roleColor={roleInfo.color}
            />
            <Sidebar role={profile.role as any} />

            <PageContainer>
                <div className="p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900">All Records</h2>
                            <p className="text-slate-600 mt-2">View and edit records across all tables</p>
                        </div>
                        <button
                            onClick={() => router.push('/dfi-staff')}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            ← Back to Dashboard
                        </button>
                    </div>

                    {error && <Alert type="error" message={error} className="mb-6" onDismiss={() => setError('')} />}
                    {success && <Alert type="success" message={success} className="mb-6" onDismiss={() => setSuccess('')} />}

                    <div className="bg-white rounded-lg border border-slate-200 mb-6">
                        <div className="flex overflow-x-auto">
                            {VISIBLE_ENTITY_TABS.map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setActiveTab(type)}
                                    className={`flex-1 min-w-[150px] px-4 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === type
                                        ? 'border-purple-600 text-purple-600 bg-purple-50'
                                        : 'border-transparent text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {ENTITY_LABELS[type]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 mb-6 p-4">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1 relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={searchByTab[activeTab]}
                                    onChange={(e) =>
                                        setSearchByTab((prev) => ({
                                            ...prev,
                                            [activeTab]: e.target.value,
                                        }))
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') onSearch()
                                    }}
                                    placeholder={`Search ${ENTITY_LABELS[activeTab]} by ${searchTypeByTab[activeTab]}`}
                                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <select
                                value={searchTypeByTab[activeTab]}
                                onChange={(e) =>
                                    setSearchTypeByTab((prev) => ({
                                        ...prev,
                                        [activeTab]: e.target.value as SearchType,
                                    }))
                                }
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="name">Search by name</option>
                                <option value="reg_no">Search by reg_no</option>
                            </select>

                            <button
                                onClick={onSearch}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                            >
                                Search
                            </button>

                            <button
                                onClick={() => fetchTabRecords(activeTab)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium inline-flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        {currentLoading ? (
                            <div className="p-12 text-center">
                                <LoadingSpinner size="lg" />
                                <p className="mt-4 text-slate-600">Loading records...</p>
                            </div>
                        ) : currentRows.length === 0 ? (
                            <div className="p-12 text-center text-slate-600">No records found in this table.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold">Action</th>
                                            {visibleColumns.map((column) => (
                                                <th key={column} className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                                                    {column}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentRows.map((row, index) => (
                                            <tr
                                                key={`${String(getEntityIdentity(activeTab, row)?.value ?? index)}`}
                                                className="border-t border-slate-200 hover:bg-slate-50"
                                            >
                                                <td className="px-4 py-3 align-top">
                                                    <button
                                                        onClick={() => openEditModal(row)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-xs font-medium"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        Edit
                                                    </button>
                                                </td>
                                                {visibleColumns.map((column) => (
                                                    <td
                                                        key={`${String(getEntityIdentity(activeTab, row)?.value ?? index)}-${column}`}
                                                        className="px-4 py-3 text-slate-700 whitespace-nowrap"
                                                    >
                                                        {column === 'photo_link' ? (
                                                            row[column] ? (
                                                                <button
                                                                    onClick={() =>
                                                                        setPhotoPreviewModal({
                                                                            isOpen: true,
                                                                            url: String(row[column]),
                                                                        })
                                                                    }
                                                                    className="px-2.5 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-medium"
                                                                >
                                                                    View Photo
                                                                </button>
                                                            ) : (
                                                                '-'
                                                            )
                                                        ) : (
                                                            String(row[column] ?? '')
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm text-slate-600">
                            Showing page {currentPage} of {totalPages} • {totalRows} total records
                        </p>
                        <div className="flex gap-2">
                            <button
                                disabled={currentPage <= 1}
                                onClick={() =>
                                    setPageByTab((prev) => ({
                                        ...prev,
                                        [activeTab]: Math.max(1, prev[activeTab] - 1),
                                    }))
                                }
                                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                disabled={currentPage >= totalPages}
                                onClick={() =>
                                    setPageByTab((prev) => ({
                                        ...prev,
                                        [activeTab]: Math.min(totalPages, prev[activeTab] + 1),
                                    }))
                                }
                                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </PageContainer>

            {editingRecord && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">
                                Edit {ENTITY_LABELS[activeTab]} record #{String(getEntityIdentity(activeTab, editingRecord)?.value ?? 'N/A')}
                            </h3>
                            <button onClick={closeEditModal} className="text-slate-600 hover:text-slate-900">
                                ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[65vh]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(editDraft)
                                    .filter(([key]) => !NON_EDITABLE_FIELDS.has(key))
                                    .map(([key, value]) => (
                                        <div key={key}>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">{key}</label>
                                            {key === 'photo_link' ? (
                                                <div className="space-y-2">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) handlePhotoUpload(file)
                                                        }}
                                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                                    />
                                                    {uploadingPhoto && (
                                                        <p className="text-xs text-slate-500">Uploading image...</p>
                                                    )}
                                                    {value ? (
                                                        <a
                                                            href={String(value)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-xs text-blue-600 hover:underline break-all"
                                                        >
                                                            {String(value)}
                                                        </a>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <input
                                                    value={value ?? ''}
                                                    onChange={(e) =>
                                                        setEditDraft((prev) => ({
                                                            ...prev,
                                                            [key]: e.target.value,
                                                        }))
                                                    }
                                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={closeEditModal}
                                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={savingEdit || uploadingPhoto}
                                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                            >
                                {uploadingPhoto ? 'Uploading Photo...' : savingEdit ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {photoPreviewModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">Photo Preview</h3>
                            <button
                                onClick={() => setPhotoPreviewModal({ isOpen: false, url: '' })}
                                className="text-slate-600 hover:text-slate-900"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 flex justify-center bg-slate-50">
                            <img
                                src={photoPreviewModal.url}
                                alt="Child photo"
                                className="max-h-[70vh] w-auto rounded-lg border border-slate-200 bg-white"
                            />
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
