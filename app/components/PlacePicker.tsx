'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Check, Loader2 } from 'lucide-react'
import {
  type PlaceKind,
  type PlaceTree,
  panchayatsIn,
  villagesByPanchayat,
  resolveVillage,
  taluksIn,
  villagesIn,
} from '../../lib/places'

/**
 * District › taluk › village, tied together.
 *
 * Picking a district narrows the taluk list to that district's taluks; picking
 * a taluk narrows the village list to that taluk's villages. You cannot land on
 * a village that contradicts the district above it, because the list it came
 * from was derived from that district.
 *
 * The value is a single `village_id` — the village already knows its taluk and
 * district, so storing the chain again is what let them drift apart before.
 */

export interface PlacePickerProps {
  tree: PlaceTree
  villageId: string | null
  onChange: (villageId: string | null) => void
  /** Admins may add a place that isn't on the list yet; nobody else can. */
  canCreate?: boolean
  onCreate?: (kind: PlaceKind, name: string, parentId: string | null, panchayatId?: string | null) => Promise<string>
  disabled?: boolean
  /** Show the panchayat row. It is a real level in the database but never a
   *  step on the way to a village, so it is off unless asked for. */
  showPanchayat?: boolean
  required?: boolean
}

const ADD = '__add__'

const selectClass =
  'h-8 w-full rounded-md border border-rule bg-surface px-2 text-[14px] outline-none transition-colors ' +
  'focus:border-rule-strong disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-faint'

