'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { getErrorMessage } from '../../../lib/errors'
import { LoadingSpinner, Alert } from '../../components/UI'
import AppShell from '../../components/AppShell'
import { Inbox, Search, AlertCircle, ArrowRight } from 'lucide-react'

/**
 * What this volunteer has sent, and where each thing got to.
 *
 * Deliberately not the staff activity screen: a volunteer asks a different
 * question. They want to know what came back needing correction, so that is
 * the first thing on the page and the default filter.
 */

const TABLES = [
  { key: 'Child_Data', label: 'Personal', reg: 'number' },
  { key: 'childfmly', label: 'Family', reg: 'text' },
  { key: 'childsibling', label: 'Siblings', reg: 'text' },
  { key: 'childuniform', label: 'Uniform', reg: 'text' },
  { key: 'childleaving', label: 'Leaving', reg: 'text' },
] as const

type TableKey = (typeof TABLES)[number]['key']

const FILTERS = [
  { value: 'all', label: 'Everything' },
  { value: 'Rejected', label: 'Needs correcting' },
  { value: 'Pending', label: 'Waiting' },
  { value: 'Approved', label: 'Approved' },
] as const

interface Row {
  record_id: number
  eac_no?: string | number
  reg_no?: string | number
  first_name?: string
  last_name?: string
  f_name?: string
  status?: string
  created_at?: string
  [key: string]: unknown
}

const txt = (v: unknown) => String(v ?? '').trim()

const nameOf = (r: Row) =>
  [r.first_name, r.last_name].filter(Boolean).join(' ') || txt(r.f_name) || `Reg ${txt(r.reg_no) || '—'}`

const chip = (s?: string) =>
  s === 'Approved'
    ? 'bg-status-approved-bg text-status-approved-fg'
    : s === 'Rejected'
    ? 'bg-status-returned-bg text-status-returned-fg'
    : s === 'Verified'
    ? 'bg-status-verified-bg text-status-verified-fg'
    : 'bg-status-pending-bg text-status-pending-fg'

const label = (s?: string) =>
  s === 'Rejected' ? 'Needs correcting' : s === 'Verified' ? 'Checked, awaiting approval' : s || 'Waiting'

export default function VolunteerHistoryPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['field_volunteer'])

  const [table, setTable] = useState<TableKey>('Child_Data')
  const [filter, setFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError('')
    try {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) throw new Error('Session expired — please sign in again.')

      const { data, error: err } = await supabase
        .from(table)
        .select('*')
        .eq('submitted_by', uid)
        .order('created_at', { ascending: false })
        .limit(500)
      if (err) throw err
      setRows(data ?? [])

      // How many of each kind this person has sent, for the tab badges.
      const tallies = await Promise.all(
        TABLES.map(async (t) => {
          const { count } = await supabase
            .from(t.key)
            .select('*', { count: 'exact', head: true })
            .eq('submitted_by', uid)
          return [t.key, count ?? 0] as const
        })
      )
      setCounts(Object.fromEntries(tallies))
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load your submissions.'))
    } finally {
      setLoading(false)
    }
  }, [profile?.id, table])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && (r.status || 'Pending') !== filter) return false
      if (!q) return true
      return [nameOf(r), txt(r.eac_no), txt(r.reg_no)].join(' ').toLowerCase().includes(q)
    })
  }, [rows, filter, query])

  const needsFixing = useMemo(() => rows.filter((r) => r.status === 'Rejected').length, [rows])

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
    <AppShell
      role="field_volunteer"
      active="/field-volunteer/history"
      breadcrumb={['My work', 'My submissions']}
      username={profile.username}
    >
      <div className="px-4 pb-10 pt-5 sm:px-6">
        {error && <Alert type="error" message={error} className="mb-4" />}

        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">My submissions</h1>
          <p className="mt-1 text-[14px] text-ink-muted">Everything you have sent, and what happened to it.</p>
        </div>

        {!loading && needsFixing > 0 && (
          <Link
            href="/field-volunteer/child-data-entry"
            className="mb-4 flex items-center gap-3 rounded-md border border-status-returned-fg/30 bg-status-returned-bg px-4 py-3.5 transition-opacity hover:opacity-90"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-status-returned-fg" />
            <span className="min-w-0 flex-1 text-[14.5px] font-medium text-status-returned-fg">
              {needsFixing} of these came back for correction
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-status-returned-fg" />
          </Link>
        )}

        <div className="-mx-4 mb-3 overflow-x-auto border-b border-rule px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1">
            {TABLES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTable(t.key)}
                className={`-mb-px flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[14px] transition-colors ${
                  table === t.key ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {t.label}
                {(counts[t.key] ?? 0) > 0 && (
                  <span className="font-mono text-[12px] text-ink-faint">{counts[t.key]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`h-9 rounded-md px-3 text-[13.5px] transition-colors ${
                filter === f.value ? 'bg-ink text-surface' : 'border border-rule-strong text-ink hover:bg-surface-hover'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex h-9 w-full items-center gap-2 rounded-md border border-rule-strong px-2.5 focus-within:border-blue-500 sm:w-[240px]">
            <Search className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or Reg No"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-rule">
          {loading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-3 text-[14px] text-ink-muted">Loading…</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox className="mx-auto mb-3 h-10 w-10 text-rule-strong" />
              <p className="text-[14.5px] text-ink-muted">
                {rows.length === 0 ? 'You have not submitted anything here yet.' : 'Nothing matches that.'}
              </p>
            </div>
          ) : (
            visible.map((row) => (
              <div
                key={row.record_id}
                className="flex flex-col gap-2 border-b border-rule-faint p-3 last:border-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{nameOf(row)}</span>
                  <span className="font-mono text-[12.5px] text-ink-faint">
                    EAC {txt(row.eac_no) || '—'} · Reg {txt(row.reg_no) || '—'}
                    {row.created_at ? ` · sent ${String(row.created_at).slice(0, 10)}` : ''}
                  </span>
                </div>
                <span className={`shrink-0 self-start rounded px-1.5 py-0.5 text-[12px] font-medium ${chip(row.status)}`}>
                  {label(row.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
