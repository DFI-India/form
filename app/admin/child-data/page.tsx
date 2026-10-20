'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { getErrorMessage } from '../../../lib/errors'
import { hasAllDetails } from '../../../lib/childSections'
import { LoadingSpinner, Alert } from '../../components/UI'
import AdminShell from '../AdminShell'
import ChildProfilePanel, { type SectionKey as ProfileSection } from '../records/ChildProfilePanel'
import { ChevronRight, ChevronDown, Search, Inbox, SlidersHorizontal, X, Pencil, MapPin, Plus } from 'lucide-react'

type SectionKey = 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving'

const PAGE_SIZE = 20

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'childfmly', label: 'Family' },
  { key: 'childsibling', label: 'Siblings' },
  { key: 'childuniform', label: 'Uniform' },
  { key: 'childleaving', label: 'Leaving' },
]



const SORTS = [
  { value: 'review', label: 'Needs attention first' },
  { value: 'register', label: 'Centre, then Reg No' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'age_desc', label: 'Oldest first' },
  { value: 'age_asc', label: 'Youngest first' },
  { value: 'recent', label: 'Recently added' },
  { value: 'least_complete', label: 'Least complete first' },
]

/**
 * Filter state.
 *
 * `approval` and `enrollment` are deliberately separate axes: a child who left
 * still has an approval state, and an approved record can belong to a child who
 * left years ago. Folding one into the other is what made the old screen lie.
 */
interface Filters {
  approval: string
  enrollment: string
  missing: string
  gender: string
  classStd: string
  village: string
  childVillage: string
}

const BASE_FILTERS: Filters = {
  approval: 'all',
  enrollment: 'all',
  missing: 'none',
  gender: 'all',
  classStd: '',
  village: '',
  childVillage: '',
}

/** Each group sets exactly one key, so the three compose instead of resetting each other. */
const APPROVAL_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'unapproved', label: 'Not approved' },
  { value: 'Verified', label: 'Awaiting approval' },
  { value: 'Rejected', label: 'Sent back' },
  { value: 'approved_pending', label: 'Approved, data pending' },
  { value: 'Approved', label: 'Approved' },
]

const ENROLMENT_CHIPS = [
  { value: 'all', label: 'Everyone' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'left', label: 'Left' },
]

const RECORD_CHIPS = [
  { value: 'none', label: 'Any' },
  { value: 'any', label: 'Missing details' },
  { value: 'dob', label: 'No date of birth' },
]

interface ChildRow {
  record_id: number
  eac_no: string | number
  reg_no: string | number
  first_name?: string
  last_name?: string
  gender?: string
  dateofbirth?: string
  class_std_text?: string
  village?: string
  village_name?: string
  district?: string
  taluk?: string
  photo_link?: string
  status?: string
  child_left?: boolean | string
  [key: string]: any
}

const pairKey = (eac: unknown, reg: unknown) => `${String(eac)}::${String(reg)}`

/** Imported place names still carry stray whitespace and newlines. */
const txt = (value: unknown) => String(value ?? '').trim()

const hasLeft = (row: ChildRow) =>
  row.child_left === true || String(row.child_left).toLowerCase() === 'true'

type Sections = Partial<Record<SectionKey, boolean>> | undefined

/** Leaving counts only for a child marked as left; see lib/childSections. */
const isComplete = (sections: Sections, left: boolean) => hasAllDetails(left, sections)

/**
 * Approval state as the screen shows it.
 *
 * `approved_pending` is the case the old screen had no way to say: signed off,
 * but the family/siblings/uniform sections were never filled in.
 */
type Bucket = 'returned' | 'pending' | 'awaiting' | 'approved_pending' | 'approved'

function approvalBucket(status: string | undefined, sections: Sections, left: boolean): Bucket {
  if (status === 'Rejected') return 'returned'
  if (status === 'Verified') return 'awaiting'
  if (status === 'Approved') return isComplete(sections, left) ? 'approved' : 'approved_pending'
  return 'pending'
}

/**
 * "Rejected" reads as a dead end; in the field it means "come back to this".
 *
 * `approved_pending` keeps the green Approved chip — the record *is* signed off
 * — and hangs an amber marker off it, so it can never be misread as "not
 * approved" the way a plain amber chip would be.
 */
