'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { getErrorMessage } from '../../../lib/errors'
import { Alert, LoadingSpinner } from '../../components/UI'
import AdminShell from '../AdminShell'
import { Users, Building2 } from 'lucide-react'

interface Overview {
  totals: { children: number; enrolled: number; left: number; centres: number }
  gaps: { missingDetails: number; noDob: number }
}

/**
 * Hub for the two tables that stand on their own. Family, siblings, uniform and
 * leaving all hang off a child, so they sit under "All records" rather than
 * competing for attention here.
 */
export default function ManageRecordsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthorized) return
    let cancelled = false

    const load = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session.session?.access_token
        if (!token) throw new Error('Session expired — please sign in again.')

        const res = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not load record counts')
        if (!cancelled) setOverview(json)
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load record counts.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isAuthorized])

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

  const n = (v?: number) => (loading || v === undefined ? '—' : v.toLocaleString())

  return (
    <AdminShell active="/admin/manage-records" breadcrumb={['Manage records']} username={profile.username}>
      <div className="px-10 pb-14 pt-8">
        {error && <Alert type="error" message={error} className="mb-5" />}

        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-[22px] font-semibold tracking-tight">Manage records</h1>
          <p className="max-w-[720px] text-[13.5px] leading-relaxed text-ink-muted">
            Two tables stand on their own — centres, and the children in them. Family, siblings, uniform and
            leaving all hang off a child.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Child data */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-rule">
            <div className="flex items-start justify-between gap-3.5 border-b border-rule px-5 pb-4 pt-[18px]">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4" />
                  <span className="text-[15px] font-semibold">Child data</span>
                </div>
                <span className="text-[12.5px] text-ink-muted">One row per child, with four linked sections</span>
              </div>
              <span className="font-mono text-xl font-medium">{n(overview?.totals.children)}</span>
            </div>

            <div className="flex flex-col gap-2.5 px-5 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-ink-muted">Enrolled</span>
                <span className="font-mono text-[12.5px]">{n(overview?.totals.enrolled)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-ink-muted">Left the programme</span>
                <span className="font-mono text-[12.5px]">{n(overview?.totals.left)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-status-pending-fg">Missing details</span>
                <span className="font-mono text-[12.5px] text-status-pending-fg">
                  {n(overview?.gaps.missingDetails)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 px-5 pb-3.5">
              <span className="text-[11px] font-medium text-ink-faint">Linked sections</span>
              <div className="flex flex-wrap gap-1.5">
                {['Family', 'Siblings', 'Uniform', 'Leaving'].map((s) => (
                  <span key={s} className="rounded bg-surface-hover px-2 py-0.5 text-[11.5px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-auto flex gap-2 border-t border-rule px-5 py-3.5">
              <Link
                href="/admin/child-data"
                className="flex h-8 items-center rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                Open child data
              </Link>
              <Link
                href="/admin/child-data?missing=any"
                className="flex h-8 items-center rounded-md border border-rule-strong px-3.5 text-[13px] transition-colors hover:bg-surface-hover"
              >
                Review incomplete
              </Link>
            </div>
          </div>

          {/* Centre data */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-rule">
            <div className="flex items-start justify-between gap-3.5 border-b border-rule px-5 pb-4 pt-[18px]">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4" />
                  <span className="text-[15px] font-semibold">Centre data</span>
                </div>
                <span className="text-[12.5px] text-ink-muted">One row per EAC — location, contacts, staff</span>
              </div>
              <span className="font-mono text-xl font-medium">{n(overview?.totals.centres)}</span>
            </div>

            <div className="flex flex-col gap-2.5 px-5 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-ink-muted">Children across all centres</span>
                <span className="font-mono text-[12.5px]">{n(overview?.totals.children)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-ink-muted">Average per centre</span>
                <span className="font-mono text-[12.5px]">
                  {loading || !overview || overview.totals.centres === 0
                    ? '—'
                    : Math.round(overview.totals.children / overview.totals.centres)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 px-5 pb-3.5">
              <span className="text-[11px] font-medium text-ink-faint">Recorded per centre</span>
              <div className="flex flex-wrap gap-1.5">
                {['CBV', 'In-charge', 'Head master', 'Anganvadi', 'ASHA worker'].map((s) => (
                  <span key={s} className="rounded bg-surface-hover px-2 py-0.5 text-[11.5px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-auto flex gap-2 border-t border-rule px-5 py-3.5">
              <Link
                href="/admin/center-management"
                className="flex h-8 items-center rounded-md bg-blue-600 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                Open centre data
              </Link>
            </div>
          </div>
        </div>

        {/* Everything that hangs off a child */}
        <div className="mt-6 overflow-hidden rounded-lg border border-rule">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13.5px] font-medium">All records</span>
              <span className="text-xs text-ink-muted">Every table on its own, for search and export</span>
            </div>
            <Link
              href="/admin/records"
              className="flex h-[30px] items-center rounded-md border border-rule-strong px-3 text-[12.5px] transition-colors hover:bg-surface-hover"
            >
              Open
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-px bg-rule md:grid-cols-4">
            {['Family', 'Siblings', 'Uniform', 'Leaving'].map((label) => (
              <div key={label} className="flex flex-col gap-0.5 bg-surface px-4 py-3">
                <span className="text-[12.5px]">{label}</span>
                <span className="text-xs text-ink-faint">hangs off a child</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
