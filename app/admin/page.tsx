'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireRole } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { getErrorMessage } from '../../lib/errors'
import { Alert, LoadingSpinner } from '../components/UI'
import AdminShell from './AdminShell'
import { Users, Building2, BarChart3, Upload } from 'lucide-react'

interface Overview {
  totals: { children: number; enrolled: number; left: number; centres: number }
  byStatus: { pending: number; verified: number; approved: number; returned: number }
  gaps: { missingDetails: number; noDob: number }
  pendingConflicts: number
  centres: { eacNo: string; village: string; total: number; withFamily: number; percent: number }[]
}

const SHORTCUTS = [
  {
    href: '/admin/child-data',
    icon: Users,
    title: 'Child data',
    blurb: 'Every child, their family, siblings, uniform and leaving record.',
  },
  {
    href: '/admin/center-management',
    icon: Building2,
    title: 'Centre data',
    blurb: 'Locations, contacts and staff for every EAC.',
  },
  {
    href: '/admin/import',
    icon: Upload,
    title: 'Import',
    blurb: 'Bring records in from the Access database.',
  },
  {
    href: '/admin/analytics',
    icon: BarChart3,
    title: 'Analytics',
    blurb: 'Enrolment, approvals and course figures.',
  },
]

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function AdminHomePage() {
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
        if (!res.ok) throw new Error(json.error || 'Could not load the overview')
        if (!cancelled) setOverview(json)
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the overview.'))
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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const attention = overview
    ? [
        {
          count: overview.pendingConflicts ?? 0,
          text: 'imported records conflict with what\u2019s stored, awaiting a decision',
          href: '/admin/import/conflicts',
          tone: 'text-status-pending-fg',
        },
        {
          count: overview.byStatus.verified,
          text: 'records verified and waiting on your approval',
          href: '/admin/child-data',
          tone: 'text-blue-600',
        },
        {
          count: overview.byStatus.returned,
          text: 'sent back to volunteers, not yet corrected',
          href: '/admin/child-data',
          tone: 'text-status-returned-fg',
        },
        {
          count: overview.gaps.missingDetails,
          text: 'children with details still missing',
          href: '/admin/child-data?missing=any',
          tone: 'text-status-pending-fg',
        },
        {
          count: overview.gaps.noDob,
          text: 'children with no date of birth — blocks age reporting',
          href: '/admin/child-data',
          tone: 'text-status-pending-fg',
        },
      ].filter((item) => item.count > 0)
    : []

  return (
    <AdminShell active="/admin" breadcrumb={['Home']} username={profile.username}>
      <div className="px-14 pb-16 pt-10">
        <div className="max-w-[940px]">
          {error && <Alert type="error" message={error} className="mb-6" />}

          <div className="mb-8 flex flex-col gap-1.5">
            <h1 className="text-[28px] font-semibold tracking-tight">
              {greeting()}, {profile.first_name || profile.username}
            </h1>
            <p className="text-sm text-ink-muted">
              {today}
              {overview ? ` · ${overview.totals.centres} centres reporting` : ''}
            </p>
          </div>

          {/* Quick stats */}
          <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule md:grid-cols-4">
            {[
              {
                label: 'Children',
                value: overview?.totals.children,
                sub: overview ? `${overview.totals.enrolled} enrolled · ${overview.totals.left} left` : '',
                tone: '',
              },
              {
                label: 'Centres',
                value: overview?.totals.centres,
                sub: 'across all districts',
                tone: '',
              },
              {
                label: 'Awaiting approval',
                value: overview?.byStatus.verified,
                sub: 'verified by field staff',
                tone: 'text-blue-600',
              },
              {
                label: 'Missing details',
                value: overview?.gaps.missingDetails,
                sub:
                  overview && overview.totals.children > 0
                    ? `${Math.round((overview.gaps.missingDetails / overview.totals.children) * 100)}% of children`
                    : '',
                tone: 'text-status-pending-fg',
              },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1.5 bg-surface px-[18px] py-4">
                <span className="text-xs text-ink-muted">{stat.label}</span>
                <span className={`text-2xl font-semibold tracking-tight ${stat.tone}`}>
                  {loading ? '—' : (stat.value ?? 0).toLocaleString()}
                </span>
                <span className="text-[11.5px] text-ink-faint">{stat.sub}</span>
              </div>
            ))}
          </div>

          {/* Shortcuts */}
          <div className="mb-8 flex flex-col gap-3">
            <span className="text-xs font-medium text-ink-faint">Jump back in</span>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {SHORTCUTS.map((s) => {
                const Icon = s.icon
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex flex-col gap-2 rounded-md border border-rule p-4 transition-colors hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-[15px] w-[15px] text-ink-muted" />
                      <span className="text-[13.5px] font-medium">{s.title}</span>
                    </div>
                    <span className="text-xs leading-relaxed text-ink-muted">{s.blurb}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Needs attention */}
          <div className="mb-8 flex flex-col gap-2.5">
            <span className="text-xs font-medium text-ink-faint">Needs attention</span>
            <div className="overflow-hidden rounded-md border border-rule">
              {loading ? (
                <div className="px-4 py-6 text-center text-[13px] text-ink-muted">Checking…</div>
              ) : attention.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-ink-muted">
                  Nothing waiting — every record is approved and complete.
                </div>
              ) : (
                attention.map((item, i) => (
                  <Link
                    key={item.text}
                    href={item.href}
                    className={`flex h-11 items-center gap-3 px-4 transition-colors hover:bg-surface-hover ${
                      i < attention.length - 1 ? 'border-b border-rule' : ''
                    }`}
                  >
                    <span className={`min-w-[34px] font-mono text-[13px] font-medium ${item.tone}`}>
                      {item.count.toLocaleString()}
                    </span>
                    <span className="flex-1 text-[13.5px]">{item.text}</span>
                    <span className="text-[12.5px] font-medium text-blue-600">Open</span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Weakest centres */}
          {overview && overview.centres.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-ink-faint">Centres needing the most work</span>
                <Link href="/admin/center-management" className="text-[12.5px] font-medium text-blue-600">
                  All centres
                </Link>
              </div>
              <div className="overflow-hidden rounded-md border border-rule">
                {overview.centres.map((c, i) => (
                  <div
                    key={c.eacNo}
                    className={`flex h-10 items-center gap-3.5 px-4 ${
                      i < overview.centres.length - 1 ? 'border-b border-rule' : ''
                    }`}
                  >
                    <span className="w-9 font-mono text-[12.5px] text-ink-muted">{c.eacNo}</span>
                    <span className="flex-1 truncate text-[13px]">{c.village || '—'}</span>
                    <span className="text-[12px] text-ink-faint">
                      {c.withFamily}/{c.total}
                    </span>
                    <div className="flex h-[7px] w-24 overflow-hidden rounded-sm bg-meter-empty">
                      <div
                        className={
                          c.percent < 40
                            ? 'bg-status-returned-fg'
                            : c.percent < 70
                            ? 'bg-status-pending-fg'
                            : 'bg-meter-filled'
                        }
                        style={{ width: `${c.percent}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-[12px] text-ink-muted">{c.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