const BUCKET_META: Record<
  Bucket,
  { label: string; groupLabel?: string; chip: string; flag?: string; heading: string }
> = {
  returned: {
    label: 'Sent back',
    chip: 'bg-status-returned-bg text-status-returned-fg',
    heading: 'Sent back for correction',
  },
  awaiting: {
    label: 'Awaiting approval',
    chip: 'bg-status-verified-bg text-status-verified-fg',
    heading: 'Verified, waiting for an admin to sign off',
  },
  pending: {
    label: 'Pending',
    chip: 'bg-status-pending-bg text-status-pending-fg',
    heading: 'Not submitted for approval yet',
  },
  approved_pending: {
    label: 'Approved',
    groupLabel: 'Approved · data pending',
    chip: 'bg-status-approved-bg text-status-approved-fg',
    flag: 'Data entry still pending',
    heading: 'Approved, but family, siblings or uniform were never filled in',
  },
  approved: {
    label: 'Approved',
    chip: 'bg-status-approved-bg text-status-approved-fg',
    heading: 'Approved, all sections filled in',
  },
}

function ApprovalChip({ bucket, verbose = false }: { bucket: Bucket; verbose?: boolean }) {
  const meta = BUCKET_META[bucket]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${meta.chip}`}>
        {verbose ? meta.groupLabel ?? meta.label : meta.label}
      </span>
      {meta.flag && !verbose && (
        <span
          title={meta.flag}
          aria-label={meta.flag}
          className="h-[6px] w-[6px] shrink-0 rounded-full bg-status-pending-fg"
        />
      )}
    </span>
  )
}

function ageFrom(dob?: string): string {
  if (!dob) return '—'
  const born = new Date(dob)
  if (Number.isNaN(born.getTime())) return '—'
  const now = new Date()
  let age = now.getFullYear() - born.getFullYear()
  const monthDiff = now.getMonth() - born.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1
  return age >= 0 && age < 120 ? String(age) : '—'
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

/**
 * Seed a filter from the query string so links like
 * `/admin/child-data?eacNo=104` land pre-filtered. Read from `window` rather
 * than `useSearchParams` to avoid forcing a Suspense boundary on the page; this
 * is a client component, so the value is available on first render.
 */
function initialParam(key: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(key) ?? ''
}

/** Photo with an initials fallback, used at both sizes. */
function Photo({
  url,
  name,
  size,
  broken,
  onBroken,
}: {
  url?: string
  name: string
  size: number
  broken: Set<string>
  onBroken: (url: string) => void
}) {
  const usable = url && !broken.has(url)
  const style = { width: size, height: size }

  if (!usable) {
    return (
      <span
        style={style}
        className="flex shrink-0 items-center justify-center rounded-full bg-accent-bg font-semibold text-accent-fg"
        aria-hidden
      >
        <span style={{ fontSize: Math.max(9, Math.round(size * 0.38)) }}>{initials(name)}</span>
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URLs, no loader configured
    <img
      src={url}
      alt={`Photo of ${name}`}
      style={style}
      loading="lazy"
      onError={() => onBroken(url!)}
      className="shrink-0 rounded-full border border-rule object-cover"
    />
  )
}

/** District › Taluk › Village, skipping whatever the record doesn't have. */
function PlaceTrail({ row, className = '' }: { row: ChildRow; className?: string }) {
  const parts = [row.district, row.taluk, row.village || row.village_name].map(txt).filter(Boolean)

  if (parts.length === 0) {
    return <span className={`text-[11.5px] text-ink-faint ${className}`}>No place recorded</span>
  }

  return (
    <span className={`flex min-w-0 items-center gap-1 text-[11.5px] text-ink-muted ${className}`}>
      <MapPin className="h-3 w-3 shrink-0 text-ink-faint" />
      <span className="truncate">{parts.join(' › ')}</span>
    </span>
  )
}

export default function ChildDataPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [token, setToken] = useState<string | null>(null)
  const [rows, setRows] = useState<ChildRow[]>([])
  const [completeness, setCompleteness] = useState<Record<string, Record<string, boolean>>>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [eacNo, setEacNo] = useState(() => initialParam('eacNo'))
  const [filters, setFilters] = useState<Filters>(() => {
    const missing = initialParam('missing')
    return missing ? { ...BASE_FILTERS, missing } : BASE_FILTERS
  })
  const [sort, setSort] = useState('review')
  const [showMore, setShowMore] = useState(false)

  const [facets, setFacets] = useState<{
    eacNos: string[]
    villages: string[]
    childVillages: string[]
    classes: string[]
  }>({ eacNos: [], villages: [], childVillages: [], classes: [] })

  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, any> | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set())

  /** The child currently open in the editor, if any. */
  const [editing, setEditing] = useState<{
    eacNo: string | number
    regNo: string | number
    section: ProfileSection
  } | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const markPhotoBroken = useCallback((url: string) => {
    setBrokenPhotos((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))
  }, [])

  useEffect(() => {
    if (!isAuthorized) return
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null))
  }, [isAuthorized])

  const activeFilterChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = []
    if (eacNo) chips.push({ label: `Centre ${eacNo}`, clear: () => setEacNo('') })
    if (filters.village)
      chips.push({ label: `Centre village: ${filters.village}`, clear: () => setFilters((f) => ({ ...f, village: '' })) })
    if (filters.childVillage)
      chips.push({
        label: `Lives in ${filters.childVillage}`,
        clear: () => setFilters((f) => ({ ...f, childVillage: '' })),
      })
    if (filters.classStd) chips.push({ label: filters.classStd, clear: () => setFilters((f) => ({ ...f, classStd: '' })) })
    if (filters.gender !== 'all') chips.push({ label: filters.gender, clear: () => setFilters((f) => ({ ...f, gender: 'all' })) })
    if (search) chips.push({ label: `“${search}”`, clear: () => { setSearch(''); setSearchInput('') } })
    return chips
  }, [eacNo, filters, search])

  const fetchRows = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        search,
        eacNo,
        village: filters.village,
        childVillage: filters.childVillage,
        enrollment: filters.enrollment,
        approval: filters.approval,
        gender: filters.gender,
        classStd: filters.classStd,
        missing: filters.missing,
        sort,
        page: String(page),
        limit: String(PAGE_SIZE),
        includeFacets: '1',
      })

      const res = await fetch(`/api/admin/child-data/list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load children')

      setRows(json.data || [])
      setCompleteness(json.completeness || {})
      setTotal(json.total || 0)
      if (json.facets) setFacets(json.facets)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load children.'))
    } finally {
      setLoading(false)
    }
  }, [token, search, eacNo, filters, sort, page])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1)
  }, [search, eacNo, filters, sort])

  const loadDetail = useCallback(
    async (eac: string | number, reg: string | number) => {
      setDetailLoading(true)
      try {
        if (!token) throw new Error('Session expired — please sign in again.')
        const params = new URLSearchParams({ eacNo: String(eac), regNo: String(reg) })
        const res = await fetch(`/api/admin/records/child-profile?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not load this child')
        setDetail(json.data)
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Could not load this child.'))
        setExpanded(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [token]
  )

  const toggleRow = (row: ChildRow) => {
    const key = pairKey(row.eac_no, row.reg_no)
    if (expanded === key) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(key)
    setDetail(null)
    loadDetail(row.eac_no, row.reg_no)
  }

  /** After an edit, both the row and the open detail can be stale. */
  const handleSaved = useCallback(() => {
    fetchRows()
    if (editing) loadDetail(editing.eacNo, editing.regNo)
  }, [fetchRows, loadDetail, editing])

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
    'h-[30px] rounded-md border border-rule-strong bg-surface px-2.5 text-[12.5px] text-ink outline-none focus:border-blue-500'

  const chipRow = (
    label: string,
    options: { value: string; label: string }[],
    current: string,
    onPick: (value: string) => void
  ) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-[68px] shrink-0 text-[11px] font-medium text-ink-faint">{label}</span>
      {options.map((option) => {
        const isActive = current === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            className={`h-[26px] rounded-md px-2.5 text-[12.5px] transition-colors ${
              isActive ? 'bg-ink text-surface' : 'border border-rule-strong text-ink hover:bg-surface-hover'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )

  // Group headings only make sense when the sort actually groups the rows.
  const grouped = sort === 'review'
  let lastBucket: Bucket | null = null

  return (
    <AdminShell
      active="/admin/child-data"
      breadcrumb={['Manage records', 'Child data']}
      username={profile.username}
    >
      <div className="px-6 pb-10 pt-5">
        {error && <Alert type="error" message={error} className="mb-4" />}

        <div className="mb-4 flex items-center justify-between gap-5">
          <h1 className="text-xl font-semibold tracking-tight">Child data</h1>
          <span className="text-[12.5px] text-ink-faint">
            {loading ? 'Counting…' : `${total.toLocaleString()} ${total === 1 ? 'child' : 'children'}`}
          </span>
        </div>

        {/* Three independent axes. Picking one never clears the others. */}
        <div className="mb-3 flex flex-col gap-2">
          {chipRow('Approval', APPROVAL_CHIPS, filters.approval, (v) =>
            setFilters((f) => ({ ...f, approval: v }))
          )}
          {chipRow('Enrolment', ENROLMENT_CHIPS, filters.enrollment, (v) =>
            setFilters((f) => ({ ...f, enrollment: v }))
          )}
          {chipRow('Records', RECORD_CHIPS, filters.missing, (v) =>
            setFilters((f) => ({ ...f, missing: v }))
          )}
        </div>

        {/* Search, centre, sort */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(searchInput.trim())
            }}
            className="flex h-[30px] w-[290px] items-center gap-2 rounded-md border border-rule-strong px-2.5 focus-within:border-blue-500"
          >
            <Search className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, Reg No or Aadhaar"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-ink-faint"
            />
          </form>

          <select value={eacNo} onChange={(e) => setEacNo(e.target.value)} className={selectClass}>
            <option value="">All centres</option>
            {facets.eacNos.map((eac) => (
              <option key={eac} value={eac}>
                EAC {eac}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={`flex h-[30px] items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] transition-colors ${
              showMore ? 'border-rule-strong bg-surface-hover' : 'border-rule-strong hover:bg-surface-hover'
            }`}
          >
            <SlidersHorizontal className="h-[13px] w-[13px] text-ink-muted" />
            More filters
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-ink-faint">Sort</span>
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
            <select
              value={filters.childVillage}
              onChange={(e) => setFilters((f) => ({ ...f, childVillage: e.target.value }))}
              className={selectClass}
            >
              <option value="">Any child&apos;s village</option>
              {facets.childVillages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={filters.village}
              onChange={(e) => setFilters((f) => ({ ...f, village: e.target.value }))}
              className={selectClass}
            >
              <option value="">Any centre village</option>
              {facets.villages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={filters.classStd}
              onChange={(e) => setFilters((f) => ({ ...f, classStd: e.target.value }))}
              className={selectClass}
            >
              <option value="">Any class</option>
              {facets.classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filters.gender}
              onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}
              className={selectClass}
            >
              <option value="all">Any gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setFilters(BASE_FILTERS)
                setEacNo('')
                setSearch('')
                setSearchInput('')
              }}
              className="h-[30px] rounded-md px-2.5 text-[12.5px] text-ink-muted transition-colors hover:bg-surface-hover"
            >
              Reset all
            </button>
          </div>
        )}

        {activeFilterChips.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.clear}
                className="flex h-[24px] items-center gap-1.5 rounded bg-surface-hover px-2 text-[12px] text-ink transition-colors hover:bg-rule"
              >
                {chip.label}
                <X className="h-3 w-3 text-ink-faint" />
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-md border border-rule">
          <div className="flex h-[34px] items-center gap-3 border-b border-rule bg-surface-sunken px-3">
            <span className="w-4" />
            <span className="w-[26px]" />
            <span className="flex-1 text-[11.5px] font-medium text-ink-muted">Name</span>
            <span className="w-14 text-[11.5px] font-medium text-ink-muted">EAC</span>
            <span className="w-12 text-[11.5px] font-medium text-ink-muted">Reg</span>
            <span className="hidden w-[64px] text-[11.5px] font-medium text-ink-muted xl:block">Gender</span>
            <span className="w-10 text-[11.5px] font-medium text-ink-muted">Age</span>
            <span className="hidden w-[76px] text-[11.5px] font-medium text-ink-muted lg:block">Class</span>
            <span className="hidden w-[104px] text-[11.5px] font-medium text-ink-muted lg:block">Village</span>
            <span className="w-[78px] text-[11.5px] font-medium text-ink-muted">Record</span>
            <span className="w-[72px] text-[11.5px] font-medium text-ink-muted">Enrolment</span>
            <span className="w-[104px] text-[11.5px] font-medium text-ink-muted">Approval</span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-3 text-[13px] text-ink-muted">Loading children…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox className="mx-auto mb-3 h-10 w-10 text-rule-strong" />
              <p className="text-[13.5px] text-ink-muted">No children match these filters</p>
            </div>
          ) : (
            rows.map((row) => {
              const key = pairKey(row.eac_no, row.reg_no)
              const isOpen = expanded === key
              const sections = completeness[key]
              const left = hasLeft(row)
              const bucket = approvalBucket(row.status, sections, left)
              const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed'

              const showHeading = grouped && bucket !== lastBucket
              if (grouped) lastBucket = bucket

              return (
                <div key={key}>
                  {showHeading && (
                    <div className="flex items-center gap-2 border-b border-rule bg-surface-sunken px-3 py-1.5">
                      <ApprovalChip bucket={bucket} verbose />
                      <span className="text-[11.5px] text-ink-muted">{BUCKET_META[bucket].heading}</span>
                    </div>
                  )}

                  <div className={isOpen ? 'border-b border-rule-faint bg-surface-sunken' : ''}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleRow(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleRow(row)
                        }
                      }}
                      className={`flex h-[40px] cursor-pointer items-center gap-3 px-3 transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 ${
                        isOpen ? '' : 'border-b border-rule-faint'
                      }`}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-[14px] w-4 shrink-0 text-ink-muted" />
                      ) : (
                        <ChevronRight className="h-[14px] w-4 shrink-0 text-rule-strong" />
                      )}
                      <span className="flex w-[26px] justify-center">
                        <Photo
                          url={row.photo_link}
                          name={name}
                          size={24}
                          broken={brokenPhotos}
                          onBroken={markPhotoBroken}
                        />
                      </span>
                      <span className={`flex-1 truncate text-[13px] ${isOpen ? 'font-semibold' : ''}`}>{name}</span>
                      <span className="w-14 font-mono text-[12px] text-ink-muted">{String(row.eac_no ?? '—')}</span>
                      <span className="w-12 font-mono text-[12px] text-ink-muted">{String(row.reg_no ?? '—')}</span>
                      <span className="hidden w-[64px] text-[12.5px] text-ink-muted xl:block">{row.gender || '—'}</span>
                      <span className="w-10 text-[12.5px] text-ink-muted">{ageFrom(row.dateofbirth)}</span>
                      <span className="hidden w-[76px] truncate text-[12.5px] text-ink-muted lg:block">
                        {row.class_std_text || '—'}
                      </span>
                      <span
                        className="hidden w-[104px] truncate text-[12.5px] text-ink-muted lg:block"
                        title={[row.district, row.taluk, row.village || row.village_name].map(txt).filter(Boolean).join(' › ')}
                      >
                        {txt(row.village) || txt(row.village_name) || '—'}
                      </span>
                      <span className="flex w-[78px] gap-[3px]">
                        {/* Personal always exists — the row is the personal record. */}
                        <span title="Personal" className="h-[5px] w-[11px] rounded-sm bg-meter-filled" />
                        {SECTIONS.map((section) => (
                          <span
                            key={section.key}
                            title={`${section.label}: ${sections?.[section.key] ? 'recorded' : 'not recorded'}`}
                            className={`h-[5px] w-[11px] rounded-sm ${
                              sections?.[section.key] ? 'bg-meter-filled' : 'bg-meter-empty'
                            }`}
                          />
                        ))}
                      </span>
                      <span className="w-[72px]">
                        {left ? (
                          <span className="rounded bg-status-inactive-bg px-1.5 py-0.5 text-[11px] font-medium text-status-inactive-fg">
                            Left
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-ink-faint">Enrolled</span>
                        )}
                      </span>
                      <span className="w-[104px]">
                        <ApprovalChip bucket={bucket} />
                      </span>
                    </div>

                    {isOpen && (
                      <div className="border-b border-rule-faint px-3 pb-4 pl-10 pt-3">
                        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-rule bg-surface p-3">
                          <Photo
                            url={row.photo_link}
                            name={name}
                            size={64}
                            broken={brokenPhotos}
                            onBroken={markPhotoBroken}
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="truncate text-[14px] font-semibold">{name}</span>
                            <span className="font-mono text-[11.5px] text-ink-muted">
                              EAC {String(row.eac_no ?? '—')} · Reg No {String(row.reg_no ?? '—')}
                            </span>
                            <PlaceTrail row={row} />
                            {txt(row.village) && txt(row.village_name) && txt(row.village) !== txt(row.village_name) && (
                              <span className="text-[11px] text-ink-faint">
                                Centre village: {txt(row.village_name)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ApprovalChip bucket={bucket} verbose />
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                left
                                  ? 'bg-status-inactive-bg text-status-inactive-fg'
                                  : 'bg-surface-hover text-ink-muted'
                              }`}
                            >
                              {left ? 'Left' : 'Enrolled'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditing({ eacNo: row.eac_no, regNo: row.reg_no, section: 'child_data' })
                              }}
                              className="flex h-[28px] items-center gap-1.5 rounded-md bg-ink px-2.5 text-[12.5px] font-medium text-surface transition-opacity hover:opacity-90"
                            >
                              <Pencil className="h-[13px] w-[13px]" />
                              Edit
                            </button>
                          </div>
                        </div>

                        {detailLoading ? (
                          <p className="py-4 text-[12.5px] text-ink-muted">Loading sections…</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {SECTIONS.map((section) => {
                              const data = detail?.[section.key]

                              const editButton = (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditing({
                                      eacNo: row.eac_no,
                                      regNo: row.reg_no,
                                      section: section.key as ProfileSection,
                                    })
                                  }}
                                  className="ml-auto rounded p-0.5 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
                                  title={`Edit ${section.label.toLowerCase()}`}
                                  aria-label={`Edit ${section.label.toLowerCase()}`}
                                >
                                  <Pencil className="h-[12px] w-[12px]" />
                                </button>
                              )

                              if (!data) {
                                return (
                                  <div
                                    key={section.key}
                                    className="flex flex-col gap-2 rounded-md border border-dashed border-rule-strong bg-surface p-3"
                                  >
                                    <span className="text-[11.5px] font-semibold text-ink-muted">{section.label}</span>
                                    <span className="text-[11.5px] leading-snug text-ink-faint">Not recorded yet.</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditing({
                                          eacNo: row.eac_no,
                                          regNo: row.reg_no,
                                          section: section.key as ProfileSection,
                                        })
                                      }}
                                      className="mt-auto flex h-[26px] w-fit items-center gap-1 rounded-md border border-rule-strong px-2 text-[12px] text-ink transition-colors hover:bg-surface-hover"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add
                                    </button>
                                  </div>
                                )
                              }

                              const fields = Object.entries(data)
                                .filter(
                                  ([k, v]) =>
                                    ![
                                      'record_id', 'id', 'eac_no', 'reg_no', 'status', 'created_at',
                                      'submitted_by', 'verified_by', 'verified_at', 'approved_by',
                                      'approved_at', 'village_name',
                                    ].includes(k) &&
                                    v !== null &&
                                    v !== undefined &&
                                    String(v).trim() !== ''
                                )
                                .slice(0, 4)

                              return (
                                <div
                                  key={section.key}
                                  className="flex flex-col gap-2 rounded-md border border-rule bg-surface p-3"
                                >
                                  <span className="flex items-center text-[11.5px] font-semibold">
                                    {section.label}
                                    {editButton}
                                  </span>
                                  <div className="flex flex-col gap-1.5">
                                    {fields.length === 0 ? (
                                      <span className="text-[11.5px] text-ink-faint">Recorded, no details filled in.</span>
                                    ) : (
                                      fields.map(([k, v]) => (
                                        <div key={k} className="flex justify-between gap-2">
                                          <span className="shrink-0 text-[11.5px] text-ink-faint">
                                            {k.replace(/_/g, ' ')}
                                          </span>
                                          <span className="truncate text-right text-[11.5px]">{String(v)}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {!loading && rows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[12.5px] text-ink-faint">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-[28px] rounded-md border border-rule-strong px-2.5 text-[12.5px] transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-[12.5px] text-ink-muted">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-[28px] rounded-md border border-rule-strong px-2.5 text-[12.5px] transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && token && (
        <ChildProfilePanel
          eacNo={editing.eacNo}
          regNo={editing.regNo}
          token={token}
          initialSection={editing.section}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </AdminShell>
  )
}
