'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { getErrorMessage } from '../../../lib/errors'
import { Alert, LoadingSpinner } from '../../components/UI'
import AdminShell from '../AdminShell'
import PlacePicker from '../../components/PlacePicker'
import { emptyTree, resolveVillage, taluksIn, villagesIn, type PlaceTree, type ResolvedPlace } from '../../../lib/places'
import {
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  X,
  Check,
  Users,
  Tag,
  AlertCircle,
} from 'lucide-react'

/**
 * Centre data.
 *
 * The old page was a flat 20-column table plus four chained dropdowns. Nobody
 * navigates a programme by scrolling a spreadsheet sideways: they think
 * "the centre in Uthiramerur", so the left pane is a district › taluk › centre
 * tree and the right pane is one centre, whole.
 *
 * A centre record is really two things — an address and six people to call.
 * The people are what the record is *for*, so they lead; the address is
 * reference material below them.
 */

type Centre = {
  id: string
  eac_no: string | number
  village_id: string | null
  village_name: string | null
  district: string | null
  taluk: string | null
  panchayat: string | null
  start_date: string | null
  end_date: string | null
  cbv_name: string | null
  in_charge: string | null
  panchayat_member: string | null
  head_master: string | null
  anganvadi: string | null
  asha_worker: string | null
  head_master_mobile: string | null
  in_charge_mobile: string | null
  cbv_mobile: string | null
  panchayat_member_mobile: string | null
  anganvadi_mobile: string | null
  asha_worker_mobile: string | null
  cbv_email: string | null
}

type CentreCounts = { total: number; enrolled: number; left: number; missingDetails: number }

type FormState = Record<string, string>

/** The six people a centre is run through, and the columns that hold them. */
const CONTACTS: { label: string; name: keyof Centre; mobile: keyof Centre; email?: keyof Centre }[] = [
  { label: 'CBV', name: 'cbv_name', mobile: 'cbv_mobile', email: 'cbv_email' },
  { label: 'In-charge', name: 'in_charge', mobile: 'in_charge_mobile' },
  { label: 'Head master', name: 'head_master', mobile: 'head_master_mobile' },
  { label: 'Anganvadi', name: 'anganvadi', mobile: 'anganvadi_mobile' },
  { label: 'ASHA worker', name: 'asha_worker', mobile: 'asha_worker_mobile' },
  { label: 'Panchayat member', name: 'panchayat_member', mobile: 'panchayat_member_mobile' },
]

const FORM_KEYS = [
  'eac_no',
  'village_id',
  'village_name',
  'district',
  'taluk',
  'panchayat',
  'start_date',
  'end_date',
  ...CONTACTS.flatMap((c) => [c.name, c.mobile, ...(c.email ? [c.email] : [])]),
] as string[]

const emptyForm = (): FormState => Object.fromEntries(FORM_KEYS.map((k) => [k, '']))

const formFrom = (centre: Centre): FormState =>
  Object.fromEntries(FORM_KEYS.map((k) => [k, String((centre as any)[k] ?? '')]))

const txt = (v: unknown) => String(v ?? '').trim()

/** A centre is closed once an end date is on the record and in the past. */
const isClosed = (c: Centre) => Boolean(c.end_date && new Date(c.end_date) <= new Date())

const contactsRecorded = (c: Centre) => CONTACTS.filter((k) => txt(c[k.name])).length

const formatDate = (v: string | null) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const UNASSIGNED = 'No district recorded'

