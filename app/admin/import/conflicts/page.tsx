'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequireRole } from '../../../../lib/hooks'
import { supabase } from '../../../../lib/supabase'
import { getErrorMessage } from '../../../../lib/errors'
import { Alert, LoadingSpinner } from '../../../components/UI'
import AdminShell from '../../AdminShell'
import { IMPORT_SPECS, type ImportEntity } from '../../../../lib/importSpecs'
import { fieldLabel } from '../../../../lib/importDiff'
import { ChevronDown, ChevronRight, Check, X, Database, FileSpreadsheet, Undo2 } from 'lucide-react'

/**
 * Reviewing the records an import held back.
 *
 * A staged conflict is a record the file and the database both describe, but
 * differently. Each differing field is shown side by side and defaults to the
 * file's value — that's why the row was staged — but every field can be flipped
 * back to what's stored, or edited outright before it's written.
 */

interface StagedRow {
  id: string
  batch_id: string
  entity: ImportEntity
  table_name: string
  eac_no: string
  reg_no: string
  incoming: Record<string, any>
  existing: Record<string, any>
  diff_fields: string[]
  created_at: string
}

/** Per-conflict review state: which fields to write, and any hand-edited value. */
interface Decision {
  take: Record<string, boolean>
  edits: Record<string, string>
}

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  const s = String(v)
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/.exec(s)
  return iso ? iso[1] : s
}

const nameOf = (row: StagedRow): string => {
  const src = { ...row.existing, ...row.incoming }
  return [src.first_name, src.last_name].filter(Boolean).join(' ') || `Reg ${row.reg_no}`
}

