'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequireRole } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { getErrorMessage } from '../../lib/errors'
import { LoadingSpinner, Alert } from './UI'
import AppShell from './AppShell'
import type { UserRole } from '../../lib/types'
import { Inbox, Search, CalendarDays } from 'lucide-react'

/**
 * What this person has decided, and when.
 *
 * Shared by DFI staff and field staff: the question is the same for both, only
 * the wording differs. Records come from the approval tables joined to the
 * record itself, so a row shows who it was about rather than only an id.
 */

export interface ActivityScreenProps {
  role: UserRole
  active: string
  breadcrumb: string[]
  /** 'verified' for field staff, 'decided' for DFI staff. */
  verb: 'verified' | 'decided'
}

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

interface Row {
  record_id?: number
  _entity_id?: number | string
  _decision_status?: string
  eac_no?: string | number
  reg_no?: string | number
  first_name?: string
  last_name?: string
  child_name?: string
  trainee_name?: string
  f_name?: string
  approved_at?: string | null
  verified_at?: string | null
  [key: string]: unknown
}

const txt = (v: unknown) => String(v ?? '').trim()

const nameOf = (r: Row) =>
  [r.first_name, r.last_name].filter(Boolean).join(' ') ||
  txt(r.child_name) || txt(r.trainee_name) || txt(r.f_name) || 'Unnamed'

const statusChip = (s?: string) =>
  s === 'Approved'
    ? 'bg-status-approved-bg text-status-approved-fg'
    : s === 'Rejected'
    ? 'bg-status-returned-bg text-status-returned-fg'
    : s === 'Verified'
    ? 'bg-status-verified-bg text-status-verified-fg'
    : 'bg-status-pending-bg text-status-pending-fg'

const statusLabel = (s?: string) => (s === 'Rejected' ? 'Sent back' : s || 'Pending')

const day = (v: unknown) => (v ? String(v).slice(0, 10) : '—')

export default function ActivityScreen({ role, active, breadcrumb, verb }: ActivityScreenProps) {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole([role])

  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<Record<string, Row[]>>({})
  const [counts, setCounts] = useState<Record<string, { total: number; approved: number; rejected: number }>>({})
  const [entity, setEntity] = useState<EntityKey>('child_data')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthorized) return
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null))
  }, [isAuthorized])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ dateField: 'all' })
      if (from) params.set('fromDate', from)
      if (to) params.set('toDate', to)

      const res = await fetch(`/api/admin/personal-activity?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load your activity')

      setData(json.data || {})
      setCounts(json.counts || {})
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load your activity.'))
    } finally {
      setLoading(false)
    }
  }, [token, from, to])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const list = data[entity] ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) =>
      [nameOf(r), txt(r.eac_no), txt(r.reg_no)].join(' ').toLowerCase().includes(q)
    )
  }, [data, entity, query])

  const totals = useMemo(() => {
    const all = Object.values(counts)
    return {
      total: all.reduce((n, c) => n + c.total, 0),
      approved: all.reduce((n, c) => n + c.approved, 0),
      rejected: all.reduce((n, c) => n + c.rejected, 0),
    }
  }, [counts])

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

  const inputClass =
    'h-[34px] rounded-md border border-rule-strong bg-surface px-2.5 text-[13.5px] text-ink outline-none focus:border-blue-500'

  return (
    <AppShell role={role} active={active} breadcrumb={breadcrumb} username={profile.username}>
      <div className="px-4 pb-10 pt-5 sm:px-6">
        {error && <Alert type="error" message={error} className="mb-4" />}

        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">My activity</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Everything you have {verb === 'verified' ? 'verified or sent back' : 'approved or sent back'}.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-rule bg-rule">
          {[
            { label: 'Decisions', value: totals.total, tone: '' },
            { label: verb === 'verified' ? 'Verified' : 'Approved', value: totals.approved, tone: 'text-status-approved-fg' },
            { label: 'Sent back', value: totals.rejected, tone: 'text-status-returned-fg' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1 bg-surface px-4 py-3">
              <span className="text-[12.5px] text-ink-muted">{s.label}</span>
              <span className={`text-xl font-semibold tracking-tight ${s.tone}`}>
                {loading ? '—' : s.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex h-[34px] w-full items-center gap-2 rounded-md border border-rule-strong px-2.5 focus-within:border-blue-500 sm:w-[260px]">
            <Search className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, EAC or Reg No"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint"
            />
          </div>
          <span className="flex items-center gap-1.5 text-[13px] text-ink-faint">
            <CalendarDays className="h-3.5 w-3.5" /> From
          </span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          <span className="text-[13px] text-ink-faint">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom('')
                setTo('')
              }}
              className="h-[34px] rounded-md px-2.5 text-[13.5px] text-ink-muted hover:bg-surface-hover hover:text-ink"
            >
              Clear dates
            </button>
          )}
        </div>

        <div className="-mx-4 mb-4 overflow-x-auto border-b border-rule px-4 sm:mx-0 sm:px-0">
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
                {(counts[e.key]?.total ?? 0) > 0 && (
                  <span className="font-mono text-[12px] text-ink-faint">{counts[e.key].total}</span>
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
                {query || from || to ? 'Nothing matches that.' : 'You have not decided anything here yet.'}
              </p>
            </div>
          ) : (
            rows.map((row, i) => (
              <div
                key={`${row._entity_id ?? row.record_id ?? i}`}
                className="flex flex-col gap-2 border-b border-rule-faint p-3 last:border-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{nameOf(row)}</span>
                  <span className="font-mono text-[12.5px] text-ink-faint">
                    EAC {txt(row.eac_no) || '—'} · Reg {txt(row.reg_no) || '—'}
                  </span>
                </div>
                <span className="shrink-0 text-[13px] text-ink-muted">
                  {day(row.approved_at || row.verified_at)}
                </span>
                <span className="shrink-0">
                  <span className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${statusChip(row._decision_status)}`}>
                    {statusLabel(row._decision_status)}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
