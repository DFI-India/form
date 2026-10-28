'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { getErrorMessage } from '../../../lib/errors'
import { toCsv } from '../../../lib/csv'
import { LoadingSpinner, Alert } from '../../components/UI'
import AdminShell from '../AdminShell'
import {
  OPERATORS,
  REPORT_SOURCES,
  fieldMap,
  fieldsOf,
  type ReportField,
  type ReportSource,
} from '../../../lib/reportFields'
import { Play, Download, Printer, Plus, X, Search, Table2, Sigma, ListChecks } from 'lucide-react'
import Sheet from '../../components/Sheet'

/**
 * The report builder.
 *
 * Two shapes, one screen. "Rows" lists one line per child with the columns you
 * tick. "Summary" groups by one or two fields and counts or totals. Both read
 * the reporting views, so a field means the same thing either way.
 */

type Mode = 'list' | 'summary'

interface FilterRow {
  id: number
  field: string
  op: string
  value: string
  value2: string
}

interface Measure {
  id: number
  fn: 'count' | 'sum' | 'avg' | 'min' | 'max'
  field: string
}

const MEASURE_LABEL: Record<Measure['fn'], string> = {
  count: 'Count of',
  sum: 'Total',
  avg: 'Average',
  min: 'Lowest',
  max: 'Highest',
}

const cellText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text
}

let nextId = 1

