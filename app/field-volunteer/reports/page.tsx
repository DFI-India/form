'use client'

import { useEffect, useMemo, useState } from 'react'
import TablePagination from '@mui/material/TablePagination'
import { BookOpen, Filter, FileText, Search, Shirt, Users } from 'lucide-react'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { Alert, LoadingSpinner } from '../../components/UI'
import { supabase } from '../../../lib/supabase'
import { useRequireRole } from '../../../lib/hooks'
import { ROLE_CONFIG } from '../../../lib/types'

type ReportTab = 'child' | 'family' | 'sibling' | 'uniform'
type StudentFilter = 'all' | 'enrolled' | 'left'

type ChildDataRow = {
    record_id?: number | string
    eac_no?: string | number | null
    reg_no?: string | number | null
    first_name?: string | null
    last_name?: string | null
    gender?: string | null
    adm_date?: string | null
    class_std_text?: string | null
    school_name?: string | null
    school_category?: string | null
    child_left?: boolean | string | number | null
    created_at?: string | null
}

type ChildFamilyRow = {
    record_id?: number | string
    eac_no?: string | number | null
    reg_no?: string | number | null
    f_name?: string | null
    m_name?: string | null
    f_mobile?: string | null
    m_mobile?: string | null
    fmly_addr1?: string | null
    fmly_addr2?: string | null
    fmly_addr3?: string | null
    fmly_pincode?: string | null
    fmly_remarks?: string | null
    created_at?: string | null
}

type ChildSiblingRow = {
    record_id?: number | string
    eac_no?: string | number | null
    reg_no?: string | number | null
    names_1?: string | null
    ages_1?: string | number | null
    genders_1?: string | null
    class_occup_1?: string | null
    names_2?: string | null
    ages_2?: string | number | null
    genders_2?: string | null
    class_occup_2?: string | null
    names_3?: string | null
    ages_3?: string | number | null
    genders_3?: string | null
    class_occup_3?: string | null
    names_4?: string | null
    ages_4?: string | number | null
    genders_4?: string | null
    class_occup_4?: string | null
    names_5?: string | null
    ages_5?: string | number | null
    genders_5?: string | null
    class_occup_5?: string | null
    sibling_remarks?: string | null
    created_at?: string | null
}

type ChildUniformRow = {
    record_id?: number | string
    eac_no?: string | number | null
    reg_no?: string | number | null
    shirtsize?: string | null
    knickersize?: string | null
    pant_skirtsize?: string | null
    chudidharsize?: string | null
    top_pantsize?: string | null
    footwearsize?: string | null
    uniform_updated?: string | null
    created_at?: string | null
}

type StudentStatus = 'Enrolled' | 'Left'

type EnrichedChildRow = ChildDataRow & {
    child_name: string
    child_status: StudentStatus
}

type EnrichedFamilyRow = ChildFamilyRow & {
    child_name: string
    child_status: StudentStatus
}

type EnrichedSiblingRow = ChildSiblingRow & {
    child_name: string
    child_status: StudentStatus
}

type EnrichedUniformRow = ChildUniformRow & {
    child_name: string
    child_status: StudentStatus
}

const tabs: Array<{ id: ReportTab; label: string; icon: typeof FileText }> = [
    { id: 'child', label: 'Child Data', icon: FileText },
    { id: 'family', label: 'Child Family', icon: Users },
    { id: 'sibling', label: 'Child Sibling', icon: BookOpen },
    { id: 'uniform', label: 'Child Uniform', icon: Shirt },
]

const studentFilters: Array<{ id: StudentFilter; label: string }> = [
    { id: 'all', label: 'All Students' },
    { id: 'enrolled', label: 'Enrolled' },
    { id: 'left', label: 'Left' },
]

const rowsPerPageOptions = [10, 25, 50]

const normalizeValue = (value: unknown) => String(value ?? '').trim().toLowerCase()

const joinName = (firstName?: string | null, lastName?: string | null) => {
    return [firstName, lastName].map((part) => part?.trim()).filter(Boolean).join(' ').trim()
}

const buildChildName = (row?: ChildDataRow | null) => {
    if (!row) return 'Unknown'
    return joinName(row.first_name, row.last_name) || String(row.reg_no ?? '').trim() || 'Unknown'
}

const normalizeDisplayValue = (value: unknown) => {
    const trimmed = String(value ?? '').trim()
    return trimmed || '-'
}

const isLeftStudent = (value: ChildDataRow['child_left']) => {
    if (typeof value === 'boolean') return value
    const normalized = normalizeValue(value)
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'left'
}

const getStudentStatus = (row?: ChildDataRow | null): StudentStatus => {
    return row && isLeftStudent(row.child_left) ? 'Left' : 'Enrolled'
}

