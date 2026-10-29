'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Building2, AlertTriangle, Ban } from 'lucide-react'
import { IMPORT_SPECS, type ImportEntity } from '../../../lib/importSpecs'

export interface ReviewFile {
  id: string
  entity: ImportEntity
  rows: Record<string, any>[]
}

export interface PreflightResult {
  centres: {
    existing: { eac_no: number; village_name: string | null }[]
    missing: number[]
  }
  perEntity: Record<string, { existingKeys: string[]; total: number }>
}

const pairKey = (eac: unknown, reg: unknown) => `${String(eac)}::${String(reg)}`

interface CentreDiff {
  eacNo: number
  isNew: boolean
  existingName: string | null
  villageName?: string
  district?: string
  taluk?: string
  panchayat?: string
  newChildren: number
  existingChildren: number
  /** Fields where the centre's child rows disagree (beyond casing). */
  conflictingFields: string[]
}

interface ChildRow {
  regNo: string | number
  name: string
  gender?: string
  dob?: string
  childLeft?: boolean
  isNew: boolean
}

export default function ImportReview({
  files,
  preflight,
  createMissingCentres,
  conflictStrategy = 'skip',
}: {
  files: ReviewFile[]
  preflight: PreflightResult
  createMissingCentres: boolean
  conflictStrategy?: 'skip' | 'abort' | 'stage'
}) {
  // Under "hold back for review" a colliding row isn't dropped — it's compared
  // against the stored record afterwards, and only differences need a decision.
  const staging = conflictStrategy === 'stage'

  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const { centres, entityRows, childrenByCentre, totals } = useMemo(() => {
    const childFile = files.find((f) => f.entity === 'child_data')
    const missingSet = new Set(preflight.centres.missing)
    const existingNameByEac = new Map(preflight.centres.existing.map((c) => [c.eac_no, c.village_name]))

    // Per-table add/skip counts
    const entityRows = files.map((file) => {
      const existing = new Set(preflight.perEntity[file.entity]?.existingKeys ?? [])
      const skipped = file.rows.filter((r) => existing.has(pairKey(r.eac_no, r.reg_no))).length
      return {
        entity: file.entity,
        label: IMPORT_SPECS[file.entity].label,
        table: IMPORT_SPECS[file.entity].table,
        total: file.rows.length,
        toAdd: file.rows.length - skipped,
        skipped,
      }
    })

    // Centre-level diff, derived from the child rows (which carry the geography)
    const centreMap = new Map<number, CentreDiff>()
    const childrenByCentre = new Map<number, ChildRow[]>()

    // Track distinct values per centre so genuine disagreements can be flagged.
    const seenValues = new Map<number, Record<string, Set<string>>>()
    const noteValue = (eacNo: number, field: string, value: unknown) => {
      if (value === null || value === undefined) return
      const s = String(value).trim()
      if (!s) return
      if (!seenValues.has(eacNo)) seenValues.set(eacNo, {})
      const rec = seenValues.get(eacNo)!
      if (!rec[field]) rec[field] = new Set()
      // Compare case-insensitively — "DEVANAHALLI" vs "Devanhalli" is noise.
      rec[field].add(s.toLowerCase())
    }

    if (childFile) {
      const existingChildKeys = new Set(preflight.perEntity['child_data']?.existingKeys ?? [])

      for (const row of childFile.rows) {
        const eacNo = Number(row.eac_no)
        if (!centreMap.has(eacNo)) {
          centreMap.set(eacNo, {
            eacNo,
            isNew: missingSet.has(eacNo),
            existingName: existingNameByEac.get(eacNo) ?? null,
            villageName: row.village_name,
            district: row.district,
            taluk: row.taluk,
            panchayat: row.panchayat,
            newChildren: 0,
            existingChildren: 0,
            conflictingFields: [],
          })
        }

        noteValue(eacNo, 'village', row.village_name)
        noteValue(eacNo, 'district', row.district)
        noteValue(eacNo, 'taluk', row.taluk)
        noteValue(eacNo, 'panchayat', row.panchayat)

        const centre = centreMap.get(eacNo)!
        const isNew = !existingChildKeys.has(pairKey(row.eac_no, row.reg_no))
        if (isNew) centre.newChildren += 1
        else centre.existingChildren += 1

        if (!childrenByCentre.has(eacNo)) childrenByCentre.set(eacNo, [])
        childrenByCentre.get(eacNo)!.push({
          regNo: row.reg_no,
          name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed',
          gender: row.gender,
          dob: row.dateofbirth,
          childLeft: row.child_left,
          isNew,
        })
      }
    }

    for (const list of Array.from(childrenByCentre.values())) {
      list.sort((a, b) => Number(a.regNo) - Number(b.regNo))
    }

    for (const centre of Array.from(centreMap.values())) {
      const rec = seenValues.get(centre.eacNo)
      if (!rec) continue
      centre.conflictingFields = Object.keys(rec).filter((f) => rec[f].size > 1)
    }

    const centres = Array.from(centreMap.values()).sort((a, b) => a.eacNo - b.eacNo)

    const totals = {
      newCentres: centres.filter((c) => c.isNew).length,
      conflictedCentres: centres.filter((c) => c.isNew && c.conflictingFields.length > 0).length,
      newRecords: entityRows.reduce((s, e) => s + e.toAdd, 0),
      skippedRecords: entityRows.reduce((s, e) => s + e.skipped, 0),
      childrenAdded: entityRows.find((e) => e.entity === 'child_data')?.toAdd ?? 0,
      leaving: childFile ? childFile.rows.filter((r) => r.child_left === true).length : 0,
    }

    return { centres, entityRows, childrenByCentre, totals }
  }, [files, preflight])

  const toggle = (eacNo: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(eacNo)) next.delete(eacNo)
      else next.add(eacNo)
      return next
    })
  }

  const blockedOnCentres = totals.newCentres > 0 && !createMissingCentres

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule md:grid-cols-4">
        {[
          { label: 'Records added', value: `+${totals.newRecords.toLocaleString()}`, tone: 'text-status-approved-fg' },
          { label: 'Children', value: `+${totals.childrenAdded.toLocaleString()}`, tone: 'text-status-approved-fg' },
          {
            label: 'New centres',
            value: `+${totals.newCentres}`,
            tone: totals.newCentres > 0 ? 'text-blue-600' : 'text-ink-faint',
          },
          {
            label: staging ? 'Already there — to review' : 'Skipped (already there)',
            value: totals.skippedRecords.toLocaleString(),
            tone: totals.skippedRecords > 0 ? 'text-status-pending-fg' : 'text-ink-faint',
          },
        ].map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1.5 bg-surface px-4 py-3.5">
            <span className="text-[12.5px] text-ink-muted">{tile.label}</span>
            <span className={`text-xl font-semibold tracking-tight ${tile.tone}`}>{tile.value}</span>
          </div>
        ))}
      </div>

      {blockedOnCentres && (
        <div className="flex items-start gap-3 rounded-md border border-status-pending-fg/30 bg-status-pending-bg px-4 py-3.5">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-status-pending-fg" />
          <div className="text-[13.5px] leading-relaxed text-status-pending-fg">
            <p className="text-[14.5px] font-medium">{totals.newCentres} centre(s) don&apos;t exist yet.</p>
            <p className="mt-0.5">
              Children can&apos;t be added to a centre that isn&apos;t in the system. Tick{' '}
              <span className="font-medium">&ldquo;Create centres that don&apos;t exist yet&rdquo;</span> above, or add
              them in Centre Management first.
            </p>
          </div>
        </div>
      )}

      {/* Per-table */}
      <div className="overflow-hidden rounded-md border border-rule">
        <div className="border-b border-rule bg-surface-sunken px-4 py-2.5">
          <h4 className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Tables</h4>
        </div>
        <table className="w-full">
          <tbody className="divide-y divide-rule">
            {entityRows.map((e) => (
              <tr key={e.entity}>
                <td className="px-4 py-2.5 text-[14px]">{e.label}</td>
                <td className="px-4 py-2.5 font-mono text-[12.5px] text-ink-faint">{e.table}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-mono text-[14px] tabular-nums text-status-approved-fg">
                    +{e.toAdd.toLocaleString()}
                  </span>
                </td>
                <td className="w-32 px-4 py-2.5 text-right">
                  {e.skipped > 0 ? (
                    <span className="font-mono text-[13.5px] tabular-nums text-status-pending-fg">
                      {e.skipped} {staging ? 'to review' : 'skipped'}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Centres + children */}
      <div className="overflow-hidden rounded-md border border-rule">
        <div className="flex items-center justify-between border-b border-rule bg-surface-sunken px-4 py-2.5">
          <h4 className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">
            Centres ({centres.length})
          </h4>
          <span className="text-[12px] text-ink-faint">click a centre to see its children</span>
        </div>

        <div className="max-h-[28rem] divide-y divide-rule overflow-y-auto">
          {centres.map((c) => {
            const isOpen = expanded.has(c.eacNo)
            const kids = childrenByCentre.get(c.eacNo) ?? []

            return (
              <div key={c.eacNo}>
                <button
                  onClick={() => toggle(c.eacNo)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover ${
                    c.isNew ? 'border-l-2 border-l-status-approved-fg' : 'border-l-2 border-l-transparent'
                  }`}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  )}
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  <span className="w-12 font-mono text-[13.5px] tabular-nums text-ink-muted">{c.eacNo}</span>

                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {c.villageName || c.existingName || '—'}
                    {(c.district || c.taluk) && (
                      <span className="text-ink-faint">
                        {' '}
                        · {[c.taluk, c.district].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </span>

                  {c.isNew && c.conflictingFields.length > 0 && (
                    <span
                      title={`Child rows disagree on: ${c.conflictingFields.join(', ')} — the most common value will be used. Verify in Centre Management.`}
                      className="shrink-0 rounded bg-status-pending-bg px-1.5 py-0.5 text-[12px] font-medium text-status-pending-fg"
                    >
                      check {c.conflictingFields.join('/')}
                    </span>
                  )}
                  {c.isNew ? (
                    <span className="shrink-0 rounded bg-status-approved-bg px-1.5 py-0.5 text-[12px] font-medium text-status-approved-fg">
                      new centre
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[12px] text-ink-muted">
                      exists
                    </span>
                  )}

                  <span className="w-16 shrink-0 text-right font-mono text-[12.5px] tabular-nums text-status-approved-fg">
                    +{c.newChildren}
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-[12.5px] tabular-nums text-ink-faint">
                    {c.existingChildren > 0 ? `${c.existingChildren} ${staging ? 'review' : 'skip'}` : ''}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-rule bg-surface-sunken">
                    <table className="w-full">
                      <tbody className="divide-y divide-rule">
                        {kids.map((k) => (
                          <tr key={String(k.regNo)} className={k.isNew ? '' : 'opacity-50'}>
                            <td className="w-8 py-1.5 pl-12 pr-2">
                              <span
                                className={`font-mono text-[14px] ${
                                  k.isNew ? 'text-status-approved-fg' : 'text-ink-faint'
                                }`}
                              >
                                {k.isNew ? '+' : '~'}
                              </span>
                            </td>
                            <td className="w-16 px-2 py-1.5 font-mono text-[12.5px] tabular-nums text-ink-muted">
                              {String(k.regNo)}
                            </td>
                            <td className="px-2 py-1.5 text-[14px]">{k.name}</td>
                            <td className="w-20 px-2 py-1.5 text-[12.5px] text-ink-muted">{k.gender ?? ''}</td>
                            <td className="w-24 px-2 py-1.5 font-mono text-[12.5px] text-ink-muted">
                              {k.dob ?? ''}
                            </td>
                            <td className="w-24 px-2 py-1.5">
                              {k.childLeft === true && (
                                <span className="rounded bg-status-inactive-bg px-1.5 py-0.5 text-[10px] font-medium text-status-inactive-fg">
                                  left
                                </span>
                              )}
                            </td>
                            <td className="w-20 px-4 py-1.5 text-right">
                              {!k.isNew && (
                                <span className="text-[11.5px] text-ink-faint">
                                  {staging ? 'review' : 'skipped'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {totals.conflictedCentres > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-status-pending-fg/30 bg-status-pending-bg px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-pending-fg" />
          <p className="text-[13.5px] leading-relaxed text-status-pending-fg">
            <span className="font-medium">{totals.conflictedCentres}</span> of the new centres have children
            recording different districts/taluks/villages. Those Access columns describe where the{' '}
            <span className="font-medium">child</span> lives, not the centre, so the most common value is used —
            worth confirming in Centre Management afterwards.
          </p>
        </div>
      )}

      {totals.leaving > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-rule bg-surface-sunken px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">{totals.leaving}</span> of these children are marked as
            having left the programme (from the <span className="font-mono text-[12.5px]">Onroll</span> flag) and will be
            imported with <span className="font-mono text-[12.5px]">child_left</span> set — they&apos;ll show as{' '}
            <span className="font-medium">LEFT</span> in All Records.
          </p>
        </div>
      )}
    </div>
  )
}
