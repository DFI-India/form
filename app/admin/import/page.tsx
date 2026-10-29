'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import AdminShell from '../AdminShell'
import { getErrorMessage } from '../../../lib/errors'
import {
  IMPORT_SPECS,
  detectEntity,
  entityFromTableName,
  parseCsv,
  transformRecords,
  transformRows,
  type ImportEntity,
} from '../../../lib/importSpecs'
import ImportReview, { type PreflightResult } from './ImportReview'
import Link from 'next/link'
import {
  Upload,
  FileSpreadsheet,
  Database,
  X,
  CheckCircle2,
  AlertTriangle,
  Play,
  GitCompare,
  Check,
} from 'lucide-react'

/** child_data must load first: it creates centres and establishes each child. */
const IMPORT_ORDER: ImportEntity[] = ['child_data', 'childfmly', 'childsibling', 'childuniform', 'childleaving']

/** Rows per request — keeps each POST well under serverless body limits. */
const CHUNK_SIZE = 500

interface ParsedFile {
  id: string
  fileName: string
  /** Access table name, when the rows came from an .accdb. */
  sourceTable?: string
  entity: ImportEntity | null
  rows: Record<string, any>[]
  errors: { row: number; message: string }[]
  unmappedHeaders: string[]
  eacNos: number[]
}

interface RunResult {
  id: string
  label: string
  ok: boolean
  message: string
  summary?: any
}