export default function PlacePicker({
  tree,
  villageId,
  onChange,
  canCreate = false,
  onCreate,
  disabled = false,
  showPanchayat = false,
  required = false,
}: PlacePickerProps) {
  const resolved = useMemo(() => resolveVillage(tree, villageId), [tree, villageId])

  // District and taluk are only held locally while the user is part-way through
  // a selection. Once a village is chosen the tree is the source of truth.
  const [districtId, setDistrictId] = useState<string | null>(null)
  const [talukId, setTalukId] = useState<string | null>(null)

  useEffect(() => {
    if (resolved.district) setDistrictId(resolved.district.id)
    if (resolved.taluk) setTalukId(resolved.taluk.id)
  }, [resolved.district, resolved.taluk])

  const [adding, setAdding] = useState<PlaceKind | null>(null)
  const [draft, setDraft] = useState('')
  /** Panchayat for a village being added; blank means not known yet. */
  const [draftPanchayat, setDraftPanchayat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const districts = useMemo(
    () => [...tree.districts].sort((a, b) => a.name.localeCompare(b.name)),
    [tree.districts]
  )
  const taluks = useMemo(() => taluksIn(tree, districtId), [tree, districtId])
  const villages = useMemo(() => villagesIn(tree, talukId), [tree, talukId])
  const panchayats = useMemo(() => panchayatsIn(tree, talukId), [tree, talukId])
  // The village list is grouped by panchayat: one taluk can hold 20+ villages,
  // and the panchayat is the only thing that makes them scannable.
  const villageGroups = useMemo(() => villagesByPanchayat(tree, talukId), [tree, talukId])

  const parentFor = (kind: PlaceKind) =>
    kind === 'district' ? null : kind === 'taluk' ? districtId : talukId

  const beginAdd = (kind: PlaceKind) => {
    setAdding(kind)
    setDraft('')
    setDraftPanchayat('')
    setError('')
  }

  const commitAdd = async () => {
    if (!onCreate || !adding) return
    const name = draft.trim()
    if (!name) return
    setBusy(true)
    setError('')
    try {
      const id = await onCreate(
        adding,
        name,
        parentFor(adding),
        // Only a village carries a panchayat, and this is the one moment it is
        // chosen — afterwards the picker only reports it.
        adding === 'village' ? draftPanchayat || null : undefined
      )
      if (adding === 'district') {
        setDistrictId(id)
        setTalukId(null)
        onChange(null)
      } else if (adding === 'taluk') {
        setTalukId(id)
        onChange(null)
      } else if (adding === 'village') {
        onChange(id)
      }
      setAdding(null)
      setDraft('')
      setDraftPanchayat('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add that.')
    } finally {
      setBusy(false)
    }
  }

  const rows: { kind: PlaceKind; label: string; value: string; options: { id: string; name: string }[]; disabled: boolean; onPick: (v: string) => void }[] = [
    {
      kind: 'district',
      label: 'District',
      value: districtId ?? '',
      options: districts,
      disabled: false,
      onPick: (v) => {
        setDistrictId(v || null)
        setTalukId(null)
        onChange(null)
      },
    },
    {
      kind: 'taluk',
      label: 'Taluk',
      value: talukId ?? '',
      options: taluks,
      disabled: !districtId,
      onPick: (v) => {
        setTalukId(v || null)
        onChange(null)
      },
    },
    {
      kind: 'village',
      label: 'Village',
      value: villageId ?? '',
      options: villages,
      disabled: !talukId,
      onPick: (v) => onChange(v || null),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <label key={row.kind} className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-muted">
              {row.label}
              {required && row.kind === 'village' && <span className="text-status-returned-fg"> *</span>}
            </span>
            <select
              value={row.value}
              disabled={disabled || row.disabled}
              className={selectClass}
              onChange={(e) => {
                if (e.target.value === ADD) {
                  beginAdd(row.kind)
                  return
                }
                row.onPick(e.target.value)
              }}
            >
              <option value="">
                {row.disabled
                  ? row.kind === 'taluk'
                    ? 'Pick a district first'
                    : 'Pick a taluk first'
                  : `Select ${row.label.toLowerCase()}…`}
              </option>
              {row.kind === 'village'
                ? villageGroups.map((group) => (
                    <optgroup
                      key={group.panchayat?.id ?? 'none'}
                      label={group.panchayat ? `${group.panchayat.name} panchayat` : 'No panchayat recorded'}
                    >
                      {group.villages.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </optgroup>
                  ))
                : row.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              {canCreate && !row.disabled && <option value={ADD}>+ Add a {row.label.toLowerCase()}…</option>}
            </select>
            {row.kind === 'village' && !row.disabled && row.options.length === 0 && (
              <span className="text-[12px] text-ink-faint">No villages recorded in this taluk yet.</span>
            )}
          </label>
        ))}
      </div>

      {showPanchayat && (
        <label className="flex max-w-[260px] flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-muted">Panchayat</span>
          {/* Read-only on purpose: the panchayat belongs to the village record,
              so editing it here would change it for every centre and child in
              that village, not just this one. Rendered as text rather than a
              disabled <select> so it never looks like a choice. */}
          <output
            className="flex h-8 w-full items-center rounded-md border border-rule bg-surface-sunken px-2 text-[14px] text-ink-muted"
            aria-label="Panchayat"
          >
            {resolved.panchayat?.name ?? (villageId ? 'Not recorded' : 'Pick a village first')}
          </output>
          <span className="text-[12px] text-ink-faint">
            Comes from the village. Change it on the village, not here.
          </span>
        </label>
      )}

      {adding && (
        <div className="flex flex-col gap-2 rounded-md border border-rule bg-surface-sunken p-3">
          <span className="text-[13px] font-medium">
            New {adding}
            {adding === 'taluk' && resolved.district
              ? ` in ${resolved.district.name}`
              : adding === 'taluk' && districtId
              ? ` in ${districts.find((d) => d.id === districtId)?.name ?? ''}`
              : adding === 'village' && talukId
              ? ` in ${taluks.find((t) => t.id === talukId)?.name ?? ''}`
              : ''}
          </span>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitAdd()
                }
                if (e.key === 'Escape') setAdding(null)
              }}
              placeholder={`Name of the ${adding}`}
              className="h-8 flex-1 rounded-md border border-rule bg-surface px-2.5 text-[14px] outline-none focus:border-rule-strong"
            />
            <button
              type="button"
              onClick={commitAdd}
              disabled={busy || !draft.trim()}
              className="flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13.5px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Add
            </button>
            <button
              type="button"
              onClick={() => setAdding(null)}
              className="flex h-8 items-center rounded-md border border-rule-strong px-2.5 text-[13.5px] transition-colors hover:bg-surface-hover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {adding === 'village' && (
            <label className="flex flex-col gap-1">
              <span className="text-[12.5px] text-ink-muted">Panchayat</span>
              <select
                value={draftPanchayat}
                onChange={(e) => setDraftPanchayat(e.target.value)}
                className="h-8 rounded-md border border-rule bg-surface px-2 text-[14px] outline-none focus:border-rule-strong"
              >
                <option value="">Not known yet</option>
                {panchayats.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="text-[12px] text-ink-faint">
                {panchayats.length === 0
                  ? 'No panchayats recorded in this taluk yet.'
                  : 'Can be left blank and filled in later.'}
              </span>
            </label>
          )}
          {error && <span className="text-[12.5px] text-status-returned-fg">{error}</span>}
        </div>
      )}

      {villageId && resolved.village && (
        <span className="text-[12.5px] text-ink-faint">
          {[resolved.village.name, resolved.panchayat?.name, resolved.taluk?.name, resolved.district?.name]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </div>
  )
}
