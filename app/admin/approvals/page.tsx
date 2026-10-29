'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { getErrorMessage } from '../../../lib/errors'
import { LoadingSpinner, Alert } from '../../components/UI'
import AdminShell from '../AdminShell'
import ChildProfilePanel, { type SectionKey } from '../records/ChildProfilePanel'
import { Check, X, Inbox, Eye, ChevronRight } from 'lucide-react'

/**
 * Approvals for admins.
 *
 * The approve and reject endpoints always accepted admins; there was simply no
 * screen, so anything waiting could only be cleared by a DFI staff member. Both
 * stages are shown here because an admin is the final authority: a record that
 * nobody has verified can be approved outright rather than waiting for a field
 * staff member who may not be around.
 */

type Stage = 'Pending' | 'Verified'

const ENTITIES = [
  { key: 'child_data', label: 'Personal' },
  { key: 'childfmly', label: 'Family' },
  { key: 'childsibling', label: 'Siblings' },
  { key: 'childuniform', label: 'Uniform' },
  { key: 'childleaving', label: 'Leaving' },
  { key: 'vocational_course', label: 'Vocational' },
  { key: 'computer_course', label: 'Computer' },
] as const

type EntityKey = (typeof ENTITIES)[number]['key']

const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: 'Pending', label: 'Not yet verified', hint: 'Submitted by a volunteer. Nobody has checked these yet.' },
  { key: 'Verified', label: 'Waiting for approval', hint: 'Field staff checked these. They need your sign-off.' },
]

interface Row {
  record_id?: number
  id?: string
  eac_no?: string | number
  reg_no?: string | number
  first_name?: string
  last_name?: string
  child_name?: string
  trainee_name?: string
  f_name?: string
  created_at?: string
  [key: string]: unknown
}

const txt = (v: unknown) => String(v ?? '').trim()

const nameOf = (row: Row) =>
  [row.first_name, row.last_name].filter(Boolean).join(' ') ||
  txt(row.child_name) ||
  txt(row.trainee_name) ||
  txt(row.f_name) ||
  'Unnamed'

/** The id the approval tables key on. */
const entityIdOf = (row: Row) => row.record_id ?? row.id