export default function ImportConflictsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [token, setToken] = useState<string | null>(null)
  const [rows, setRows] = useState<StagedRow[]>([])
  const [total, setTotal] = useState(0)
  const [byEntity, setByEntity] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [entity, setEntity] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [setupRequired, setSetupRequired] = useState(false)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isAuthorized) return
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null))
  }, [isAuthorized])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ state: 'pending', page: String(page) })
      if (entity) params.set('entity', entity)

      const res = await fetch(`/api/admin/import/conflicts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load conflicts')

      setRows(json.rows || [])
      setTotal(json.total || 0)
      setByEntity(json.byEntity || {})
      setPageSize(json.pageSize || 50)
      setSetupRequired(Boolean(json.setupRequired))
      setSelected(new Set())
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load conflicts.'))
    } finally {
      setLoading(false)
    }
  }, [token, page, entity])

  useEffect(() => {
    load()
  }, [load])

  /** Everything defaults to taking the file's value; the reviewer opts out. */
  const decisionFor = useCallback(
    (row: StagedRow): Decision =>
      decisions[row.id] ?? {
        take: Object.fromEntries(row.diff_fields.map((f) => [f, true])),
        edits: {},
      },
    [decisions]
  )

  const setDecision = (row: StagedRow, next: Decision) =>
    setDecisions((d) => ({ ...d, [row.id]: next }))

  const toggleField = (row: StagedRow, field: string) => {
    const d = decisionFor(row)
    setDecision(row, { ...d, take: { ...d.take, [field]: !d.take[field] } })
  }

  const editField = (row: StagedRow, field: string, value: string) => {
    const d = decisionFor(row)
    setDecision(row, { ...d, take: { ...d.take, [field]: true }, edits: { ...d.edits, [field]: value } })
  }

  const resolve = async (targets: StagedRow[], action: 'apply' | 'discard') => {
    if (!token || targets.length === 0) return
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const values: Record<string, Record<string, unknown>> = {}
      if (action === 'apply') {
        for (const row of targets) {
          const d = decisionFor(row)
          const patch: Record<string, unknown> = {}
          for (const field of row.diff_fields) {
            if (!d.take[field]) continue
            if (field in d.edits) {
              // A cleared box means "no value", not an empty string in a
              // numeric or date column.
              const edited = d.edits[field].trim()
              patch[field] = edited === '' ? null : edited
            } else {
              patch[field] = row.incoming[field]
            }
          }
          values[row.id] = patch
        }
      }

      const res = await fetch('/api/admin/import/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ids: targets.map((r) => r.id), ...(action === 'apply' ? { values } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not resolve')

      const failed = (json.failures || []).length
      setNotice(
        `${action === 'apply' ? 'Applied' : 'Discarded'} ${json.resolved} conflict${
          json.resolved === 1 ? '' : 's'
        }.` + (failed ? ` ${failed} could not be written — see below.` : '')
      )
      if (failed) {
        setError(
          (json.failures as any[])
            .slice(0, 5)
            .map((f) => `EAC ${f.eac_no} / reg ${f.reg_no}: ${f.message}`)
            .join(' · ')
        )
      }
      await load()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not resolve those conflicts.'))
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pendingTotal = useMemo(
    () => Object.values(byEntity).reduce((n, v) => n + v, 0),
    [byEntity]
  )
  const selectedRows = rows.filter((r) => selected.has(r.id))

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

  return (
    <AdminShell
      active="/admin/import"
      breadcrumb={['Import', 'Conflicts']}
      username={profile.username}
      actions={
        <Link
          href="/admin/import"
          className="flex h-[30px] items-center gap-1.5 rounded-md border border-rule-strong px-3 text-[12.5px] transition-colors hover:bg-surface-hover"
        >
          <Undo2 className="h-3.5 w-3.5" /> Back to import
        </Link>
      }
    >
      <div className="px-10 pb-16 pt-8">
        <div className="max-w-[980px]">
          {error && <Alert type="error" message={error} className="mb-4" />}
          {notice && <Alert type="success" message={notice} className="mb-4" />}

          <div className="mb-6 flex flex-col gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight">Import conflicts</h1>
            <p className="max-w-[680px] text-[13.5px] leading-relaxed text-ink-muted">
              These records exist in both the file and the database, and disagree. Everything else from the
              import was already added. Each field below defaults to the file&apos;s value — untick to keep what
              &apos;s stored, or type over it.
            </p>
          </div>

          {setupRequired && (
            <div className="mb-6 rounded-md border border-status-pending-fg/30 bg-status-pending-bg px-4 py-3.5 text-[13px] text-status-pending-fg">
              The <span className="font-mono">import_staging</span> table doesn&apos;t exist yet. Run{' '}
              <span className="font-mono">sql/001_import_staging.sql</span> in the Supabase SQL editor, then
              re-run the import with conflict review turned on.
            </div>
          )}

          {!loading && pendingTotal === 0 && !setupRequired ? (
            <div className="rounded-md border border-rule px-4 py-10 text-center">
              <p className="text-[13.5px] text-ink-muted">
                Nothing waiting. Conflicts appear here when an import finds records that already exist and say
                something different.
              </p>
            </div>
          ) : (
            <>
              {/* Entity filter */}
              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEntity('')
                    setPage(1)
                  }}
                  className={`h-7 rounded-md px-3 text-[12.5px] transition-colors ${
                    entity === '' ? 'bg-ink text-surface' : 'border border-rule-strong hover:bg-surface-hover'
                  }`}
                >
                  All {pendingTotal > 0 && `(${pendingTotal})`}
                </button>
                {Object.entries(byEntity).map(([key, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setEntity(key)
                      setPage(1)
                    }}
                    className={`h-7 rounded-md px-3 text-[12.5px] transition-colors ${
                      entity === key ? 'bg-ink text-surface' : 'border border-rule-strong hover:bg-surface-hover'
                    }`}
                  >
                    {IMPORT_SPECS[key as ImportEntity]?.label ?? key} ({count})
                  </button>
                ))}
              </div>

              {/* Bulk bar */}
              <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-md border border-rule bg-surface-sunken px-3.5 py-2.5">
                <label className="flex items-center gap-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                    }
                  />
                  Select all on this page
                </label>
                <span className="text-[12.5px] text-ink-muted">
                  {selected.size > 0 ? `${selected.size} selected` : `${total} pending`}
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    disabled={busy || selected.size === 0}
                    onClick={() => resolve(selectedRows, 'discard')}
                    className="flex h-[30px] items-center gap-1.5 rounded-md border border-rule-strong bg-surface px-3 text-[12.5px] transition-colors hover:bg-surface-hover disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Keep stored version
                  </button>
                  <button
                    type="button"
                    disabled={busy || selected.size === 0}
                    onClick={() => resolve(selectedRows, 'apply')}
                    className="flex h-[30px] items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Apply selected
                  </button>
                </div>
              </div>

              {/* Conflicts */}
              <div className="overflow-hidden rounded-md border border-rule">
                {loading ? (
                  <div className="px-4 py-10 text-center text-[13px] text-ink-muted">Loading conflicts…</div>
                ) : rows.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-ink-muted">
                    Nothing pending for this table.
                  </div>
                ) : (
                  rows.map((row, i) => {
                    const open = expanded.has(row.id)
                    const d = decisionFor(row)
                    const taking = row.diff_fields.filter((f) => d.take[f]).length

                    return (
                      <div key={row.id} className={i > 0 ? 'border-t border-rule' : ''}>
                        <div className="flex items-center gap-3 px-3.5 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={(e) =>
                              setSelected((s) => {
                                const next = new Set(s)
                                if (e.target.checked) next.add(row.id)
                                else next.delete(row.id)
                                return next
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((s) => {
                                const next = new Set(s)
                                if (next.has(row.id)) next.delete(row.id)
                                else next.add(row.id)
                                return next
                              })
                            }
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            {open ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                            )}
                            <span className="w-24 shrink-0 font-mono text-[11.5px] text-ink-muted">
                              {row.eac_no} / {row.reg_no}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13.5px]">{nameOf(row)}</span>
                            <span className="shrink-0 rounded bg-surface-hover px-2 py-0.5 text-[11px] text-ink-muted">
                              {IMPORT_SPECS[row.entity]?.label ?? row.entity}
                            </span>
                            <span className="w-24 shrink-0 text-right text-[12px] text-status-pending-fg">
                              {row.diff_fields.length} field{row.diff_fields.length === 1 ? '' : 's'}
                            </span>
                          </button>
                        </div>

                        {open && (
                          <div className="border-t border-rule bg-surface-sunken px-3.5 py-3">
                            <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-1">
                              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                                Field
                              </span>
                              <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                                <Database className="h-3 w-3" /> In the database
                              </span>
                              <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                                <FileSpreadsheet className="h-3 w-3" /> In the file
                              </span>
                            </div>

                            <div className="flex flex-col gap-px overflow-hidden rounded border border-rule bg-rule">
                              {row.diff_fields.map((field) => {
                                const take = Boolean(d.take[field])
                                const value = field in d.edits ? d.edits[field] : show(row.incoming[field])
                                return (
                                  <div
                                    key={field}
                                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 bg-surface px-3 py-2"
                                  >
                                    <label className="flex min-w-0 items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={take}
                                        onChange={() => toggleField(row, field)}
                                      />
                                      <span className="truncate text-[12.5px]">{fieldLabel(field)}</span>
                                    </label>

                                    <span
                                      className={`min-w-0 truncate text-[12.5px] ${
                                        take ? 'text-ink-faint line-through' : 'text-ink'
                                      }`}
                                      title={show(row.existing[field])}
                                    >
                                      {show(row.existing[field])}
                                    </span>

                                    <input
                                      value={value === '—' ? '' : value}
                                      onChange={(e) => editField(row, field, e.target.value)}
                                      placeholder="blank"
                                      className={`h-7 w-full rounded border px-2 text-[12.5px] outline-none focus:border-blue-500 ${
                                        take
                                          ? 'border-status-approved-fg/30 bg-status-approved-bg text-status-approved-fg'
                                          : 'border-rule bg-surface-sunken text-ink-faint'
                                      }`}
                                    />
                                  </div>
                                )
                              })}
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-[12px] text-ink-muted">
                                {taking === 0
                                  ? 'Keeping the stored record as it is.'
                                  : `Writing ${taking} of ${row.diff_fields.length} field${
                                      row.diff_fields.length === 1 ? '' : 's'
                                    }.`}
                              </span>
                              <div className="ml-auto flex gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => resolve([row], 'discard')}
                                  className="flex h-[30px] items-center rounded-md border border-rule-strong bg-surface px-3 text-[12.5px] hover:bg-surface-hover disabled:opacity-50"
                                >
                                  Keep stored version
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => resolve([row], 'apply')}
                                  className="flex h-[30px] items-center rounded-md bg-blue-600 px-3 text-[12.5px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {taking === 0 ? 'Close conflict' : 'Apply'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[12.5px] text-ink-muted">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="flex h-[30px] items-center rounded-md border border-rule-strong px-3 text-[12.5px] hover:bg-surface-hover disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="flex h-[30px] items-center rounded-md border border-rule-strong px-3 text-[12.5px] hover:bg-surface-hover disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
