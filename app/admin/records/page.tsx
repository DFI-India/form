'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { getErrorMessage } from '../../../lib/errors'
import { toCsv } from '../../../lib/csv'
import { LoadingSpinner, Alert } from '../../components/UI'
import AdminShell from '../AdminShell'
import ChildProfilePanel, { type SectionKey } from './ChildProfilePanel'
import { SECTION_SCHEMA, sectionFields, type ChildSectionKey } from '../../../lib/childSections'
import { Search, Inbox, SlidersHorizontal, X, Pencil, Trash2, Download } from 'lucide-react'

type EntityType = SectionKey
type SortDirection = 'asc' | 'desc'

const PAGE_SIZE = 20

const TABS: { key: EntityType; label: string }[] = [
  { key: 'child_data', label: 'Personal' },
  { key: 'childfmly', label: 'Family' },
  { key: 'childsibling', label: 'Siblings' },
  { key: 'childuniform', label: 'Uniform' },
  { key: 'childleaving', label: 'Leaving' },
]

const TABLE_BY_ENTITY: Record<EntityType, string> = {
  child_data: 'Child_Data',
  childfmly: 'childfmly',
  childsibling: 'childsibling',
  childuniform: 'childuniform',
  childleaving: 'childleaving',
}

interface Column {
  key: string
  label: string
  width: number
  /** Right-aligned, monospaced: ids and numbers. */
  mono?: boolean
}

/**
 * Columns per tab.
 *
 * The section tabs take theirs from the shared field definitions, so a column
 * can't drift away from what the editor writes. Personal has no such schema, so
 * it lists the columns worth scanning and leaves the rest to the editor.
 */
const PERSONAL_COLUMNS: Column[] = [
  { key: 'gender', label: 'Gender', width: 70 },
  { key: 'dateofbirth', label: 'Date of birth', width: 96 },
  { key: 'class_std_text', label: 'Class', width: 88 },
  { key: 'village', label: 'Village', width: 110 },
  { key: 'district', label: 'District', width: 100 },
  { key: 'taluk', label: 'Taluk', width: 100 },
  { key: 'school_name', label: 'School', width: 150 },
  { key: 'adm_date', label: 'Admitted', width: 96 },
  { key: 'aadhar_no', label: 'Aadhaar', width: 120, mono: true },
  { key: 'blood_group', label: 'Blood group', width: 90 },
  { key: 'mother_tongue', label: 'Mother tongue', width: 110 },
]

const columnsFor = (entity: EntityType): Column[] => {
  if (entity === 'child_data') return PERSONAL_COLUMNS
  return sectionFields(entity as ChildSectionKey).map((f) => ({
    key: f.key,
    label: f.label,
    width: f.kind === 'textarea' ? 190 : f.kind === 'number' ? 90 : 130,
    mono: f.kind === 'number',
  }))
}

/** Group headings above the section columns, so 15 fields stay readable. */
const groupSpansFor = (entity: EntityType): { title: string; span: number }[] | null => {
  if (entity === 'child_data') return null
  const groups = SECTION_SCHEMA[entity as ChildSectionKey].groups
  return groups.map((g) => ({ title: g.title ?? '', span: g.fields.length }))
}

/** Only these reach the database; anything else would be ignored server-side. */
const SORTS = [
  { value: 'eac_no:asc', label: 'Centre, then Reg No' },
  { value: 'reg_no:asc', label: 'Reg No' },
  { value: 'first_name:asc', label: 'Name A–Z' },
  { value: 'village_name:asc', label: 'Centre village' },
  { value: 'created_at:desc', label: 'Recently added' },
]

const APPROVAL_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'unapproved', label: 'Not approved' },
  { value: 'Verified', label: 'Awaiting approval' },
  { value: 'Rejected', label: 'Sent back' },
  { value: 'Approved', label: 'Approved' },
]

const ENROLMENT_CHIPS = [
  { value: 'all', label: 'Everyone' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'left', label: 'Left' },
]

interface RecordRow {
  record_id: number
  eac_no: string | number
  reg_no?: string | number
  status?: string
  child_left?: boolean | string
  [key: string]: any
}

const txt = (value: unknown) => String(value ?? '').trim()

const hasLeft = (row: RecordRow) => row.child_left === true || String(row.child_left).toLowerCase() === 'true'

function approvalChipClass(status?: string) {
  switch (status) {
    case 'Approved':
      return 'bg-status-approved-bg text-status-approved-fg'
    case 'Verified':
      return 'bg-status-verified-bg text-status-verified-fg'
    case 'Rejected':
      return 'bg-status-returned-bg text-status-returned-fg'
    default:
      return 'bg-status-pending-bg text-status-pending-fg'
  }
}