const getRowSearchText = (tab: ReportTab, row: EnrichedChildRow | EnrichedFamilyRow | EnrichedSiblingRow | EnrichedUniformRow) => {
    const parts = [row.child_name, row.reg_no, row.eac_no]

    if (tab === 'child') {
        parts.push(row.school_name, row.school_category, row.class_std_text, row.gender)
    }

    if (tab === 'family') {
        const familyRow = row as EnrichedFamilyRow
        parts.push(
            familyRow.f_name,
            familyRow.m_name,
            familyRow.f_mobile,
            familyRow.m_mobile,
            familyRow.fmly_addr1,
            familyRow.fmly_addr2,
            familyRow.fmly_addr3,
            familyRow.fmly_pincode,
            familyRow.fmly_remarks,
        )
    }

    if (tab === 'sibling') {
        const siblingRow = row as EnrichedSiblingRow
        parts.push(
            siblingRow.names_1,
            siblingRow.names_2,
            siblingRow.names_3,
            siblingRow.names_4,
            siblingRow.names_5,
            siblingRow.class_occup_1,
            siblingRow.class_occup_2,
            siblingRow.class_occup_3,
            siblingRow.class_occup_4,
            siblingRow.class_occup_5,
            siblingRow.sibling_remarks,
        )
    }

    if (tab === 'uniform') {
        const uniformRow = row as EnrichedUniformRow
        parts.push(
            uniformRow.shirtsize,
            uniformRow.knickersize,
            uniformRow.pant_skirtsize,
            uniformRow.chudidharsize,
            uniformRow.top_pantsize,
            uniformRow.footwearsize,
            uniformRow.uniform_updated,
        )
    }

    return parts
        .map(normalizeValue)
        .filter(Boolean)
        .join(' ')
}

const sortRows = <T extends { child_name: string; reg_no?: string | number | null }>(rows: T[]) => {
    return [...rows].sort((left, right) => {
        const nameComparison = left.child_name.localeCompare(right.child_name, undefined, { sensitivity: 'base' })
        if (nameComparison !== 0) return nameComparison
        return normalizeValue(left.reg_no).localeCompare(normalizeValue(right.reg_no), undefined, { sensitivity: 'base' })
    })
}

