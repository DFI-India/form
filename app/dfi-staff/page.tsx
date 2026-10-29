'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireRole } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { getErrorMessage } from '../../lib/errors'
import { LoadingSpinner, Alert } from '../components/UI'
import AppShell from '../components/AppShell'
import { ClipboardCheck, List, History, ArrowRight } from 'lucide-react'

/**
 * What DFI staff need on opening the app: what is waiting for them.
 *
 * Their job is signing off what field staff have verified, so the queue comes
 * first and everything else is context.
 */

const ENTITY_LABELS: Record<string, string> = {
  child_data: 'Personal',
  childfmly: 'Family',
  childsibling: 'Siblings',
  childuniform: 'Uniform',
  childleaving: 'Leaving',
  vocational_course: 'Vocational',
  computer_course: 'Computer',
}

export default function StaffHome() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_staff'])

  const [token, setToken] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<Record<string, number>>({})
  const [summary, setSummary] = useState<{ pending: number; approved: number; rejected: number } | null>(null)
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
      const headers = { Authorization: `Bearer ${token}` }
      const [queue, stats] = await Promise.all([
        fetch('/api/admin/approvals/list?status=Verified&limit=1', { headers }).then((r) => r.json()),
        fetch('/api/admin/analytics/summary', { headers }).then((r) => r.json()),
      ])
      if (queue.error) throw new Error(queue.error)
      setWaiting(queue.counts || {})
      if (stats.byStatus) setSummary(stats.byStatus)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load your queue.'))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const totalWaiting = Object.values(waiting).reduce((a, b) => a + b, 0)

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

  const n = (v?: number) => (loading ? '—' : (v ?? 0).toLocaleString())

  return (
    <AppShell role="dfi_staff" active="/dfi-staff" breadcrumb={['Review', 'Overview']} username={profile.username}>
      <div className="px-4 pb-10 pt-5 sm:px-6">
        {error && <Alert type="error" message={error} className="mb-4" />}

        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight">Review</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Field staff verify what volunteers submit. You decide what is approved.
          </p>
        </div>

        <Link
          href="/dfi-staff/approvals"
          className={`mb-5 flex items-center gap-3 rounded-md border px-4 py-4 transition-colors ${
            totalWaiting > 0
              ? 'border-status-verified-fg/30 bg-status-verified-bg hover:opacity-90'
              : 'border-rule hover:bg-surface-hover'
          }`}
        >
          <ClipboardCheck
            className={`h-5 w-5 shrink-0 ${totalWaiting > 0 ? 'text-status-verified-fg' : 'text-ink-muted'}`}
          />
          <span className="min-w-0 flex-1">
            <span
              className={`block text-[15px] font-medium ${totalWaiting > 0 ? 'text-status-verified-fg' : ''}`}
            >
              {loading
                ? 'Checking the queue…'
                : totalWaiting > 0
                ? `${totalWaiting} ${totalWaiting === 1 ? 'record is' : 'records are'} waiting for your approval`
                : 'Nothing is waiting for approval'}
            </span>
            {!loading && totalWaiting > 0 && (
              <span className="mt-1 flex flex-wrap gap-1.5">
                {Object.entries(waiting)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded bg-surface px-1.5 py-0.5 text-[12px] text-ink-muted"
                    >
                      {ENTITY_LABELS[k] ?? k} {v}
                    </span>
                  ))}
              </span>
            )}
          </span>
          <ArrowRight className={`h-4 w-4 shrink-0 ${totalWaiting > 0 ? 'text-status-verified-fg' : 'text-ink-faint'}`} />
        </Link>

        <div className="mb-5 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-rule bg-rule">
          {[
            { label: 'Approved', value: summary?.approved, tone: 'text-status-approved-fg' },
            { label: 'Still pending', value: summary?.pending, tone: 'text-status-pending-fg' },
            { label: 'Sent back', value: summary?.rejected, tone: 'text-status-returned-fg' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1 bg-surface px-4 py-3.5">
              <span className="text-[12.5px] text-ink-muted">{s.label}</span>
              <span className={`text-xl font-semibold tracking-tight ${s.tone}`}>{n(s.value)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { href: '/dfi-staff/all-records', icon: List, title: 'All records', text: 'Search every table and export' },
            { href: '/dfi-staff/history', icon: History, title: 'My activity', text: 'What you have approved or sent back' },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex min-h-[88px] flex-col gap-1.5 rounded-md border border-rule p-4 transition-colors hover:bg-surface-hover"
            >
              <a.icon className="h-[18px] w-[18px] text-ink-muted" />
              <span className="text-[14.5px] font-medium">{a.title}</span>
              <span className="text-[13px] leading-snug text-ink-muted">{a.text}</span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