const approvalLabel = (status?: string) =>
  status === 'Rejected' ? 'Sent back' : status === 'Verified' ? 'Awaiting' : status || 'Pending'

function cellValue(row: RecordRow, key: string): string {
  const raw = row[key]
  if (raw === null || raw === undefined || txt(raw) === '') return '—'
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  if (/date|_at$/.test(key)) return txt(raw).slice(0, 10)
  return txt(raw)
}

export default function AdminRecordsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [token, setToken] = useState<string | null>(null)
  const [entity, setEntity] = useState<EntityType>('child_data')
  const [rows, setRows] = useState<RecordRow[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [searchBy, setSearchBy] = useState<'name' | 'reg_no' | 'eac_no'>('name')
  const [approval, setApproval] = useState('all')
  const [enrollment, setEnrollment] = useState('all')
  const [eacNo, setEacNo] = useState('')
  const [village, setVillage] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [sort, setSort] = useState('created_at:desc')
  const [sortColumn, sortDirection] = sort.split(':') as [string, SortDirection]

  const [filterOptions, setFilterOptions] = useState<{
    eacNos: string[]
    villagesByEacNo: Record<string, string[]>
  }>({ eacNos: [], villagesByEacNo: {} })

  const [editing, setEditing] = useState<{ eacNo: string | number; regNo: string | number } | null>(null)
  const [deleting, setDeleting] = useState<RecordRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const columns = useMemo(() => columnsFor(entity), [entity])
  const groupSpans = useMemo(() => groupSpansFor(entity), [entity])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (!isAuthorized) return
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null))
  }, [isAuthorized])

  const villageOptions = useMemo(() => {
    if (eacNo) return filterOptions.villagesByEacNo[eacNo] || []
    return Array.from(new Set(Object.values(filterOptions.villagesByEacNo).flat())).sort((a, b) => a.localeCompare(b))
  }, [eacNo, filterOptions])

  const fetchRows = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        entityType: entity,
        approval,
        enrollment,
        search,
        searchBy,
        sortColumn,
        sortDirection,
        page: String(page),
        limit: String(PAGE_SIZE),
        includeFilterOptions: '1',
      })
      if (eacNo) params.set('eacNoFilter', eacNo)
      if (village) params.set('villageFilter', village)

      const res = await fetch(`/api/admin/records/list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load records')

      setRows(json.data || [])
      setTotal(json.total || 0)
      setSummary(json.statusSummary || {})
      if (json.filterOptions) setFilterOptions(json.filterOptions)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load records.'))
    } finally {
      setLoading(false)
    }
  }, [token, entity, approval, enrollment, search, searchBy, sortColumn, sortDirection, page, eacNo, village])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  useEffect(() => {
    setPage(1)
  }, [entity, approval, enrollment, search, searchBy, eacNo, village])

  // The village list is per centre, so a stale pick would return nothing.
  useEffect(() => {
    if (village && !villageOptions.includes(village)) setVillage('')
  }, [village, villageOptions])

  const handleDelete = async () => {
    if (!token || !deleting) return
    setDeleteBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/records/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entityType: entity, entityId: deleting.record_id, entityKey: 'record_id' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not delete this record')
      setDeleting(null)
      setNotice('Record deleted.')
      setTimeout(() => setNotice(''), 3000)
      fetchRows()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not delete this record.'))
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      const table = TABLE_BY_ENTITY[entity]
      const all: Record<string, any>[] = []
      const size = 1000
      for (let from = 0; ; from += size) {
        const { data, error: pageError } = await supabase
          .from(table)
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + size - 1)
        if (pageError) throw pageError
        all.push(...(data || []))
        if (!data || data.length < size) break
      }
      if (all.length === 0) throw new Error('There is nothing to export in this table.')

      const headerSet = new Set<string>()
      for (const row of all) Object.keys(row).forEach((k) => headerSet.add(k))
      const headers = Array.from(headerSet)

      const csv = toCsv(
        headers,
        all.map((row) => headers.map((h) => (typeof row[h] === 'object' && row[h] !== null ? JSON.stringify(row[h]) : row[h])))
      )
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${table}-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setNotice(`Exported ${all.length.toLocaleString()} rows.`)
      setTimeout(() => setNotice(''), 3000)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not export this table.'))
    } finally {
      setExporting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthorized || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-4">
        <div className="max-w-md rounded-lg border border-rule p-6 text-center">
          <h1 className="mb-2 text-2xl font-semibold">Access denied</h1>
          <p className="text-ink-muted">You don&apos;t have permission to view this page.</p>
        </div>
      </main>
    )
  }

  const selectClass =
    'h-[34px] rounded-md border border-rule-strong bg-surface px-2.5 text-[13.5px] text-ink outline-none focus:border-blue-500'

  const chipRow = (
    label: string,
    options: { value: string; label: string }[],
    current: string,
    onPick: (value: string) => void
  ) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-[68px] shrink-0 text-[12px] font-medium text-ink-faint">{label}</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onPick(option.value)}
          className={`h-[30px] rounded-md px-2.5 text-[13.5px] transition-colors ${
            current === option.value
              ? 'bg-ink text-surface'
              : 'border border-rule-strong text-ink hover:bg-surface-hover'
          }`}
        >
          {option.label}
          {option.value !== 'all' && summary[option.value] !== undefined && (
            <span className="ml-1.5 font-mono text-[12px] opacity-70">{summary[option.value]}</span>
          )}
        </button>
      ))}
    </div>
  )

  return (
    <AdminShell active="/admin/records" breadcrumb={['Manage records', 'All records']} username={profile.username}>
      <div className="px-6 pb-10 pt-5">
        {error && <Alert type="error" message={error} className="mb-4" />}
        {notice && <Alert type="success" message={notice} className="mb-4" />}

        <div className="mb-4 flex items-center justify-between gap-5">
          <h1 className="text-xl font-semibold tracking-tight">All records</h1>
          <div className="flex items-center gap-3">
            <span className="text-[13.5px] text-ink-faint">
              {loading ? 'Counting…' : `${total.toLocaleString()} ${total === 1 ? 'row' : 'rows'}`}
            </span>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex h-[34px] items-center gap-1.5 rounded-md border border-rule-strong px-2.5 text-[13.5px] transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              <Download className="h-[13px] w-[13px] text-ink-muted" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* One tab per table */}
        <div className="mb-3 flex gap-1 border-b border-rule">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setEntity(tab.key)}
              className={`-mb-px h-[36px] border-b-2 px-3 text-[14px] transition-colors ${
                entity === tab.key
                  ? 'border-ink font-medium text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-col gap-2">
          {chipRow('Approval', APPROVAL_CHIPS, approval, setApproval)}
          {chipRow('Enrolment', ENROLMENT_CHIPS, enrollment, setEnrollment)}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(searchInput.trim())
            }}
            className="flex h-[34px] w-[260px] items-center gap-2 rounded-md border border-rule-strong px-2.5 focus-within:border-blue-500"
          >
            <Search className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchBy === 'name' ? 'Child name' : searchBy === 'reg_no' ? 'Reg No' : 'EAC No'}
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint"
            />
          </form>

          <select value={searchBy} onChange={(e) => setSearchBy(e.target.value as typeof searchBy)} className={selectClass}>
            <option value="name">by name</option>
            <option value="reg_no">by Reg No</option>
            <option value="eac_no">by EAC No</option>
          </select>

          <select value={eacNo} onChange={(e) => setEacNo(e.target.value)} className={selectClass}>
            <option value="">All centres</option>
            {filterOptions.eacNos.map((eac) => (
              <option key={eac} value={eac}>
                EAC {eac}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex h-[34px] items-center gap-1.5 rounded-md border border-rule-strong px-2.5 text-[13.5px] transition-colors hover:bg-surface-hover"
          >
            <SlidersHorizontal className="h-[13px] w-[13px] text-ink-muted" />
            More filters
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[13px] text-ink-faint">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showMore && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-rule bg-surface-sunken px-3 py-2.5">
            <select value={village} onChange={(e) => setVillage(e.target.value)} className={selectClass}>
              <option value="">Any centre village</option>
              {villageOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setApproval('all')
                setEnrollment('all')
                setEacNo('')
                setVillage('')
                setSearch('')
                setSearchInput('')
                setSort('created_at:desc')
              }}
              className="h-[34px] rounded-md px-2.5 text-[13.5px] text-ink-muted transition-colors hover:bg-surface-hover"
            >
              Reset all
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-md border border-rule">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                {groupSpans && (
                  <tr className="bg-surface-sunken">
                    <th className="sticky left-0 z-20 border-b border-r border-rule bg-surface-sunken" />
                    {groupSpans.map((group, i) => (
                      <th
                        key={i}
                        colSpan={group.span}
                        className="border-b border-l border-rule px-2 py-1 text-left text-[12px] font-medium text-ink-faint"
                      >
                        {group.title}
                      </th>
                    ))}
                    <th className="border-b border-rule" colSpan={2} />
                  </tr>
                )}
                <tr className="bg-surface-sunken">
                  <th className="sticky left-0 z-20 w-[190px] min-w-[190px] border-b border-r border-rule bg-surface-sunken px-3 py-2 text-left text-[12.5px] font-medium text-ink-muted">
                    Child
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      style={{ minWidth: column.width }}
                      className="border-b border-rule px-2 py-2 text-left text-[12.5px] font-medium text-ink-muted"
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="border-b border-rule px-2 py-2 text-left text-[12.5px] font-medium text-ink-muted">Approval</th>
                  <th className="w-[72px] border-b border-rule px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length + 3} className="p-12 text-center">
                      <LoadingSpinner size="lg" />
                      <p className="mt-3 text-[14px] text-ink-muted">Loading records…</p>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 3} className="p-12 text-center">
                      <Inbox className="mx-auto mb-3 h-10 w-10 text-rule-strong" />
                      <p className="text-[14.5px] text-ink-muted">No records match these filters</p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const name =
                      [row.first_name, row.last_name].filter(Boolean).join(' ') ||
                      txt(row.child_name) ||
                      txt(row.trainee_name)
                    const canOpen = row.eac_no !== null && row.eac_no !== undefined && row.reg_no !== null && row.reg_no !== undefined

                    return (
                      <tr key={row.record_id} className="group border-b border-rule-faint last:border-0 hover:bg-surface-hover">
                        <td className="sticky left-0 z-10 w-[190px] min-w-[190px] border-r border-rule bg-surface px-3 py-1.5 group-hover:bg-surface-hover">
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="min-w-0 flex-1 truncate">{name || '—'}</span>
                            {entity === 'child_data' && hasLeft(row) && (
                              <span className="shrink-0 rounded bg-status-inactive-bg px-1 py-px text-[11.5px] text-status-inactive-fg">
                                Left
                              </span>
                            )}
                          </span>
                          <span className="block whitespace-nowrap font-mono text-[12px] text-ink-faint">
                            EAC {txt(row.eac_no) || '—'} · Reg {txt(row.reg_no) || '—'}
                          </span>
                        </td>
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={`px-2 py-1.5 text-ink-muted ${column.mono ? 'font-mono text-[13px]' : ''}`}
                          >
                            <span className="block max-w-[260px] truncate" title={cellValue(row, column.key)}>
                              {cellValue(row, column.key)}
                            </span>
                          </td>
                        ))}
                        <td className="px-2 py-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${approvalChipClass(row.status)}`}>
                            {approvalLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={!canOpen}
                              onClick={() => canOpen && setEditing({ eacNo: row.eac_no, regNo: row.reg_no! })}
                              title={canOpen ? 'Edit' : 'This row has no Reg No, so it belongs to no child'}
                              aria-label="Edit"
                              className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink disabled:opacity-30"
                            >
                              <Pencil className="h-[13px] w-[13px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(row)}
                              title="Delete"
                              aria-label="Delete"
                              className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-status-returned-fg"
                            >
                              <Trash2 className="h-[13px] w-[13px]" />
                            </button>
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && rows.length > 0 && (
            <div className="flex items-center justify-between border-t border-rule px-4 py-2.5">
              <span className="text-[13.5px] text-ink-faint">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-[32px] rounded-md border border-rule-strong px-2.5 text-[13.5px] transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-[13.5px] text-ink-muted">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-[32px] rounded-md border border-rule-strong px-2.5 text-[13.5px] transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleting(null)}>
          <div className="w-full max-w-md rounded-lg border border-rule bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-[16px] font-semibold">Delete this record?</h2>
              <button type="button" onClick={() => setDeleting(null)} className="rounded p-1 text-ink-faint hover:bg-surface-hover" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-[14px] leading-relaxed text-ink-muted">
              This permanently removes the {TABS.find((t) => t.key === entity)?.label.toLowerCase()} row for EAC{' '}
              {txt(deleting.eac_no) || '—'}, Reg No {txt(deleting.reg_no) || '—'}. It cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="h-[36px] rounded-md border border-rule-strong px-3 text-[14px] transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteBusy}
                className="h-[36px] rounded-md bg-status-returned-fg px-3 text-[14px] font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && token && (
        <ChildProfilePanel
          eacNo={editing.eacNo}
          regNo={editing.regNo}
          token={token}
          initialSection={entity}
          onClose={() => setEditing(null)}
          onSaved={fetchRows}
        />
      )}
    </AdminShell>
  )
}
