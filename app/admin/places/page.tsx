'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { getErrorMessage } from '../../../lib/errors'
import { LoadingSpinner, Alert } from '../../components/UI'
import AdminShell from '../AdminShell'
import {
  emptyTree,
  panchayatsIn,
  taluksIn,
  villagesByPanchayat,
  type PlaceKind,
  type PlaceTree,
} from '../../../lib/places'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X, Search, MapPin } from 'lucide-react'

/**
 * The place list itself — district, taluk, panchayat, village.
 *
 * Creating places used to happen inline while editing a centre, which is how a
 * typo becomes a permanent new village. Places are their own thing now: this is
 * the only screen that adds, renames or removes one.
 */

type Usage = Record<string, { centres: number; children: number }>

interface Draft {
  kind: PlaceKind
  parentId: string | null
  name: string
  /** Villages only. */
  panchayatId: string
}

const KIND_LABEL: Record<PlaceKind, string> = {
  district: 'district',
  taluk: 'taluk',
  panchayat: 'panchayat',
  village: 'village',
}

export default function PlacesPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [token, setToken] = useState<string | null>(null)
  const [tree, setTree] = useState<PlaceTree>(emptyTree())
  const [usage, setUsage] = useState<Usage>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [busy, setBusy] = useState(false)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<Draft | null>(null)
  const [renaming, setRenaming] = useState<{ kind: PlaceKind; id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ kind: PlaceKind; id: string; name: string } | null>(null)

  useEffect(() => {
    if (!isAuthorized) return
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null))
  }, [isAuthorized])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/places?usage=1', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (res.status === 503 && json.setupRequired) {
        setSetupNeeded(true)
        return
      }
      if (!res.ok) throw new Error(json.error || 'Could not load the place list')
      setSetupNeeded(false)
      setTree({
        districts: json.districts ?? [],
        taluks: json.taluks ?? [],
        panchayats: json.panchayats ?? [],
        villages: json.villages ?? [],
      })
      setUsage(json.usage ?? {})
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load the place list.'))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const flash = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 3000)
  }

  const call = async (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) => {
    const res = await fetch('/api/places', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'That did not work.')
    return json
  }

  const add = async () => {
    if (!draft || !draft.name.trim()) return
    setBusy(true)
    setError('')
    try {
      const json = await call('POST', {
        kind: draft.kind,
        name: draft.name.trim(),
        parentId: draft.parentId,
        panchayatId: draft.kind === 'village' ? draft.panchayatId || null : undefined,
      })
      flash(json.alreadyExisted ? `That ${KIND_LABEL[draft.kind]} was already on the list.` : `${draft.name.trim()} added.`)
      if (draft.parentId) setOpen((o) => ({ ...o, [draft.parentId!]: true }))
      setDraft(null)
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not add that.'))
    } finally {
      setBusy(false)
    }
  }

  const rename = async () => {
    if (!renaming || !renaming.name.trim()) return
    setBusy(true)
    setError('')
    try {
      await call('PATCH', { kind: renaming.kind, id: renaming.id, name: renaming.name.trim() })
      flash('Renamed. The old spelling still resolves on import.')
      setRenaming(null)
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not rename that.'))
    } finally {
      setBusy(false)
    }
  }

  const setVillagePanchayat = async (villageId: string, panchayatId: string) => {
    setBusy(true)
    setError('')
    try {
      await call('PATCH', { kind: 'village', id: villageId, panchayatId: panchayatId || null })
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not change the panchayat.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirmDelete) return
    setBusy(true)
    setError('')
    try {
      await call('DELETE', { kind: confirmDelete.kind, id: confirmDelete.id })
      flash(`${confirmDelete.name} removed.`)
      setConfirmDelete(null)
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not remove that.'))
    } finally {
      setBusy(false)
    }
  }

  const q = query.trim().toLowerCase()

  /** Districts still worth showing once a search is typed. */
  const districts = useMemo(() => {
    const all = [...tree.districts].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return all
    return all.filter((d) => {
      if (d.name.toLowerCase().includes(q)) return true
      const taluks = taluksIn(tree, d.id)
      return taluks.some(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          tree.villages.some((v) => v.taluk_id === t.id && v.name.toLowerCase().includes(q)) ||
          tree.panchayats.some((p) => p.taluk_id === t.id && p.name.toLowerCase().includes(q))
      )
    })
  }, [tree, q])

  // A search should show its matches without a dozen clicks.
  useEffect(() => {
    if (!q) return
    const next: Record<string, boolean> = {}
    for (const d of tree.districts) next[d.id] = true
    for (const t of tree.taluks) next[t.id] = true
    setOpen(next)
  }, [q, tree])

  const counts = useMemo(() => {
    const villagesInTaluk = (talukId: string) => tree.villages.filter((v) => v.taluk_id === talukId).length
    return { villagesInTaluk }
  }, [tree])

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

  const iconBtn =
    'rounded p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-40'

  const addRow = (kind: PlaceKind, parentId: string | null, talukId: string | null) => {
    if (!draft || draft.kind !== kind || draft.parentId !== parentId) return null
    const panchayats = talukId ? panchayatsIn(tree, talukId) : []
    return (
      <div className="flex flex-wrap items-center gap-2 py-1.5">
        <input
          autoFocus
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
            if (e.key === 'Escape') setDraft(null)
          }}
          placeholder={`Name of the ${KIND_LABEL[kind]}`}
          className="h-[30px] w-[220px] rounded-md border border-rule-strong bg-surface px-2.5 text-[13px] outline-none focus:border-blue-500"
        />
        {kind === 'village' && (
          <select
            value={draft.panchayatId}
            onChange={(e) => setDraft({ ...draft, panchayatId: e.target.value })}
            className="h-[30px] rounded-md border border-rule-strong bg-surface px-2 text-[13px] outline-none focus:border-blue-500"
          >
            <option value="">Panchayat not known yet</option>
            {panchayats.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={add}
          disabled={busy || !draft.name.trim()}
          className="flex h-[30px] items-center gap-1.5 rounded-md bg-ink px-2.5 text-[12.5px] font-medium text-surface disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" /> Add
        </button>
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="flex h-[30px] items-center rounded-md border border-rule-strong px-2 text-[12.5px] hover:bg-surface-hover"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const nameCell = (kind: PlaceKind, id: string, name: string, bold = false) =>
    renaming && renaming.kind === kind && renaming.id === id ? (
      <span className="flex items-center gap-1.5">
        <input
          autoFocus
          value={renaming.name}
          onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              rename()
            }
            if (e.key === 'Escape') setRenaming(null)
          }}
          className="h-[26px] w-[200px] rounded-md border border-rule-strong bg-surface px-2 text-[13px] outline-none focus:border-blue-500"
        />
        <button type="button" onClick={rename} disabled={busy} className={iconBtn} aria-label="Save name">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => setRenaming(null)} className={iconBtn} aria-label="Cancel">
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    ) : (
      <span className={`text-[13px] ${bold ? 'font-medium' : ''}`}>{name}</span>
    )

  return (
    <AdminShell
      active="/admin/places"
      breadcrumb={['Manage records', 'Places']}
      username={profile.username}
      actions={
        <button
          type="button"
          onClick={() => setDraft({ kind: 'district', parentId: null, name: '', panchayatId: '' })}
          className="flex h-[28px] items-center gap-1.5 rounded-md bg-ink px-2.5 text-[12.5px] font-medium text-surface transition-opacity hover:opacity-90"
        >
          <Plus className="h-[13px] w-[13px]" /> New district
        </button>
      }
    >
      <div className="px-6 pb-10 pt-5">
        {error && <Alert type="error" message={error} className="mb-4" />}
        {notice && <Alert type="success" message={notice} className="mb-4" />}

        <div className="mb-1 flex items-center justify-between gap-5">
          <h1 className="text-xl font-semibold tracking-tight">Places</h1>
          <span className="text-[12.5px] text-ink-faint">
            {tree.districts.length} districts · {tree.taluks.length} taluks · {tree.panchayats.length} panchayats ·{' '}
            {tree.villages.length} villages
          </span>
        </div>
        <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Every centre and child points at a village from this list. A village belongs to one panchayat, and a
          panchayat covers several villages. Changing a name here changes it everywhere.
        </p>

        {setupNeeded ? (
          <Alert
            type="warning"
            message="The place tables do not exist yet. Run sql/002_place_hierarchy.sql, then sql/003_place_seed.sql."
          />
        ) : (
          <>
            <div className="mb-3 flex h-[30px] w-[290px] items-center gap-2 rounded-md border border-rule-strong px-2.5 focus-within:border-blue-500">
              <Search className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="District, taluk, panchayat or village"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-ink-faint"
              />
            </div>

            {loading ? (
              <div className="rounded-md border border-rule p-12 text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-3 text-[13px] text-ink-muted">Loading places…</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-rule">
                {draft?.kind === 'district' && <div className="border-b border-rule px-3">{addRow('district', null, null)}</div>}

                {districts.length === 0 ? (
                  <div className="p-12 text-center">
                    <MapPin className="mx-auto mb-3 h-9 w-9 text-rule-strong" />
                    <p className="text-[13.5px] text-ink-muted">
                      {q ? 'Nothing matches that.' : 'No districts yet. Add the first one.'}
                    </p>
                  </div>
                ) : (
                  districts.map((district) => {
                    const taluks = taluksIn(tree, district.id)
                    const isOpen = open[district.id]
                    return (
                      <div key={district.id} className="border-b border-rule last:border-0">
                        <div className="flex h-[38px] items-center gap-2 px-3 hover:bg-surface-hover">
                          <button
                            type="button"
                            onClick={() => setOpen((o) => ({ ...o, [district.id]: !o[district.id] }))}
                            className="shrink-0 text-ink-muted"
                            aria-label={isOpen ? 'Collapse' : 'Expand'}
                          >
                            {isOpen ? <ChevronDown className="h-[15px] w-4" /> : <ChevronRight className="h-[15px] w-4" />}
                          </button>
                          {nameCell('district', district.id, district.name, true)}
                          <span className="text-[11.5px] text-ink-faint">
                            {taluks.length} {taluks.length === 1 ? 'taluk' : 'taluks'}
                          </span>
                          <span className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setDraft({ kind: 'taluk', parentId: district.id, name: '', panchayatId: '' })}
                              className={iconBtn}
                              title="Add a taluk"
                              aria-label="Add a taluk"
                            >
                              <Plus className="h-[13px] w-[13px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenaming({ kind: 'district', id: district.id, name: district.name })}
                              className={iconBtn}
                              title="Rename"
                              aria-label="Rename district"
                            >
                              <Pencil className="h-[13px] w-[13px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete({ kind: 'district', id: district.id, name: district.name })}
                              className={iconBtn}
                              title="Remove"
                              aria-label="Remove district"
                            >
                              <Trash2 className="h-[13px] w-[13px]" />
                            </button>
                          </span>
                        </div>

                        <div className="pl-6">{addRow('taluk', district.id, null)}</div>

                        {isOpen &&
                          taluks.map((taluk) => {
                            const talukOpen = open[taluk.id]
                            const groups = villagesByPanchayat(tree, taluk.id)
                            return (
                              <div key={taluk.id} className="border-t border-rule-faint">
                                <div className="flex h-[34px] items-center gap-2 pl-8 pr-3 hover:bg-surface-hover">
                                  <button
                                    type="button"
                                    onClick={() => setOpen((o) => ({ ...o, [taluk.id]: !o[taluk.id] }))}
                                    className="shrink-0 text-ink-muted"
                                    aria-label={talukOpen ? 'Collapse' : 'Expand'}
                                  >
                                    {talukOpen ? (
                                      <ChevronDown className="h-[14px] w-4" />
                                    ) : (
                                      <ChevronRight className="h-[14px] w-4" />
                                    )}
                                  </button>
                                  {nameCell('taluk', taluk.id, taluk.name)}
                                  <span className="text-[11.5px] text-ink-faint">
                                    {counts.villagesInTaluk(taluk.id)} villages ·{' '}
                                    {panchayatsIn(tree, taluk.id).length} panchayats
                                  </span>
                                  <span className="ml-auto flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDraft({ kind: 'panchayat', parentId: taluk.id, name: '', panchayatId: '' })
                                      }
                                      className="h-[24px] rounded px-1.5 text-[11.5px] text-ink-faint hover:bg-surface-hover hover:text-ink"
                                    >
                                      + Panchayat
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDraft({ kind: 'village', parentId: taluk.id, name: '', panchayatId: '' })
                                      }
                                      className="h-[24px] rounded px-1.5 text-[11.5px] text-ink-faint hover:bg-surface-hover hover:text-ink"
                                    >
                                      + Village
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRenaming({ kind: 'taluk', id: taluk.id, name: taluk.name })}
                                      className={iconBtn}
                                      title="Rename"
                                      aria-label="Rename taluk"
                                    >
                                      <Pencil className="h-[13px] w-[13px]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDelete({ kind: 'taluk', id: taluk.id, name: taluk.name })}
                                      className={iconBtn}
                                      title="Remove"
                                      aria-label="Remove taluk"
                                    >
                                      <Trash2 className="h-[13px] w-[13px]" />
                                    </button>
                                  </span>
                                </div>

                                <div className="pl-14">
                                  {addRow('panchayat', taluk.id, taluk.id)}
                                  {addRow('village', taluk.id, taluk.id)}
                                </div>

                                {talukOpen &&
                                  groups.map((group) => (
                                    <div key={group.panchayat?.id ?? 'none'} className="border-t border-rule-faint">
                                      <div className="flex h-[28px] items-center gap-2 bg-surface-sunken pl-14 pr-3">
                                        {group.panchayat ? (
                                          <>
                                            {nameCell('panchayat', group.panchayat.id, group.panchayat.name)}
                                            <span className="text-[11px] text-ink-faint">panchayat</span>
                                            <span className="ml-auto flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setRenaming({
                                                    kind: 'panchayat',
                                                    id: group.panchayat!.id,
                                                    name: group.panchayat!.name,
                                                  })
                                                }
                                                className={iconBtn}
                                                title="Rename"
                                                aria-label="Rename panchayat"
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setConfirmDelete({
                                                    kind: 'panchayat',
                                                    id: group.panchayat!.id,
                                                    name: group.panchayat!.name,
                                                  })
                                                }
                                                className={iconBtn}
                                                title="Remove"
                                                aria-label="Remove panchayat"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </span>
                                          </>
                                        ) : (
                                          <span className="text-[11.5px] text-status-pending-fg">
                                            No panchayat recorded
                                          </span>
                                        )}
                                      </div>

                                      {group.villages.map((village) => {
                                        const used = usage[village.id]
                                        return (
                                          <div
                                            key={village.id}
                                            className="flex h-[32px] items-center gap-2 border-t border-rule-faint pl-20 pr-3 hover:bg-surface-hover"
                                          >
                                            {nameCell('village', village.id, village.name)}
                                            {used && (used.centres > 0 || used.children > 0) ? (
                                              <span className="text-[11px] text-ink-faint">
                                                {used.centres} centres · {used.children} children
                                              </span>
                                            ) : (
                                              <span className="text-[11px] text-ink-faint">not used yet</span>
                                            )}
                                            <span className="ml-auto flex items-center gap-1.5">
                                              <select
                                                value={village.panchayat_id ?? ''}
                                                onChange={(e) => setVillagePanchayat(village.id, e.target.value)}
                                                disabled={busy}
                                                aria-label={`Panchayat for ${village.name}`}
                                                className="h-[26px] rounded-md border border-rule-strong bg-surface px-1.5 text-[12px] outline-none focus:border-blue-500"
                                              >
                                                <option value="">No panchayat</option>
                                                {panchayatsIn(tree, taluk.id).map((p) => (
                                                  <option key={p.id} value={p.id}>
                                                    {p.name}
                                                  </option>
                                                ))}
                                              </select>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setRenaming({ kind: 'village', id: village.id, name: village.name })
                                                }
                                                className={iconBtn}
                                                title="Rename"
                                                aria-label="Rename village"
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setConfirmDelete({
                                                    kind: 'village',
                                                    id: village.id,
                                                    name: village.name,
                                                  })
                                                }
                                                className={iconBtn}
                                                title="Remove"
                                                aria-label="Remove village"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ))}
                              </div>
                            )
                          })}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-md rounded-lg border border-rule bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-[15px] font-semibold">Remove {confirmDelete.name}?</h2>
            <p className="mb-4 text-[13px] leading-relaxed text-ink-muted">
              This only works if nothing points at it. A {KIND_LABEL[confirmDelete.kind]} still in use, or with places
              under it, is refused and nothing changes.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-[32px] rounded-md border border-rule-strong px-3 text-[13px] hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="h-[32px] rounded-md bg-status-returned-fg px-3 text-[13px] font-medium text-surface disabled:opacity-50"
              >
                {busy ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