export default function ReportsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [token, setToken] = useState<string | null>(null)
  const [source, setSource] = useState<ReportSource>('children')
  const [mode, setMode] = useState<Mode>('list')
  const [title, setTitle] = useState('')
  const [fieldQuery, setFieldQuery] = useState('')

  const [columns, setColumns] = useState<string[]>([])
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [measures, setMeasures] = useState<Measure[]>([])
  const [filters, setFilters] = useState<FilterRow[]>([])

  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [resultColumns, setResultColumns] = useState<string[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [ranAt, setRanAt] = useState<string>('')

  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [setupNeeded, setSetupNeeded] = useState(false)
  const hasRun = useRef(false)

  const definition = REPORT_SOURCES[source]
  const fields = useMemo(() => fieldsOf(source), [source])
  const byKey = useMemo(() => fieldMap(source), [source])

  useEffect(() => {
    if (!isAuthorized) return
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null))
  }, [isAuthorized])

  // Changing subject invalidates every field choice, so start that source clean.
  useEffect(() => {
    setColumns(fieldsOf(source).filter((f) => f.defaultColumn).map((f) => f.key))
    setGroupBy([])
    setMeasures([])
    setFilters([])
    setRows([])
    setResultColumns([])
    setTotal(0)
    hasRun.current = false
  }, [source])

  const grouped = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase()
    const out = new Map<string, ReportField[]>()
    for (const field of fields) {
      if (q && !field.label.toLowerCase().includes(q) && !field.group.toLowerCase().includes(q)) continue
      if (!out.has(field.group)) out.set(field.group, [])
      out.get(field.group)!.push(field)
    }
    return Array.from(out.entries())
  }, [fields, fieldQuery])

  const run = useCallback(async () => {
    if (!token) return
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          source,
          mode,
          columns,
          groupBy,
          measures: measures.map((m) => ({
            fn: m.fn,
            field: m.fn === 'count' ? undefined : m.field,
            alias: m.fn === 'count' ? 'count' : `${m.fn}_${m.field}`,
          })),
          filters: filters
            .filter((f) => f.field)
            .map((f) => ({ field: f.field, op: f.op, value: f.value, value2: f.value2 })),
          limit: 2000,
        }),
      })
      const json = await res.json()
      if (res.status === 503 && json.setupRequired) {
        setSetupNeeded(true)
        return
      }
      if (!res.ok) throw new Error(json.error || 'Could not run this report')

      setSetupNeeded(false)
      setRows(json.rows || [])
      setResultColumns(json.columns || [])
      setTotals(json.totals || {})
      setTotal(json.total ?? (json.rows?.length || 0))
      setTruncated(Boolean(json.truncated))
      setRanAt(new Date().toLocaleString())
      hasRun.current = true
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not run this report.'))
    } finally {
      setRunning(false)
    }
  }, [token, source, mode, columns, groupBy, measures, filters])

  /** Export re-runs at full size: the table on screen is only the first page. */
  const exportCsv = async () => {
    if (!token) return
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          source,
          mode,
          columns,
          groupBy,
          measures: measures.map((m) => ({
            fn: m.fn,
            field: m.fn === 'count' ? undefined : m.field,
            alias: m.fn === 'count' ? 'count' : `${m.fn}_${m.field}`,
          })),
          filters: filters
            .filter((f) => f.field)
            .map((f) => ({ field: f.field, op: f.op, value: f.value, value2: f.value2 })),
          limit: 20000,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not export this report')

      const cols: string[] = json.columns || []
      const header = cols.map((c) => byKey.get(c)?.label ?? c)
      const csv = toCsv(header, (json.rows || []).map((r: Record<string, unknown>) => cols.map((c) => r[c])))

      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${(title || definition.label).replace(/[^\w -]/g, '')}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not export this report.'))
    } finally {
      setRunning(false)
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
    'h-[30px] rounded-md border border-rule-strong bg-surface px-2 text-[12.5px] text-ink outline-none focus:border-blue-500'
  const inputClass =
    'h-[30px] rounded-md border border-rule-strong bg-surface px-2.5 text-[12.5px] text-ink outline-none placeholder:text-ink-faint focus:border-blue-500'

  /** Shared by the wide-screen column and the phone sheet. */
  const fieldPicker = (
    <>
      <div className="border-b border-rule p-3">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as ReportSource)}
          className={`${selectClass} w-full`}
        >
          {Object.values(REPORT_SOURCES).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="mt-2 flex h-[34px] items-center gap-2 rounded-md border border-rule-strong px-2.5 focus-within:border-blue-500">
          <Search className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
          <input
            value={fieldQuery}
            onChange={(e) => setFieldQuery(e.target.value)}
            placeholder="Find a field"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-medium text-ink-faint">
          {mode === 'list' ? 'Columns to show' : 'Columns (rows mode)'}
        </span>
        <button type="button" onClick={() => setColumns([])} className="text-[11px] text-ink-faint hover:text-ink">
          Clear
        </button>
      </div>

      {grouped.map(([group, list]) => (
        <div key={group} className="pb-1">
          <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">{group}</div>
          {list.map((field) => (
            <label
              key={field.key}
              className="flex min-h-[38px] cursor-pointer items-center gap-2.5 px-3 py-1 text-[13px] hover:bg-surface-hover"
            >
              <input
                type="checkbox"
                checked={columns.includes(field.key)}
                onChange={(e) =>
                  setColumns((c) => (e.target.checked ? [...c, field.key] : c.filter((k) => k !== field.key)))
                }
                className="h-4 w-4 accent-current"
              />
              <span className="min-w-0 flex-1 truncate">{field.label}</span>
            </label>
          ))}
        </div>
      ))}
    </>
  )

  const filterSummary = filters
    .filter((f) => f.field)
    .map((f) => {
      const label = byKey.get(f.field)?.label ?? f.field
      const op = OPERATORS[byKey.get(f.field)?.type ?? 'text'].find((o) => o.value === f.op)
      if (op?.args === 0) return `${label} ${op.label}`
      if (op?.args === 2) return `${label} ${op.label} ${f.value} and ${f.value2}`
      return `${label} ${op?.label ?? f.op} ${f.value}`
    })

  return (
    <AdminShell
      active="/admin/reports"
      breadcrumb={['Data', 'Reports']}
      username={profile.username}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={running || !hasRun.current}
            className="flex h-[28px] items-center gap-1.5 rounded-md border border-rule-strong px-2.5 text-[12.5px] transition-colors hover:bg-surface-hover disabled:opacity-40"
          >
            <Download className="h-[13px] w-[13px]" /> <span className="hidden sm:inline">Spreadsheet</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!hasRun.current}
            className="flex h-[28px] items-center gap-1.5 rounded-md border border-rule-strong px-2.5 text-[12.5px] transition-colors hover:bg-surface-hover disabled:opacity-40"
          >
            <Printer className="h-[13px] w-[13px]" /> <span className="hidden sm:inline">Print</span>
          </button>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="flex h-[28px] items-center gap-1.5 rounded-md bg-ink px-3 text-[12.5px] font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-[13px] w-[13px]" /> {running ? 'Running…' : 'Run'}
          </button>
        </div>
      }
    >
      <div className="flex h-full min-h-0">
        {/* Fields: a column when there is room, a sheet when there isn't. */}
        <aside className="print-hide hidden w-[264px] shrink-0 flex-col overflow-y-auto border-r border-rule lg:flex">
          {fieldPicker}
        </aside>

        <Sheet open={fieldsOpen} onClose={() => setFieldsOpen(false)} title="Fields" side="left">
          {fieldPicker}
        </Sheet>

        {/* Builder and result */}
        <div className="min-w-0 flex-1 overflow-y-auto print-sheet">
          <div className="px-6 pb-10 pt-5">
            {error && <Alert type="error" message={error} className="mb-4 print-hide" />}
            {setupNeeded && (
              <Alert
                type="warning"
                className="mb-4"
                message="The report views are not installed yet. Run sql/005_report_views.sql, then sql/006_report_functions.sql."
              />
            )}

            {/* Printed header. Hidden on screen; the toolbar covers it there. */}
            <div className="print-only mb-4">
              <h1 className="text-[18px] font-semibold">{title || `${definition.label} report`}</h1>
              <p className="mt-1 text-[12px]">
                Debora Foundation India · {ranAt || new Date().toLocaleString()} ·{' '}
                {total.toLocaleString()} {mode === 'list' ? definition.noun : 'groups'}
              </p>
              {filterSummary.length > 0 && <p className="mt-0.5 text-[12px]">Filters: {filterSummary.join('; ')}</p>}
            </div>

            <div className="print-hide">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${definition.label} report`}
                  className={`${inputClass} h-[34px] w-full text-[15px] font-semibold sm:w-[320px]`}
                />
                <button
                  type="button"
                  onClick={() => setFieldsOpen(true)}
                  className="flex h-[32px] items-center gap-1.5 rounded-md border border-rule-strong px-2.5 text-[12.5px] transition-colors hover:bg-surface-hover lg:hidden"
                >
                  <ListChecks className="h-[13px] w-[13px]" />
                  Fields
                  <span className="font-mono text-[11px] text-ink-faint">{columns.length}</span>
                </button>

                <div className="flex overflow-hidden rounded-md border border-rule-strong">
                  {(['list', 'summary'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex h-[32px] items-center gap-1.5 px-3 text-[12.5px] transition-colors ${
                        mode === m ? 'bg-ink text-surface' : 'hover:bg-surface-hover'
                      }`}
                    >
                      {m === 'list' ? <Table2 className="h-[13px] w-[13px]" /> : <Sigma className="h-[13px] w-[13px]" />}
                      {m === 'list' ? 'Rows' : 'Summary'}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'summary' && (
                <div className="mb-4 rounded-md border border-rule bg-surface-sunken p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="w-[74px] text-[11px] font-medium text-ink-faint">Group by</span>
                    {[0, 1].map((i) => (
                      <select
                        key={i}
                        value={groupBy[i] ?? ''}
                        onChange={(e) => {
                          const next = [...groupBy]
                          if (e.target.value) next[i] = e.target.value
                          else next.splice(i, 1)
                          setGroupBy(next.filter(Boolean))
                        }}
                        className={selectClass}
                      >
                        <option value="">{i === 0 ? 'Whole dataset' : 'and then…'}</option>
                        {fields
                          .filter((x) => x.groupable)
                          .map((x) => (
                            <option key={x.key} value={x.key}>
                              {x.label}
                            </option>
                          ))}
                      </select>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-start gap-2">
                    <span className="mt-1.5 w-[74px] text-[11px] font-medium text-ink-faint">Measure</span>
                    <div className="flex flex-col gap-2">
                      {measures.length === 0 && (
                        <span className="text-[12px] text-ink-faint">Counting rows. Add a total or average below.</span>
                      )}
                      {measures.map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <select
                            value={m.fn}
                            onChange={(e) =>
                              setMeasures((list) =>
                                list.map((x) => (x.id === m.id ? { ...x, fn: e.target.value as Measure['fn'] } : x))
                              )
                            }
                            className={selectClass}
                          >
                            {(['count', 'sum', 'avg', 'min', 'max'] as Measure['fn'][]).map((fn) => (
                              <option key={fn} value={fn}>
                                {MEASURE_LABEL[fn]}
                              </option>
                            ))}
                          </select>
                          {m.fn !== 'count' && (
                            <select
                              value={m.field}
                              onChange={(e) =>
                                setMeasures((list) =>
                                  list.map((x) => (x.id === m.id ? { ...x, field: e.target.value } : x))
                                )
                              }
                              className={selectClass}
                            >
                              <option value="">Pick a number field</option>
                              {fields
                                .filter((x) => x.summable)
                                .map((x) => (
                                  <option key={x.key} value={x.key}>
                                    {x.label}
                                  </option>
                                ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => setMeasures((list) => list.filter((x) => x.id !== m.id))}
                            className="rounded p-1 text-ink-faint hover:bg-surface-hover hover:text-ink"
                            aria-label="Remove measure"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setMeasures((list) => [...list, { id: nextId++, fn: 'sum', field: '' }])
                        }
                        className="flex h-[26px] w-fit items-center gap-1 rounded-md border border-rule-strong px-2 text-[12px] hover:bg-surface-hover"
                      >
                        <Plus className="h-3 w-3" /> Add a measure
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4 rounded-md border border-rule bg-surface-sunken p-3">
                <span className="mb-2 block text-[11px] font-medium text-ink-faint">Filters</span>
                <div className="flex flex-col gap-2">
                  {filters.length === 0 && (
                    <span className="text-[12px] text-ink-faint">No filters. The report covers everything.</span>
                  )}
                  {filters.map((row) => {
                    const field = byKey.get(row.field)
                    const ops = OPERATORS[field?.type ?? 'text']
                    const op = ops.find((o) => o.value === row.op) ?? ops[0]
                    return (
                      <div key={row.id} className="flex flex-wrap items-center gap-2">
                        <select
                          value={row.field}
                          onChange={(e) => {
                            const nextField = byKey.get(e.target.value)
                            const nextOps = OPERATORS[nextField?.type ?? 'text']
                            setFilters((list) =>
                              list.map((x) =>
                                x.id === row.id ? { ...x, field: e.target.value, op: nextOps[0].value } : x
                              )
                            )
                          }}
                          className={selectClass}
                        >
                          <option value="">Pick a field</option>
                          {fields.map((x) => (
                            <option key={x.key} value={x.key}>
                              {x.group} · {x.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={row.op}
                          onChange={(e) =>
                            setFilters((list) => list.map((x) => (x.id === row.id ? { ...x, op: e.target.value } : x)))
                          }
                          className={selectClass}
                        >
                          {ops.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>

                        {op.args > 0 &&
                          (field?.type === 'boolean' ? (
                            <select
                              value={row.value}
                              onChange={(e) =>
                                setFilters((list) =>
                                  list.map((x) => (x.id === row.id ? { ...x, value: e.target.value } : x))
                                )
                              }
                              className={selectClass}
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type={field?.type === 'date' ? 'date' : field?.type === 'number' ? 'number' : 'text'}
                              value={row.value}
                              onChange={(e) =>
                                setFilters((list) =>
                                  list.map((x) => (x.id === row.id ? { ...x, value: e.target.value } : x))
                                )
                              }
                              className={`${inputClass} w-full sm:w-[150px]`}
                            />
                          ))}

                        {op.args === 2 && (
                          <input
                            type={field?.type === 'date' ? 'date' : 'number'}
                            value={row.value2}
                            onChange={(e) =>
                              setFilters((list) =>
                                list.map((x) => (x.id === row.id ? { ...x, value2: e.target.value } : x))
                              )
                            }
                            className={`${inputClass} w-full sm:w-[150px]`}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => setFilters((list) => list.filter((x) => x.id !== row.id))}
                          className="rounded p-1 text-ink-faint hover:bg-surface-hover hover:text-ink"
                          aria-label="Remove filter"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((list) => [...list, { id: nextId++, field: '', op: 'eq', value: '', value2: '' }])
                    }
                    className="flex h-[26px] w-fit items-center gap-1 rounded-md border border-rule-strong px-2 text-[12px] hover:bg-surface-hover"
                  >
                    <Plus className="h-3 w-3" /> Add a filter
                  </button>
                </div>
              </div>
            </div>

            {/* Result */}
            {running ? (
              <div className="rounded-md border border-rule p-12 text-center print-hide">
                <LoadingSpinner size="lg" />
                <p className="mt-3 text-[13px] text-ink-muted">Running…</p>
              </div>
            ) : !hasRun.current ? (
              <div className="rounded-md border border-dashed border-rule-strong p-12 text-center print-hide">
                <p className="text-[13.5px] text-ink-muted">Choose what you want, then press Run.</p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between print-hide">
                  <span className="text-[12.5px] text-ink-faint">
                    {mode === 'list'
                      ? `${total.toLocaleString()} ${definition.noun}`
                      : `${rows.length.toLocaleString()} ${rows.length === 1 ? 'group' : 'groups'}`}
                    {truncated ? ` · showing the first ${rows.length.toLocaleString()}` : ''}
                  </span>
                  {truncated && (
                    <span className="text-[12px] text-status-pending-fg">
                      The spreadsheet download includes every row.
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto rounded-md border border-rule">
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-surface-sunken">
                        {resultColumns.map((c) => (
                          <th
                            key={c}
                            className="whitespace-nowrap border-b border-rule px-2.5 py-2 text-left text-[11.5px] font-medium text-ink-muted"
                          >
                            {byKey.get(c)?.label ??
                              (c === 'count' ? 'Count' : c.replace(/^(sum|avg|min|max)_/, (m) =>
                                MEASURE_LABEL[m.slice(0, -1) as Measure['fn']] + ' '
                              ).replace(/_/g, ' '))}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={Math.max(resultColumns.length, 1)} className="p-10 text-center text-ink-muted">
                            Nothing matches these filters.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, i) => (
                          <tr key={i} className="border-b border-rule-faint last:border-0">
                            {resultColumns.map((c) => (
                              <td key={c} className="px-2.5 py-1.5">
                                <span className="block max-w-[280px] truncate" title={cellText(row[c])}>
                                  {cellText(row[c])}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                    {Object.keys(totals).length > 0 && rows.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-rule bg-surface-sunken font-medium">
                          {resultColumns.map((c, i) => (
                            <td key={c} className="px-2.5 py-2">
                              {i === 0 ? 'Total' : totals[c] !== undefined ? totals[c].toLocaleString() : ''}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