export default function CentreDataPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [token, setToken] = useState<string | null>(null)
  const [centres, setCentres] = useState<Centre[]>([])
  const [counts, setCounts] = useState<Record<string, CentreCounts>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /** null = viewing, 'new' = creating, otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [placeTree, setPlaceTree] = useState<PlaceTree>(emptyTree())
  const [placesSetupNeeded, setPlacesSetupNeeded] = useState(false)
  /** Off hides districts and taluks where no centre has been recorded yet. */
  const [showEmptyPlaces, setShowEmptyPlaces] = useState(true)

  useEffect(() => {
    if (!isAuthorized) return
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null))
  }, [isAuthorized])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/list-centres?counts=1', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load centres')
      setCentres(json.centres || [])
      setCounts(json.counts || {})
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load centres.'))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  // The place master fills every location dropdown. A 503 means the migration
  // has not been run yet, which is worth saying plainly rather than showing
  // three empty selects.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/places', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (cancelled) return
        if (res.status === 503 && json.setupRequired) {
          setPlacesSetupNeeded(true)
          return
        }
        if (!res.ok) throw new Error(json.error || 'Could not load places')
        setPlaceTree(json)
        setPlacesSetupNeeded(false)
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the district and taluk list.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  /** Admins may add a place inline; the new row is folded into the local tree. */
  /**
   * Where a centre actually is, according to the place list.
   *
   * The old district/taluk/village text on each row is not shown anywhere on
   * this screen any more: it still holds imported spellings and test values, so
   * displaying it would contradict the place list it is supposed to mirror. A
   * centre with no village yet says so instead.
   */
  const placeFor = useCallback(
    (c: Centre): ResolvedPlace => resolveVillage(placeTree, txt(c.village_id) || null),
    [placeTree]
  )

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return centres
    return centres.filter((c) =>
      [
        c.eac_no,
        ...(() => {
          const p = placeFor(c)
          return [p.village?.name, p.panchayat?.name, p.taluk?.name, p.district?.name]
        })(),
        ...CONTACTS.map((k) => c[k.name]),
      ]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ')
        .includes(q)
    )
  }, [centres, query, placeFor])

  /**
   * district → taluk → village → centres, walked from the place master.
   *
   * It used to be grouped by the free text on each centre row, which meant the
   * pane showed whatever had been typed — including old spellings and test
   * values. Reading the master instead means the tree matches the real place
   * list, and a taluk with no centre yet is visible rather than absent.
   */
  const tree = useMemo(() => {
    const byVillage = new Map<string, Centre[]>()
    const unlinked: Centre[] = []
    for (const c of matching) {
      const vid = txt(c.village_id)
      if (vid) {
        if (!byVillage.has(vid)) byVillage.set(vid, [])
        byVillage.get(vid)!.push(c)
      } else {
        unlinked.push(c)
      }
    }

    const byEac = (a: Centre, b: Centre) => Number(a.eac_no) - Number(b.eac_no)

    const districts = [...placeTree.districts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((district) => {
        const taluks = taluksIn(placeTree, district.id).map((taluk) => {
          const villages = villagesIn(placeTree, taluk.id).map((village) => ({
            key: village.id,
            name: village.name,
            centres: (byVillage.get(village.id) ?? []).sort(byEac),
          }))
          return {
            key: taluk.id,
            taluk: taluk.name,
            villages,
            total: villages.reduce((n, v) => n + v.centres.length, 0),
          }
        })
        return {
          key: district.id,
          district: district.name,
          taluks,
          total: taluks.reduce((n, t) => n + t.total, 0),
        }
      })

    // Centres with no village yet, and everything when the master is missing.
    if (unlinked.length > 0) {
      districts.push({
        key: UNASSIGNED,
        district: UNASSIGNED,
        total: unlinked.length,
        taluks: [
          {
            key: UNASSIGNED,
            taluk: 'Pick a village on each one',
            total: unlinked.length,
            villages: [{ key: UNASSIGNED, name: '', centres: [...unlinked].sort(byEac) }],
          },
        ],
      })
    }

    return showEmptyPlaces ? districts : districts.filter((d) => d.total > 0)
  }, [matching, placeTree, showEmptyPlaces])

  // A search narrows the tree to a handful of rows — open everything so the
  // matches are visible without a second click.
  useEffect(() => {
    if (!query.trim()) return
    setOpenGroups(Object.fromEntries(tree.map((g) => [g.key, true])))
  }, [query, tree])

  // On first load, open the first district so the pane isn't a wall of
  // collapsed rows. Only once — after that the user's own toggles stand.
  const [primed, setPrimed] = useState(false)
  useEffect(() => {
    if (primed || tree.length === 0) return
    setOpenGroups((g) => ({ ...g, [tree[0].key]: true }))
    setPrimed(true)
  }, [primed, tree])

  const selected = useMemo(
    () => centres.find((c) => c.id === selectedId) ?? null,
    [centres, selectedId]
  )

  // Below md only one pane shows. Picking a centre, or starting a new one,
  // swaps the list for the detail; the back button swaps it back.
  const showDetailOnly = Boolean(selected || editing)

  const startEdit = (centre: Centre) => {
    setForm(formFrom(centre))
    setEditing(centre.id)
    setError('')
    setSuccess('')
  }

  const startCreate = () => {
    const nextEac = centres.reduce((max, c) => Math.max(max, Number(c.eac_no) || 0), 0) + 1
    setForm({ ...emptyForm(), eac_no: String(nextEac) })
    setEditing('new')
    setSelectedId(null)
    setError('')
    setSuccess('')
  }

  const save = async () => {
    if (!token || !editing) return
    if (!txt(form.eac_no)) {
      setError('An EAC number is required.')
      return
    }
    // The village carries the taluk and district with it, so this one field
    // settles the whole address. Only enforced once the place tables exist:
    // before that there is no picker to choose from, and demanding a village
    // would block every centre edit outright.
    if (!placesSetupNeeded && !txt(form.village_id)) {
      setError('Pick a district, taluk and village for this centre.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const creating = editing === 'new'
      const res = await fetch(`/api/admin/centres/${creating ? 'create' : 'update'}`, {
        method: creating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(creating ? form : { id: editing, ...form }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not save the centre')

      setSuccess(creating ? `Centre ${form.eac_no} created.` : `Centre ${form.eac_no} saved.`)
      setEditing(null)
      await load()
      // The list is rebuilt on reload, so re-select by EAC rather than by id.
      if (creating) {
        setQuery('')
        setSelectedId(null)
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not save the centre.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!token || !selected) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/centres/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: selected.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not delete the centre')
      setSuccess(`Centre ${selected.eac_no} deleted.`)
      setConfirmDelete(false)
      setSelectedId(null)
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not delete the centre.'))
    } finally {
      setSaving(false)
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

  const breadcrumb = ['Manage records', 'Centre data']
  if (editing === 'new') breadcrumb.push('New centre')
  else if (selected) breadcrumb.push(`EAC ${selected.eac_no}`)

  return (
    <AdminShell
      active="/admin/center-management"
      breadcrumb={breadcrumb}
      username={profile.username}
      actions={
        <button
          type="button"
          onClick={startCreate}
          className="flex h-[34px] items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13.5px] font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" /> New centre
        </button>
      }
    >
      <div className="flex h-full min-h-0">
        {/*
          Two panes side by side when there is room. On a phone they become one
          pane at a time: the list until you pick a centre, then the centre with
          a way back.
        */}
        <div
          className={`${showDetailOnly ? 'hidden' : 'flex'} w-full shrink-0 flex-col border-r border-rule md:flex md:w-[280px]`}
        >
          <div className="border-b border-rule p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Centre, village or person"
                className="h-8 w-full rounded-md border border-rule bg-surface-sunken pl-8 pr-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:border-rule-strong focus:bg-surface"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
            {loading ? (
              <div className="px-3 py-6 text-center text-[13.5px] text-ink-muted">Loading centres…</div>
            ) : tree.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13.5px] text-ink-muted">
                {query ? 'No centre matches that.' : 'No centres yet.'}
              </div>
            ) : (
              tree.map((group) => {
                const open = openGroups[group.key] ?? false
                return (
                  <div key={group.key}>
                    <button
                      type="button"
                      onClick={() => setOpenGroups((g) => ({ ...g, [group.key]: !open }))}
                      className="flex h-7 w-full items-center gap-1 px-2 text-left transition-colors hover:bg-surface-hover"
                    >
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                      )}
                      <span
                        className={`min-w-0 flex-1 truncate text-[14px] font-medium ${
                          group.key === UNASSIGNED ? 'italic text-ink-muted' : ''
                        }`}
                      >
                        {group.district}
                      </span>
                      <span className="font-mono text-[12px] text-ink-faint">{group.total}</span>
                    </button>

                    {open &&
                      group.taluks.map((t) => (
                        <div key={t.key}>
                          <div className="flex h-6 items-center gap-1.5 pl-[26px] pr-2">
                            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium uppercase tracking-wide text-ink-faint">
                              {t.taluk}
                            </span>
                            {t.total === 0 && <span className="text-[12px] text-ink-faint">no centres</span>}
                          </div>

                          {t.villages.map((v) => {
                            // A village almost always holds one centre, so the
                            // two collapse into a single row. Only where a
                            // village really has several does it become a
                            // heading with rows under it.
                            const single = v.name && v.centres.length === 1
                            return (
                              <div key={v.key}>
                                {v.name && !single && (
                                  <div className="flex h-6 items-center gap-1.5 pl-[38px] pr-2">
                                    <span
                                      className={`min-w-0 flex-1 truncate text-[13px] ${
                                        v.centres.length === 0 ? 'text-ink-faint' : 'text-ink-muted'
                                      }`}
                                    >
                                      {v.name}
                                    </span>
                                    {v.centres.length === 0 && <span className="text-[12px] text-ink-faint">—</span>}
                                  </div>
                                )}

                                {v.centres.map((c) => {
                                  const active = c.id === selectedId
                                  const recorded = contactsRecorded(c)
                                  const label = single ? v.name : `EAC ${c.eac_no}`
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedId(c.id)
                                        setEditing(null)
                                        setConfirmDelete(false)
                                      }}
                                      className={`flex h-8 w-full items-center gap-2 py-1 pr-2 text-left transition-colors ${
                                        single ? 'pl-[38px]' : 'pl-[50px]'
                                      } ${active ? 'bg-rule' : 'hover:bg-surface-hover'}`}
                                    >
                                      <span
                                        className={`w-8 shrink-0 font-mono text-[12.5px] ${
                                          active ? 'text-ink' : 'text-ink-muted'
                                        }`}
                                      >
                                        {c.eac_no}
                                      </span>
                                      <span
                                        className={`min-w-0 flex-1 truncate text-[14px] ${active ? 'font-medium' : ''} ${
                                          isClosed(c) ? 'text-ink-faint' : ''
                                        }`}
                                      >
                                        {label}
                                      </span>
                                      {isClosed(c) && (
                                        <span className="shrink-0 text-[12px] text-ink-faint">closed</span>
                                      )}
                                      {recorded < CONTACTS.length && (
                                        <span
                                          title={`${CONTACTS.length - recorded} contacts missing`}
                                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending-fg"
                                        />
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                  </div>
                )
              })
            )}
          </div>

          <div className="border-t border-rule p-2">
            <label className="flex h-7 w-full cursor-pointer items-center gap-2 rounded px-2 text-[13.5px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink">
              <input
                type="checkbox"
                checked={showEmptyPlaces}
                onChange={(e) => setShowEmptyPlaces(e.target.checked)}
                className="h-3.5 w-3.5 accent-current"
              />
              Show places with no centre
            </label>
            <Link
              href="/admin/places"
              className="flex h-7 w-full items-center gap-2 rounded px-2 text-[13.5px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <MapPin className="h-3.5 w-3.5" /> Add or rename a place
            </Link>
            <button
              type="button"
              onClick={() => setShowRename(true)}
              className="flex h-7 w-full items-center gap-2 rounded px-2 text-[13.5px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <Tag className="h-3.5 w-3.5" /> Fix a place name on old rows
            </button>
          </div>
        </div>

        {/* Detail */}
        <div className={`${showDetailOnly ? 'block' : 'hidden'} min-w-0 flex-1 overflow-y-auto md:block`}>
          <div className="px-4 pb-14 pt-4 sm:px-8 sm:pt-6">
            {showDetailOnly && (
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null)
                  setEditing(null)
                }}
                className="mb-3 flex h-9 items-center gap-1.5 rounded-md border border-rule-strong px-2.5 text-[14px] transition-colors hover:bg-surface-hover md:hidden"
              >
                <ChevronLeft className="h-4 w-4" /> All centres
              </button>
            )}
            {error && <Alert type="error" message={error} className="mb-4" />}
            {success && <Alert type="success" message={success} className="mb-4" />}

            {editing ? (
              <CentreForm
                form={form}
                setForm={setForm}
                creating={editing === 'new'}
                saving={saving}
                placeTree={placeTree}
                placesSetupNeeded={placesSetupNeeded}
                onSave={save}
                onCancel={() => {
                  setEditing(null)
                  setError('')
                }}
              />
            ) : selected ? (
              <CentreDetail
                centre={selected}
                place={placeFor(selected)}
                counts={counts[String(selected.eac_no)]}
                onEdit={() => startEdit(selected)}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                onDelete={remove}
                saving={saving}
              />
            ) : (
              <Summary
                centres={centres}
                counts={counts}
                loading={loading}
                placeFor={placeFor}
                onPick={setSelectedId}
              />
            )}
          </div>
        </div>
      </div>

      {showRename && token && (
        <RenamePlaceDialog
          centres={centres}
          token={token}
          onClose={() => setShowRename(false)}
          onDone={async (message) => {
            setShowRename(false)
            setSuccess(message)
            await load()
          }}
        />
      )}
    </AdminShell>
  )
}

/* ---------------------------------------------------------------- detail -- */

function CentreDetail({
  centre,
  place,
  counts,
  onEdit,
  confirmDelete,
  setConfirmDelete,
  onDelete,
  saving,
}: {
  centre: Centre
  place: ResolvedPlace
  counts?: CentreCounts
  onEdit: () => void
  confirmDelete: boolean
  setConfirmDelete: (v: boolean) => void
  onDelete: () => void
  saving: boolean
}) {
  const closed = isClosed(centre)
  const recorded = contactsRecorded(centre)
  const address = [place.district?.name, place.taluk?.name, place.panchayat?.name, place.village?.name].filter(
    Boolean
  ) as string[]

  return (
    <div className="max-w-[900px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <span className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[13px] text-ink-muted">
              EAC {centre.eac_no}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[12.5px] font-medium ${
                closed
                  ? 'bg-status-inactive-bg text-status-inactive-fg'
                  : 'bg-status-approved-bg text-status-approved-fg'
              }`}
            >
              {closed ? 'Closed' : 'Active'}
            </span>
          </div>
          <h1 className="truncate text-[24px] font-semibold tracking-tight">
            {place.village?.name ?? `EAC ${centre.eac_no}`}
          </h1>
          <p className="flex items-center gap-1.5 text-[14px] text-ink-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {address.length ? address.join(' › ') : 'No village set yet — edit this centre to pick one'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-8 items-center gap-1.5 rounded-md border border-rule-strong px-3 text-[14px] transition-colors hover:bg-surface-hover"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-rule-strong text-ink-muted transition-colors hover:bg-status-returned-bg hover:text-status-returned-fg"
            title="Delete centre"
            aria-label="Delete centre"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="mb-5 rounded-md border border-status-returned-fg/30 bg-status-returned-bg px-4 py-3.5">
          <p className="text-[14px] text-status-returned-fg">
            Delete centre {centre.eac_no}? {counts?.total
              ? `${counts.total} child record${counts.total === 1 ? '' : 's'} reference this EAC and will be orphaned.`
              : 'This cannot be undone.'}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="flex h-[34px] items-center rounded-md bg-status-returned-fg px-3 text-[13.5px] font-medium text-surface disabled:opacity-60"
            >
              {saving ? 'Deleting…' : 'Delete centre'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex h-[34px] items-center rounded-md border border-rule-strong bg-surface px-3 text-[13.5px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Children at this centre */}
      {/* Four tiles across on a laptop; two by two on a phone, with the link
          on its own full-width row rather than squeezed off the edge. */}
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-4 lg:flex lg:items-center">
        {[
          { label: 'Children', value: counts?.total ?? 0, tone: '' },
          { label: 'Enrolled', value: counts?.enrolled ?? 0, tone: '' },
          { label: 'Left', value: counts?.left ?? 0, tone: 'text-ink-muted' },
          {
            label: 'Missing details',
            value: counts?.missingDetails ?? 0,
            tone: counts?.missingDetails ? 'text-status-pending-fg' : '',
          },
        ].map((s) => (
          <div key={s.label} className="flex flex-1 flex-col gap-1 bg-surface px-4 py-3">
            <span className="text-[12.5px] leading-tight text-ink-muted">{s.label}</span>
            <span className={`text-lg font-semibold tracking-tight ${s.tone}`}>{s.value}</span>
          </div>
        ))}
        <Link
          href={`/admin/child-data?eacNo=${encodeURIComponent(String(centre.eac_no))}`}
          className="col-span-2 flex h-11 items-center gap-1.5 bg-surface px-4 text-[13.5px] font-medium text-blue-600 transition-colors hover:bg-surface-hover sm:col-span-4 lg:h-full lg:w-auto"
        >
          <Users className="h-3.5 w-3.5" /> Open children
        </Link>
      </div>

      {/* People */}
      <div className="mb-6">
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="text-xs font-medium text-ink-faint">People at this centre</span>
          <span className={`text-[12.5px] ${recorded < CONTACTS.length ? 'text-status-pending-fg' : 'text-ink-faint'}`}>
            {recorded} of {CONTACTS.length} recorded
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {CONTACTS.map((c) => {
            const name = txt(centre[c.name])
            const mobile = txt(centre[c.mobile])
            const email = c.email ? txt(centre[c.email]) : ''
            return (
              <div
                key={c.label}
                className={`flex flex-col gap-1.5 rounded-md border p-3.5 ${
                  name ? 'border-rule' : 'border-dashed border-rule-strong bg-surface-sunken'
                }`}
              >
                <span className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">{c.label}</span>
                {name ? (
                  <>
                    <span className="truncate text-[14.5px] font-medium">{name}</span>
                    {mobile ? (
                      <a
                        href={`tel:${mobile.replace(/\s+/g, '')}`}
                        className="flex items-center gap-1.5 font-mono text-[13.5px] text-blue-600"
                      >
                        <Phone className="h-3 w-3" /> {mobile}
                      </a>
                    ) : (
                      <span className="text-[13px] text-ink-faint">No number</span>
                    )}
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className="flex items-center gap-1.5 truncate text-[13.5px] text-blue-600"
                      >
                        <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{email}</span>
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-[14px] italic text-ink-faint">Not recorded</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Address and dates */}
      <div>
        <span className="mb-2.5 block text-xs font-medium text-ink-faint">Location and dates</span>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule md:grid-cols-3">
          {[
            { label: 'District', value: place.district?.name ?? '—' },
            { label: 'Taluk', value: place.taluk?.name ?? '—' },
            { label: 'Panchayat', value: place.panchayat?.name ?? '—' },
            { label: 'Village', value: place.village?.name ?? '—' },
            { label: 'Started', value: formatDate(centre.start_date) },
            { label: 'Ended', value: formatDate(centre.end_date) },
          ].map((f) => (
            <div key={f.label} className="flex flex-col gap-1 bg-surface px-4 py-3">
              <span className="text-[12.5px] text-ink-muted">{f.label}</span>
              <span className="truncate text-[14.5px]">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ form -- */

const inputClass =
  'h-8 w-full rounded-md border border-rule bg-surface px-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:border-blue-500'

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  list,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  list?: string
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-ink-muted">
        {label}
        {required && <span className="text-status-returned-fg"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        list={list}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  )
}

function CentreForm({
  form,
  setForm,
  creating,
  saving,
  placeTree,
  placesSetupNeeded,
  onSave,
  onCancel,
}: {
  form: FormState
  setForm: (f: FormState) => void
  creating: boolean
  saving: boolean
  placeTree: PlaceTree
  placesSetupNeeded: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const set = (key: string) => (v: string) => setForm({ ...form, [key]: v })

  return (
    <div className="max-w-[900px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-tight">
            {creating ? 'New centre' : `Edit EAC ${form.eac_no}`}
          </h1>
          <p className="text-[14px] text-ink-muted">
            {creating
              ? 'EAC number and village name are required; everything else can be filled in later.'
              : 'Changes apply to this centre only.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 items-center gap-1.5 rounded-md border border-rule-strong px-3 text-[14px] transition-colors hover:bg-surface-hover"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-[14px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : creating ? 'Create centre' : 'Save changes'}
          </button>
        </div>
      </div>

      <section className="mb-6">
        <span className="mb-2.5 block text-xs font-medium text-ink-faint">Identity and location</span>
        <div className="flex flex-col gap-4 rounded-md border border-rule p-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="EAC number" value={form.eac_no} onChange={set('eac_no')} required />
            <Field label="Start date" type="date" value={form.start_date} onChange={set('start_date')} />
            <Field
              label="End date"
              type="date"
              value={form.end_date}
              onChange={set('end_date')}
              placeholder="Leave blank while active"
            />
          </div>

          <div className="border-t border-rule pt-4">
            {placesSetupNeeded ? (
              <Alert
                type="warning"
                message="The place list has not been set up yet. Run sql/002_place_hierarchy.sql then sql/003_place_seed.sql, and the district, taluk and village dropdowns will fill in."
              />
            ) : (
              <>
                {/* No inline creation here on purpose: a place typed while
                    filling in a centre is how a typo becomes a permanent
                    village. Adding one is its own screen. */}
                <PlacePicker
                  tree={placeTree}
                  villageId={form.village_id || null}
                  onChange={(villageId) => setForm({ ...form, village_id: villageId ?? '' })}
                  showPanchayat
                  required
                />
                <p className="mt-2 text-[12.5px] text-ink-faint">
                  Village not on the list?{' '}
                  <Link href="/admin/places" className="underline hover:text-ink">
                    Add it under Places
                  </Link>
                  , then come back.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section>
        <span className="mb-2.5 block text-xs font-medium text-ink-faint">People at this centre</span>
        <div className="flex flex-col gap-px overflow-hidden rounded-md border border-rule bg-rule">
          {CONTACTS.map((c) => (
            <div
              key={c.label}
              className="grid grid-cols-1 gap-3.5 bg-surface px-4 py-3.5 sm:grid-cols-[1fr_1fr] lg:grid-cols-[140px_1fr_180px_1fr]"
            >
              <span className="self-center text-[13.5px] font-medium">{c.label}</span>
              <Field label="Name" value={form[c.name as string]} onChange={set(c.name as string)} />
              <Field label="Mobile" value={form[c.mobile as string]} onChange={set(c.mobile as string)} />
              {c.email ? (
                <Field label="Email" type="email" value={form[c.email as string]} onChange={set(c.email as string)} />
              ) : (
                <div />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/* --------------------------------------------------------------- summary -- */

function Summary({
  centres,
  counts,
  loading,
  placeFor,
  onPick,
}: {
  centres: Centre[]
  counts: Record<string, CentreCounts>
  loading: boolean
  placeFor: (c: Centre) => ResolvedPlace
  onPick: (id: string) => void
}) {
  const stats = useMemo(() => {
    const districts = new Set(
      centres.map((c) => placeFor(c).district?.name).filter(Boolean) as string[]
    )
    const active = centres.filter((c) => !isClosed(c)).length
    const children = Object.values(counts).reduce((n, c) => n + c.total, 0)
    return { total: centres.length, districts: districts.size, active, children }
  }, [centres, counts, placeFor])

  /** Fewest contacts first — those are the centres nobody can actually reach. */
  const gaps = useMemo(
    () =>
      centres
        .map((c) => ({ centre: c, place: placeFor(c), recorded: contactsRecorded(c) }))
        .filter((r) => r.recorded < CONTACTS.length)
        .sort((a, b) => a.recorded - b.recorded)
        .slice(0, 8),
    [centres, placeFor]
  )

  return (
    <div className="max-w-[820px]">
      <div className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-[24px] font-semibold tracking-tight">Centre data</h1>
        <p className="text-[14.5px] leading-relaxed text-ink-muted">
          Pick a centre on the left to see its people and address. Every centre is one EAC number.
        </p>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule md:grid-cols-4">
        {[
          { label: 'Centres', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: 'Districts', value: stats.districts },
          { label: 'Children', value: stats.children },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5 bg-surface px-[18px] py-4">
            <span className="text-xs text-ink-muted">{s.label}</span>
            <span className="text-2xl font-semibold tracking-tight">
              {loading ? '—' : s.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {!loading && gaps.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-status-pending-fg" />
            <span className="text-xs font-medium text-ink-faint">Centres with contacts missing</span>
          </div>
          <div className="overflow-hidden rounded-md border border-rule">
            {gaps.map((g, i) => (
              <button
                key={g.centre.id}
                type="button"
                onClick={() => onPick(g.centre.id)}
                className={`flex h-10 w-full items-center gap-3.5 px-4 text-left transition-colors hover:bg-surface-hover ${
                  i < gaps.length - 1 ? 'border-b border-rule' : ''
                }`}
              >
                <span className="w-9 font-mono text-[13.5px] text-ink-muted">{g.centre.eac_no}</span>
                <span className={`flex-1 truncate text-[14px] ${g.place.village ? '' : 'text-ink-faint'}`}>
                  {g.place.village?.name ?? 'No village set'}
                </span>
                <span className="truncate text-[13px] text-ink-faint">{g.place.taluk?.name ?? ''}</span>
                <span className="w-24 text-right text-[13px] text-status-pending-fg">
                  {CONTACTS.length - g.recorded} missing
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- rename -- */

/**
 * Place names arrive from Access with spelling drift ("Uthiramerur" vs
 * "Uthiramerure"), which splits one taluk into two branches of the tree. This
 * repairs the name everywhere at once.
 *
 * Deliberately rename-only: the old page also offered a cascade *delete*, which
 * blanked district, taluk, panchayat and village on every centre in the branch.
 * That is not a delete anyone means to run.
 */
function RenamePlaceDialog({
  centres,
  token,
  onClose,
  onDone,
}: {
  centres: Centre[]
  token: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [level, setLevel] = useState<'district' | 'taluk'>('district')
  const [oldValue, setOldValue] = useState('')
  const [newValue, setNewValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  /** Taluk names aren't unique across districts, so each option carries its district. */
  const options = useMemo(() => {
    const seen = new Map<string, { label: string; value: string; district: string; count: number }>()
    for (const c of centres) {
      const district = txt(c.district)
      const value = level === 'district' ? district : txt(c.taluk)
      if (!value) continue
      const key = level === 'district' ? value : `${district}::${value}`
      const entry =
        seen.get(key) ||
        seen
          .set(key, {
            label: level === 'district' ? value : `${value} — ${district || 'no district'}`,
            value,
            district,
            count: 0,
          })
          .get(key)!
      entry.count += 1
    }
    return Array.from(seen.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [centres, level])

  const chosen = options.find((o) => o.key === oldValue)

  const submit = async () => {
    if (!chosen || !newValue.trim() || newValue.trim() === chosen.value) return
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/centres/cascade-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          level,
          oldValue: chosen.value,
          newValue: newValue.trim(),
          district: level === 'taluk' ? chosen.district : '',
          taluk: '',
          panchayat: '',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not rename')
      onDone(
        `Renamed ${chosen.value} to ${newValue.trim()}${
          json.updatedCount ? ` across ${json.updatedCount} centres` : ''
        }.`
      )
    } catch (e: unknown) {
      setErr(getErrorMessage(e, 'Could not rename.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[460px] rounded-lg border border-rule bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <span className="text-[15px] font-semibold">Fix a place name</span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-faint hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            Corrects a spelling on every centre that uses it. Use this when the same place appears twice in the
            tree under slightly different names.
          </p>

          {err && <Alert type="error" message={err} />}

          <div className="flex gap-1.5">
            {(['district', 'taluk'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLevel(l)
                  setOldValue('')
                }}
                className={`h-7 rounded-md px-3 text-[13.5px] capitalize transition-colors ${
                  level === l ? 'bg-ink text-surface' : 'border border-rule-strong hover:bg-surface-hover'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-muted">Current name</span>
            <select
              value={oldValue}
              onChange={(e) => {
                setOldValue(e.target.value)
                const opt = options.find((o) => o.key === e.target.value)
                setNewValue(opt?.value ?? '')
              }}
              className={inputClass}
            >
              <option value="">Choose a {level}…</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label} ({o.count})
                </option>
              ))}
            </select>
          </label>

          <Field label="Corrected name" value={newValue} onChange={setNewValue} />

          {chosen && (
            <p className="text-[13px] text-ink-muted">
              This updates {chosen.count} centre{chosen.count === 1 ? '' : 's'}.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-rule px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 items-center rounded-md border border-rule-strong px-3 text-[14px] hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !chosen || !newValue.trim() || newValue.trim() === chosen?.value}
            className="flex h-8 items-center rounded-md bg-blue-600 px-3.5 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Renaming…' : 'Rename everywhere'}
          </button>
        </div>
      </div>
    </div>
  )
}