export default function AdminImportPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [files, setFiles] = useState<ParsedFile[]>([])
  const [parsing, setParsing] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<RunResult[]>([])
  const [error, setError] = useState('')
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)

  const [status, setStatus] = useState('Approved')
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'abort' | 'stage'>('stage')
  /** Set after a run that held rows back, so the review link can be offered. */
  const [stagedCount, setStagedCount] = useState(0)
  /** Conflicts still waiting from any earlier run, shown in the top bar. */
  const [pendingConflicts, setPendingConflicts] = useState(0)
  const [createMissingCentres, setCreateMissingCentres] = useState(false)

  const sortedFiles = useMemo(
    () =>
      [...files].sort(
        (a, b) =>
          IMPORT_ORDER.indexOf(a.entity ?? 'childleaving') - IMPORT_ORDER.indexOf(b.entity ?? 'childleaving')
      ),
    [files]
  )

  /** Conflicts left over from a previous session, so the link is always there. */
  const refreshPendingConflicts = useCallback(async () => {
    if (!isAuthorized) return
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) return
      const res = await fetch('/api/admin/import/conflicts?state=pending&page=1', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setPendingConflicts(json.total || 0)
    } catch {
      // A count in the top bar isn't worth surfacing an error for.
    }
  }, [isAuthorized])

  useEffect(() => {
    refreshPendingConflicts()
  }, [refreshPendingConflicts])

  /** Clear the whole run — files, review and results — back to an empty page. */
  const reset = () => {
    setFiles([])
    setPreflight(null)
    setResults([])
    setStagedCount(0)
    setError('')
  }

  const totalRows = files.reduce((sum, f) => sum + f.rows.length, 0)
  const totalErrors = files.reduce((sum, f) => sum + f.errors.length, 0)
  const canRun = files.length > 0 && files.every((f) => f.entity !== null) && !running

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setParsing(true)
    setError('')
    setResults([])
    setPreflight(null)

    try {
      const parsed: ParsedFile[] = []

      for (const file of Array.from(fileList)) {
        const isAccess = /\.(accdb|mdb)$/i.test(file.name)

        if (isAccess) {
          // Parsed in the browser: the file is far larger than a serverless
          // request body allows, so only the mapped rows travel to the server.
          //
          // mdb-reader's browser build still uses Buffer methods (.copy) on both
          // the input and its own internal allocations, so a global polyfill has
          // to be in place *before* the library is loaded — a plain Uint8Array
          // fails at runtime with "copy is not a function".
          const { Buffer: BufferPolyfill } = await import('buffer')
          if (typeof (globalThis as any).Buffer === 'undefined') {
            ;(globalThis as any).Buffer = BufferPolyfill
          }

          const { default: MDBReader } = await import('mdb-reader')
          const buffer = BufferPolyfill.from(await file.arrayBuffer())
          const reader = new MDBReader(buffer as any)

          for (const tableName of reader.getTableNames()) {
            const entity = entityFromTableName(tableName)
            if (!entity) continue

            const records = reader.getTable(tableName).getData() as Record<string, unknown>[]
            const result = transformRecords(entity, records)

            parsed.push({
              id: `${file.name}::${tableName}`,
              fileName: file.name,
              sourceTable: tableName,
              entity,
              rows: result.rows,
              errors: result.errors,
              unmappedHeaders: result.unmappedHeaders,
              eacNos: result.eacNos,
            })
          }
          continue
        }

        const text = await file.text()
        const { headers, rows } = parseCsv(text)
        const entity = detectEntity(headers)

        if (!entity) {
          parsed.push({
            id: file.name,
            fileName: file.name,
            entity: null,
            rows: [],
            errors: [{ row: 0, message: "Couldn't tell which table this file is for from its columns." }],
            unmappedHeaders: [],
            eacNos: [],
          })
          continue
        }

        const result = transformRows(entity, headers, rows)
        parsed.push({
          id: file.name,
          fileName: file.name,
          entity,
          rows: result.rows,
          errors: result.errors,
          unmappedHeaders: result.unmappedHeaders,
          eacNos: result.eacNos,
        })
      }

      setFiles((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]))
        parsed.forEach((p) => byId.set(p.id, p))
        return Array.from(byId.values())
      })
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to read the selected file(s).'))
    } finally {
      setParsing(false)
    }
  }

  /**
   * Read-only pass: asks the server which records/centres already exist, then
   * the diff is rendered locally from the rows already in memory.
   */
  const runPreflight = async () => {
    setRunning(true)
    setError('')
    setResults([])
    setPreflight(null)

    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Session expired — please sign in again.')

      const res = await fetch('/api/admin/import/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          entities: sortedFiles
            .filter((f) => f.entity && f.rows.length > 0)
            .map((f) => ({
              entity: f.entity,
              keys: f.rows.map((r) => ({ eac_no: r.eac_no, reg_no: r.reg_no })),
            })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Review failed')

      setPreflight(json as PreflightResult)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not review the import.'))
    } finally {
      setRunning(false)
    }
  }

  const run = async () => {
    setRunning(true)
    setError('')
    setResults([])
    setStagedCount(0)

    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Session expired — please sign in again.')

      const collected: RunResult[] = []
      // One batch id across every chunk and file, so the review page can scope
      // itself to this run.
      const batchId = crypto.randomUUID()
      let stagedTotal = 0

      for (const file of sortedFiles) {
        if (!file.entity || file.rows.length === 0) continue

        const label = file.sourceTable ? `${file.fileName} → ${file.sourceTable}` : file.fileName
        const agg = {
          toInsert: 0,
          alreadyPresent: 0,
          inserted: 0,
          centresCreated: 0,
          staged: 0,
          identical: 0,
          missingCentres: [] as number[],
          conflictSample: [] as any[],
        }
        let failed = false

        // Rows go up in chunks so no single request approaches the body limit.
        for (let i = 0; i < file.rows.length; i += CHUNK_SIZE) {
          const chunk = file.rows.slice(i, i + CHUNK_SIZE)

          const res = await fetch('/api/admin/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              entity: file.entity,
              rows: chunk,
              dryRun: false,
              conflictStrategy,
              status,
              createMissingCentres,
              batchId,
            }),
          })
          const json = await res.json()

          if (!res.ok) {
            collected.push({ id: file.id, label, ok: false, message: json.error || 'Failed', summary: json.summary })
            failed = true
            break
          }

          const s = json.summary
          agg.toInsert += s.toInsert || 0
          agg.alreadyPresent += s.alreadyPresent || 0
          agg.inserted += s.inserted || 0
          agg.centresCreated += s.centresCreated || 0
          agg.staged += s.staged || 0
          agg.identical += s.identical || 0
          for (const m of s.missingCentres || []) {
            if (!agg.missingCentres.includes(m)) agg.missingCentres.push(m)
          }
          if (agg.conflictSample.length < 10) {
            agg.conflictSample.push(...(s.conflictSample || []).slice(0, 10 - agg.conflictSample.length))
          }
        }

        if (failed) {
          setResults([...collected])
          // Stop on first failure — later tables depend on earlier ones.
          setRunning(false)
          return
        }

        collected.push({
          id: file.id,
          label,
          ok: true,
          message:
            `Imported ${agg.inserted} row(s)` +
            (agg.centresCreated ? `, created ${agg.centresCreated} centre(s)` : '') +
            (agg.staged ? `, ${agg.staged} held for review` : '') +
            (agg.identical ? `, ${agg.identical} already identical` : ''),
          summary: agg,
        })
        stagedTotal += agg.staged
        setResults([...collected])
      }

      setStagedCount(stagedTotal)
      if (stagedTotal > 0) await refreshPendingConflicts()

      // The review is now stale — the data it described has been written.
      setPreflight(null)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Import failed.'))
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
  const steps = [
    { n: 1, label: 'Choose files', done: files.length > 0 },
    { n: 2, label: 'Settings', done: files.length > 0 },
    { n: 3, label: 'Review', done: Boolean(preflight) },
    { n: 4, label: 'Import', done: results.length > 0 },
  ]

  return (
    <AdminShell
      active="/admin/import"
      breadcrumb={['Data', 'Import']}
      username={profile.username}
      actions={
        <>
          {pendingConflicts > 0 && (
            <Link
              href="/admin/import/conflicts"
              className="flex h-[34px] items-center gap-1.5 rounded-md border border-status-pending-fg/30 bg-status-pending-bg px-3 text-[13.5px] font-medium text-status-pending-fg transition-opacity hover:opacity-80"
            >
              <GitCompare className="h-3.5 w-3.5" />
              {pendingConflicts} to review
            </Link>
          )}
          {files.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="flex h-[34px] items-center rounded-md border border-rule-strong px-3 text-[13.5px] transition-colors hover:bg-surface-hover"
            >
              Start over
            </button>
          )}
        </>
      }
    >
      <div className="px-10 pb-16 pt-8">
        <div className="max-w-[900px]">
          <div className="mb-6 flex flex-col gap-2">
            <h1 className="text-[24px] font-semibold tracking-tight">Import from Access</h1>
            <p className="max-w-[660px] text-[14.5px] leading-relaxed text-ink-muted">
              Reads an .accdb directly — all five tables in one pass. Nothing is written until you&apos;ve seen
              exactly what would change.
            </p>
          </div>

          {/* Progress */}
          <div className="mb-7 flex items-center gap-1">
            {steps.map((s, i) => {
              const current = steps.findIndex((x) => !x.done)
              const isCurrent = current === i || (current === -1 && i === steps.length - 1)
              return (
                <div key={s.n} className="flex flex-1 items-center gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11.5px] font-semibold ${
                        s.done
                          ? 'bg-status-approved-fg text-surface'
                          : isCurrent
                          ? 'bg-ink text-surface'
                          : 'bg-surface-hover text-ink-faint'
                      }`}
                    >
                      {s.done ? <Check className="h-2.5 w-2.5" /> : s.n}
                    </span>
                    <span
                      className={`whitespace-nowrap text-[13.5px] ${
                        s.done || isCurrent ? 'text-ink' : 'text-ink-faint'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && <div className="mx-1 h-px flex-1 bg-rule" />}
                </div>
              )
            })}
          </div>

          {error && <Alert type="error" message={error} className="mb-5" />}

          {/* 1 — Files */}
          <section className="mb-5">
            <SectionHead n={1} title="Choose files" />
            <div className="rounded-md border border-rule p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-rule-strong bg-surface-sunken px-6 py-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/40">
                <input
                  type="file"
                  accept=".accdb,.mdb,.csv,text/csv"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <Upload className="h-5 w-5 text-ink-faint" />
                <span className="text-[14.5px] font-medium">Drop in an .accdb, or pick CSV files</span>
                <span className="max-w-[420px] text-[13px] leading-relaxed text-ink-muted">
                  An Access file is read in full — you don&apos;t need to export anything. With CSV it&apos;s one
                  file per table. Either way the table is worked out from the columns.
                </span>
              </label>

              {parsing && <p className="mt-3 text-[13.5px] text-ink-muted">Reading files…</p>}

              {sortedFiles.length > 0 && (
                <div className="mt-3 flex flex-col gap-px overflow-hidden rounded-md border border-rule bg-rule">
                  {sortedFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`flex items-start gap-3 px-3.5 py-3 ${
                        file.entity ? 'bg-surface' : 'bg-status-returned-bg'
                      }`}
                    >
                      {file.sourceTable ? (
                        <Database className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                      ) : (
                        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[14.5px] font-medium">
                            {file.sourceTable ? `${file.fileName} → ${file.sourceTable}` : file.fileName}
                          </span>
                          {file.entity && (
                            <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[12px] text-ink-muted">
                              {IMPORT_SPECS[file.entity].label}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-[13.5px] text-ink-muted">
                          <span className="font-mono">{file.rows.length.toLocaleString()}</span> row
                          {file.rows.length === 1 ? '' : 's'}
                          {file.eacNos.length > 0 && ` · ${file.eacNos.length} centre${file.eacNos.length === 1 ? '' : 's'}`}
                          {file.errors.length > 0 && (
                            <span className="text-status-pending-fg"> · {file.errors.length} row(s) skipped</span>
                          )}
                        </p>

                        {file.errors.length > 0 && (
                          <ul className="mt-1.5 flex flex-col gap-0.5 text-[12.5px] text-status-pending-fg">
                            {file.errors.slice(0, 3).map((e, i) => (
                              <li key={i}>
                                {e.row > 0 ? `Row ${e.row}: ` : ''}
                                {e.message}
                              </li>
                            ))}
                            {file.errors.length > 3 && <li>…and {file.errors.length - 3} more</li>}
                          </ul>
                        )}

                        {file.unmappedHeaders.length > 0 && (
                          <p className="mt-1.5 text-[12.5px] text-ink-faint">
                            Columns ignored: {file.unmappedHeaders.slice(0, 6).join(', ')}
                            {file.unmappedHeaders.length > 6 && ` +${file.unmappedHeaders.length - 6} more`}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
                        className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
                        aria-label={`Remove ${file.fileName}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 2 — Settings */}
          {files.length > 0 && (
            <section className="mb-5">
              <SectionHead n={2} title="Settings" />
              <div className="rounded-md border border-rule p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-ink-muted">Status for imported rows</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={selectClass}
                    >
                      <option value="Approved">Approved — historical, already verified</option>
                      <option value="Verified">Verified — needs final approval</option>
                      <option value="Pending">Pending — goes through full review</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-ink-muted">If a record already exists</span>
                    <select
                      value={conflictStrategy}
                      onChange={(e) => setConflictStrategy(e.target.value as 'skip' | 'abort' | 'stage')}
                      className={selectClass}
                    >
                      <option value="stage">Hold it back for review</option>
                      <option value="skip">Skip it, import the rest</option>
                      <option value="abort">Stop and import nothing</option>
                    </select>
                  </label>
                </div>

                <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
                  {conflictStrategy === 'stage'
                    ? 'Everything new is imported. A record that already exists and says something different is set aside so you can compare it field by field — identical ones are ignored.'
                    : conflictStrategy === 'skip'
                    ? 'Records that already exist are left exactly as they are, and the file’s version is discarded.'
                    : 'A single existing record stops the whole import and nothing is written.'}
                </p>

                <label className="mt-3.5 flex items-start gap-2.5 border-t border-rule pt-3.5">
                  <input
                    type="checkbox"
                    checked={createMissingCentres}
                    onChange={(e) => setCreateMissingCentres(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px]">Create centres that don&apos;t exist yet</span>
                    <span className="text-[12.5px] leading-relaxed text-ink-faint">
                      Children can&apos;t be attached to a centre that isn&apos;t in the system. The centre&apos;s
                      address is taken from the most common value across its children — worth checking in Centre
                      data afterwards.
                    </span>
                  </span>
                </label>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
                  <button
                    type="button"
                    onClick={runPreflight}
                    disabled={!canRun}
                    className="flex h-8 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[14px] font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {running && !preflight ? 'Checking…' : 'Review changes'}
                  </button>
                  <span className="text-[13.5px] text-ink-muted">
                    <span className="font-mono">{totalRows.toLocaleString()}</span> rows across {files.length}{' '}
                    table{files.length === 1 ? '' : 's'}
                    {totalErrors > 0 && ` · ${totalErrors} skipped`}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* 3 — Review */}
          {preflight && (
            <section className="mb-5">
              <SectionHead
                n={3}
                title="Review changes"
                note="Nothing has been written yet."
                action={
                  <button
                    type="button"
                    onClick={() => setPreflight(null)}
                    className="text-[13.5px] text-ink-muted transition-colors hover:text-ink"
                  >
                    Dismiss
                  </button>
                }
              />
              <div className="rounded-md border border-rule p-4">
                <ImportReview
                  files={files
                    .filter((f) => f.entity && f.rows.length > 0)
                    .map((f) => ({ id: f.id, entity: f.entity as ImportEntity, rows: f.rows }))}
                  preflight={preflight}
                  createMissingCentres={createMissingCentres}
                  conflictStrategy={conflictStrategy}
                />

                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Import ${totalRows.toLocaleString()} row(s) into the live database? Existing records won't be changed.`
                        )
                      ) {
                        run()
                      }
                    }}
                    disabled={!canRun}
                    className="flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-[14px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {running ? 'Importing…' : 'Apply import'}
                  </button>
                  <span className="text-[13.5px] text-ink-muted">This writes to the live database.</span>
                </div>
              </div>
            </section>
          )}

          {/* Conflicts held back */}
          {stagedCount > 0 && (
            <div className="mb-5 flex items-start gap-3 rounded-md border border-status-pending-fg/30 bg-status-pending-bg px-4 py-3.5">
              <GitCompare className="mt-0.5 h-4 w-4 shrink-0 text-status-pending-fg" />
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium text-status-pending-fg">
                  {stagedCount.toLocaleString()} record{stagedCount === 1 ? '' : 's'} held back for review
                </p>
                <p className="mt-0.5 text-[13.5px] leading-relaxed text-status-pending-fg">
                  These already exist and say something different from the file. Nothing was overwritten —
                  compare them side by side and choose what to keep.
                </p>
              </div>
              <Link
                href="/admin/import/conflicts"
                className="flex h-8 shrink-0 items-center rounded-md bg-status-pending-fg px-3.5 text-[13.5px] font-medium text-surface transition-opacity hover:opacity-90"
              >
                Review conflicts
              </Link>
            </div>
          )}

          {/* 4 — Results */}
          {results.length > 0 && (
            <section>
              <SectionHead n={4} title="Results" />
              <div className="flex flex-col gap-px overflow-hidden rounded-md border border-rule bg-rule">
                {results.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 bg-surface px-4 py-3.5">
                    {r.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-approved-fg" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-returned-fg" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium">{r.label}</p>
                      <p
                        className={`mt-0.5 text-[13.5px] ${
                          r.ok ? 'text-ink-muted' : 'text-status-returned-fg'
                        }`}
                      >
                        {r.message}
                      </p>
                      {r.summary?.missingCentres?.length > 0 && (
                        <p className="mt-1 text-[12.5px] text-status-pending-fg">
                          Centres not in the system yet: {r.summary.missingCentres.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/admin/child-data"
                  className="flex h-8 items-center rounded-md border border-rule-strong px-3.5 text-[14px] transition-colors hover:bg-surface-hover"
                >
                  Open child data
                </Link>
                <Link
                  href="/admin/center-management"
                  className="flex h-8 items-center rounded-md border border-rule-strong px-3.5 text-[14px] transition-colors hover:bg-surface-hover"
                >
                  Check centres
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="flex h-8 items-center rounded-md border border-rule-strong px-3.5 text-[14px] transition-colors hover:bg-surface-hover"
                >
                  Import another file
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </AdminShell>
  )
}

const selectClass =
  'h-8 w-full rounded-md border border-rule bg-surface px-2.5 text-[14px] outline-none focus:border-blue-500'

/** Numbered heading — the flow is strictly sequential, so it reads as steps. */
function SectionHead({
  n,
  title,
  note,
  action,
}: {
  n: number
  title: string
  note?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <span className="flex h-5 w-5 items-center justify-center rounded bg-surface-hover text-[12px] font-semibold text-ink-muted">
        {n}
      </span>
      <span className="text-[15px] font-semibold">{title}</span>
      {note && <span className="text-[13.5px] text-ink-muted">{note}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}