export default function AdminApprovalsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [token, setToken] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('Verified')
  const [entity, setEntity] = useState<EntityKey>('child_data')
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [stageCounts, setStageCounts] = useState<Record<Stage, number>>({ Pending: 0, Verified: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [rejecting, setRejecting] = useState<Row | null>(null)
  const [reason, setReason] = useState('')
  const [viewing, setViewing] = useState<{ eacNo: string | number; regNo: string | number } | null>(null)

  useEffect(() => {
    if (!isAuthorized) return
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null))
  }, [isAuthorized])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const fetchStage = async (s: Stage) => {
        const res = await fetch(`/api/admin/approvals/list?status=${s}&limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not load the approval queue')
        return json
      }

      const [current, other] = await Promise.all([
        fetchStage(stage),
        fetchStage(stage === 'Pending' ? 'Verified' : 'Pending'),
      ])

      setRows(current.data?.[entity] ?? [])
      setCounts(current.counts ?? {})

      const sum = (c: Record<string, number>) => Object.values(c || {}).reduce((a, b) => a + b, 0)
      setStageCounts({
        [stage]: sum(current.counts),
        [stage === 'Pending' ? 'Verified' : 'Pending']: sum(other.counts),
      } as Record<Stage, number>)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load the approval queue.'))
    } finally {
      setLoading(false)
    }
  }, [token, stage, entity])

  useEffect(() => {
    load()
  }, [load])

  const flash = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 3000)
  }

  const decide = async (row: Row, action: 'approve' | 'reject', why?: string) => {
    if (!token) return
    const id = entityIdOf(row)
    if (id === undefined || id === null) {
      setError('That record has no id, so it cannot be decided from here.')
      return
    }

    setBusy(String(id))
    setError('')
    try {
      const res = await fetch(`/api/admin/approvals/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          entityType: entity,
          entityId: id,
          // Tells the server which stage this came from, so an admin can clear
          // something nobody has verified instead of only signing off.
          fromStatus: stage,
          ...(action === 'reject' ? { reason: why } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Could not ${action} that record`)

      flash(action === 'approve' ? 'Approved.' : 'Sent back to the volunteer.')
      setRejecting(null)
      setReason('')
      load()
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Could not ${action} that record.`))
    } finally {
      setBusy(null)
    }
  }

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts])

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
    <AdminShell active="/admin/approvals" breadcrumb={['Manage records', 'Approvals']} username={profile.username}>
      <div className="px-4 pb-10 pt-5 sm:px-6">
        {error && <Alert type="error" message={error} className="mb-4" />}
        {notice && <Alert type="success" message={notice} className="mb-4" />}

        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Approvals</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            {STAGES.find((s) => s.key === stage)?.hint}
          </p>
        </div>

        {/* Which stage */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStage(s.key)}
              className={`flex h-9 items-center gap-2 rounded-md px-3 text-[14px] transition-colors ${
                stage === s.key ? 'bg-ink text-surface' : 'border border-rule-strong text-ink hover:bg-surface-hover'
              }`}
            >
              {s.label}
              <span className="font-mono text-[12.5px] opacity-70">{stageCounts[s.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Which kind of record */}
        <div className="mb-4 -mx-4 overflow-x-auto border-b border-rule px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1">
            {ENTITIES.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => setEntity(e.key)}
                className={`-mb-px flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[14px] transition-colors ${
                  entity === e.key ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {e.label}
                {(counts[e.key] ?? 0) > 0 && (
                  <span className="rounded bg-status-pending-bg px-1.5 py-0.5 font-mono text-[12px] text-status-pending-fg">
                    {counts[e.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-rule">
          {loading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-3 text-[14px] text-ink-muted">Loading…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox className="mx-auto mb-3 h-10 w-10 text-rule-strong" />
              <p className="text-[14.5px] text-ink-muted">
                Nothing {stage === 'Pending' ? 'waiting to be verified' : 'waiting for approval'} here.
              </p>
              {total > 0 && (
                <p className="mt-1 text-[13.5px] text-ink-faint">
                  {total} in other record types at this stage.
                </p>
              )}
            </div>
          ) : (
            rows.map((row) => {
              const id = entityIdOf(row)
              const working = busy === String(id)
              const canOpen = txt(row.eac_no) !== '' && txt(row.reg_no) !== '' && entity !== 'vocational_course' && entity !== 'computer_course'
              return (
                <div
                  key={String(id)}
                  className="flex flex-col gap-2.5 border-b border-rule-faint p-3 last:border-0 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-medium">{nameOf(row)}</span>
                      {canOpen && (
                        <button
                          type="button"
                          onClick={() => setViewing({ eacNo: row.eac_no!, regNo: row.reg_no! })}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
                        >
                          <Eye className="h-3 w-3" /> Open
                        </button>
                      )}
                    </div>
                    <span className="font-mono text-[12.5px] text-ink-faint">
                      EAC {txt(row.eac_no) || '—'} · Reg {txt(row.reg_no) || '—'}
                      {row.created_at ? ` · submitted ${String(row.created_at).slice(0, 10)}` : ''}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRejecting(row)}
                      disabled={working}
                      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-rule-strong px-3 text-[14px] transition-colors hover:bg-status-returned-bg hover:text-status-returned-fg disabled:opacity-50 sm:h-9 sm:flex-none"
                    >
                      <X className="h-3.5 w-3.5" /> Send back
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(row, 'approve')}
                      disabled={working}
                      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-status-approved-fg px-3 text-[14px] font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50 sm:h-9 sm:flex-none"
                    >
                      <Check className="h-3.5 w-3.5" /> {working ? 'Saving…' : 'Approve'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {stage === 'Pending' && rows.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-[13.5px] text-ink-muted">
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Approving here skips the field staff check. The record is recorded as both verified and approved by you.
          </p>
        )}
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejecting(null)}>
          <div className="w-full max-w-md rounded-lg border border-rule bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-[16px] font-semibold">Send back to the volunteer</h2>
            <p className="mb-3 text-[14px] text-ink-muted">
              {nameOf(rejecting)} · EAC {txt(rejecting.eac_no) || '—'} · Reg {txt(rejecting.reg_no) || '—'}
            </p>
            <label className="mb-1.5 block text-[13.5px] text-ink-muted">What needs fixing?</label>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="The volunteer sees this, so be specific."
              className="mb-4 w-full rounded-md border border-rule-strong bg-surface px-3 py-2 text-base text-ink outline-none focus:border-blue-500 sm:text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="h-10 rounded-md border border-rule-strong px-3 text-[14px] hover:bg-surface-hover sm:h-9"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => decide(rejecting, 'reject', reason.trim())}
                disabled={!reason.trim() || busy !== null}
                className="h-10 rounded-md bg-status-returned-fg px-3 text-[14px] font-medium text-surface disabled:opacity-50 sm:h-9"
              >
                Send back
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && token && (
        <ChildProfilePanel
          eacNo={viewing.eacNo}
          regNo={viewing.regNo}
          token={token}
          initialSection={entity as SectionKey}
          onClose={() => setViewing(null)}
          onSaved={load}
        />
      )}
    </AdminShell>
  )
}