export default function FieldVolunteerReportsPage() {
    const { profile, loading: authLoading, isAuthorized } = useRequireRole(['field_volunteer'])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = useState<ReportTab>('child')
    const [searchTerm, setSearchTerm] = useState('')
    const [studentFilter, setStudentFilter] = useState<StudentFilter>('all')
    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [childRows, setChildRows] = useState<EnrichedChildRow[]>([])
    const [familyRows, setFamilyRows] = useState<EnrichedFamilyRow[]>([])
    const [siblingRows, setSiblingRows] = useState<EnrichedSiblingRow[]>([])
    const [uniformRows, setUniformRows] = useState<EnrichedUniformRow[]>([])

    const roleInfo = ROLE_CONFIG.find((role) => role.value === 'field_volunteer')
    const eacNo = profile?.centre_eac_no ? String(profile.centre_eac_no).trim() : ''

    useEffect(() => {
        if (!isAuthorized || !profile) return

        const loadReports = async () => {
            if (!eacNo) {
                setError('No EAC number is assigned to this account.')
                return
            }

            setLoading(true)
            setError('')

            try {
                const [childrenResult, familyResult, siblingResult, uniformResult] = await Promise.all([
                    supabase.from('Child_Data').select('*').eq('eac_no', eacNo),
                    supabase.from('childfmly').select('*').eq('eac_no', eacNo),
                    supabase.from('childsibling').select('*').eq('eac_no', eacNo),
                    supabase.from('childuniform').select('*').eq('eac_no', eacNo),
                ])

                if (childrenResult.error) throw childrenResult.error
                if (familyResult.error) throw familyResult.error
                if (siblingResult.error) throw siblingResult.error
                if (uniformResult.error) throw uniformResult.error

                const children = (childrenResult.data ?? []) as ChildDataRow[]
                const childLookup = new Map<string, ChildDataRow>()

                children.forEach((row) => {
                    const regNo = normalizeValue(row.reg_no)
                    if (regNo) childLookup.set(regNo, row)
                })

                const enrichedChildren = children.map<EnrichedChildRow>((row) => ({
                    ...row,
                    child_name: buildChildName(row),
                    child_status: getStudentStatus(row),
                }))

                const enrichedFamily = ((familyResult.data ?? []) as ChildFamilyRow[]).map<EnrichedFamilyRow>((row) => {
                    const child = childLookup.get(normalizeValue(row.reg_no))
                    return {
                        ...row,
                        child_name: buildChildName(child),
                        child_status: getStudentStatus(child),
                    }
                })

                const enrichedSibling = ((siblingResult.data ?? []) as ChildSiblingRow[]).map<EnrichedSiblingRow>((row) => {
                    const child = childLookup.get(normalizeValue(row.reg_no))
                    return {
                        ...row,
                        child_name: buildChildName(child),
                        child_status: getStudentStatus(child),
                    }
                })

                const enrichedUniform = ((uniformResult.data ?? []) as ChildUniformRow[]).map<EnrichedUniformRow>((row) => {
                    const child = childLookup.get(normalizeValue(row.reg_no))
                    return {
                        ...row,
                        child_name: buildChildName(child),
                        child_status: getStudentStatus(child),
                    }
                })

                setChildRows(enrichedChildren)
                setFamilyRows(enrichedFamily)
                setSiblingRows(enrichedSibling)
                setUniformRows(enrichedUniform)
            } catch (loadError) {
                console.error('Failed to load volunteer reports:', loadError)
                const message = loadError instanceof Error ? loadError.message : 'Unable to load reports.'
                setError(message)
                setChildRows([])
                setFamilyRows([])
                setSiblingRows([])
                setUniformRows([])
            } finally {
                setLoading(false)
            }
        }

        loadReports()
    }, [eacNo, isAuthorized, profile])

    useEffect(() => {
        setPage(0)
    }, [activeTab, searchTerm, studentFilter, rowsPerPage])

    const activeRows = useMemo(() => {
        const sourceRows =
            activeTab === 'child'
                ? childRows
                : activeTab === 'family'
                    ? familyRows
                    : activeTab === 'sibling'
                        ? siblingRows
                        : uniformRows

        const normalizedSearch = searchTerm.trim().toLowerCase()

        const filteredRows = sourceRows.filter((row) => {
            const statusMatches =
                studentFilter === 'all' || row.child_status.toLowerCase() === studentFilter
            const searchMatches = !normalizedSearch || getRowSearchText(activeTab, row).includes(normalizedSearch)
            return statusMatches && searchMatches
        })

        return sortRows(filteredRows)
    }, [activeTab, childRows, familyRows, siblingRows, uniformRows, searchTerm, studentFilter])

    const visibleRows = useMemo(() => {
        const start = page * rowsPerPage
        return activeRows.slice(start, start + rowsPerPage)
    }, [activeRows, page, rowsPerPage])

    const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? 'Child Data'

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
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
                    <p className="text-slate-600">You don't have permission to access this page.</p>
                </div>
            </main>
        )
    }

    const renderChildDataTable = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600">
                    <tr>
                        <th className="px-4 py-3 text-left font-semibold">Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Reg No</th>
                        <th className="px-4 py-3 text-left font-semibold">Gender</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Admission Date</th>
                        <th className="px-4 py-3 text-left font-semibold">Class/Std</th>
                        <th className="px-4 py-3 text-left font-semibold">School</th>
                        <th className="px-4 py-3 text-left font-semibold">School Category</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {visibleRows.map((row) => (
                        <tr key={String(row.record_id ?? row.reg_no)} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{row.child_name}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.reg_no)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.gender)}</td>
                            <td className="px-4 py-3 text-slate-700">
                                <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.child_status === 'Enrolled'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                >
                                    {row.child_status}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.adm_date)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.class_std_text)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.school_name)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.school_category)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    const renderFamilyTable = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600">
                    <tr>
                        <th className="px-4 py-3 text-left font-semibold">Child Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Reg No</th>
                        <th className="px-4 py-3 text-left font-semibold">Father Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Mother Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Father Mobile</th>
                        <th className="px-4 py-3 text-left font-semibold">Mother Mobile</th>
                        <th className="px-4 py-3 text-left font-semibold">Address</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {visibleRows.map((row) => (
                        <tr key={String(row.record_id ?? row.reg_no)} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{row.child_name}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.reg_no)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.f_name)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.m_name)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.f_mobile)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.m_mobile)}</td>
                            <td className="px-4 py-3 text-slate-700">
                                {[row.fmly_addr1, row.fmly_addr2, row.fmly_addr3, row.fmly_pincode]
                                    .map(normalizeDisplayValue)
                                    .filter((value) => value !== '-')
                                    .join(', ') || '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    const renderSiblingTable = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600">
                    <tr>
                        <th className="px-4 py-3 text-left font-semibold">Child Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Reg No</th>
                        <th className="px-4 py-3 text-left font-semibold">Sibling Details</th>
                        <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {visibleRows.map((row) => {
                        const siblingDetails = [
                            row.names_1 ? `1. ${row.names_1}` : '',
                            row.names_2 ? `2. ${row.names_2}` : '',
                            row.names_3 ? `3. ${row.names_3}` : '',
                            row.names_4 ? `4. ${row.names_4}` : '',
                            row.names_5 ? `5. ${row.names_5}` : '',
                        ]
                            .filter(Boolean)
                            .join(' | ')

                        return (
                            <tr key={String(row.record_id ?? row.reg_no)} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-900">{row.child_name}</td>
                                <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.reg_no)}</td>
                                <td className="px-4 py-3 text-slate-700">{siblingDetails || '-'}</td>
                                <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.sibling_remarks)}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )

    const renderUniformTable = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600">
                    <tr>
                        <th className="px-4 py-3 text-left font-semibold">Child Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Reg No</th>
                        <th className="px-4 py-3 text-left font-semibold">Shirt</th>
                        <th className="px-4 py-3 text-left font-semibold">Knicker</th>
                        <th className="px-4 py-3 text-left font-semibold">Pant/Skirt</th>
                        <th className="px-4 py-3 text-left font-semibold">Chudidhar</th>
                        <th className="px-4 py-3 text-left font-semibold">Top/Pant</th>
                        <th className="px-4 py-3 text-left font-semibold">Footwear</th>
                        <th className="px-4 py-3 text-left font-semibold">Updated</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {visibleRows.map((row) => (
                        <tr key={String(row.record_id ?? row.reg_no)} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{row.child_name}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.reg_no)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.shirtsize)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.knickersize)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.pant_skirtsize)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.chudidharsize)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.top_pantsize)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.footwearsize)}</td>
                            <td className="px-4 py-3 text-slate-700">{normalizeDisplayValue(row.uniform_updated)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    return (
        <main className="min-h-screen bg-slate-50">
            <Navbar
                username={profile.username}
                role={profile.role!}
                roleLabel={roleInfo?.label ?? 'Field Volunteer'}
                roleColor={roleInfo?.color ?? 'bg-blue-100 text-blue-800'}
            />
            <Sidebar role="field_volunteer" />

            <PageContainer>
                <div className="p-8">
                    <div className="mx-auto max-w-7xl space-y-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Reports</p>
                                    <h1 className="mt-2 text-3xl font-bold text-slate-900">EAC Records</h1>
                                    <p className="mt-2 max-w-2xl text-slate-600">
                                        View and search records for Child Data, Child Family, Child Sibling, and Child Uniform within your assigned EAC.
                                    </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    <span className="block font-semibold text-slate-900">Assigned EAC</span>
                                    <span>{eacNo || 'Not assigned'}</span>
                                </div>
                            </div>
                        </div>

                        {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex flex-wrap gap-2">
                                    {tabs.map((tab) => {
                                        const Icon = tab.icon
                                        const isActive = activeTab === tab.id
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${isActive
                                                        ? 'border-slate-900 bg-slate-900 text-white'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <Icon className="h-4 w-4" />
                                                {tab.label}
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="grid gap-3 md:grid-cols-2 xl:min-w-[520px] xl:grid-cols-[minmax(0,1fr),180px]">
                                    <label className="relative block">
                                        <span className="sr-only">Search by name</span>
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="search"
                                            value={searchTerm}
                                            onChange={(event) => setSearchTerm(event.target.value)}
                                            placeholder="Search by name"
                                            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>

                                    <label className="relative block">
                                        <span className="sr-only">Student status filter</span>
                                        <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <select
                                            value={studentFilter}
                                            onChange={(event) => setStudentFilter(event.target.value as StudentFilter)}
                                            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        >
                                            {studentFilters.map((filter) => (
                                                <option key={filter.id} value={filter.id}>
                                                    {filter.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">{activeTabLabel}</span>
                                <span>{activeRows.length} matching records</span>
                                <span>Sorted alphabetically by name before pagination</span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                            {loading ? (
                                <div className="flex min-h-[360px] items-center justify-center">
                                    <LoadingSpinner size="lg" />
                                </div>
                            ) : activeRows.length === 0 ? (
                                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                                    <FileText className="h-10 w-10 text-slate-300" />
                                    <h2 className="mt-4 text-lg font-semibold text-slate-900">No records found</h2>
                                    <p className="mt-2 max-w-md text-sm text-slate-500">
                                        Try a different search or status filter, or confirm records exist for this EAC.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'child'
                                        ? renderChildDataTable()
                                        : activeTab === 'family'
                                            ? renderFamilyTable()
                                            : activeTab === 'sibling'
                                                ? renderSiblingTable()
                                                : renderUniformTable()}

                                    <div className="border-t border-slate-200">
                                        <TablePagination
                                            component="div"
                                            count={activeRows.length}
                                            page={page}
                                            onPageChange={(_, nextPage) => setPage(nextPage)}
                                            rowsPerPage={rowsPerPage}
                                            onRowsPerPageChange={(event) => setRowsPerPage(Number(event.target.value))}
                                            rowsPerPageOptions={rowsPerPageOptions}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </PageContainer>
        </main>
    )
}
