'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireRole } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { getErrorMessage } from '../../lib/errors'
import { LoadingSpinner, Alert } from '../components/UI'
import AppShell from '../components/AppShell'
import { UserPlus, History, Download, AlertCircle, ArrowRight } from 'lucide-react'

/**
 * What a volunteer needs on opening the app.
 *
 * Scoped to their own centre. The previous version counted every child in the
 * database, so a volunteer at one centre saw the whole programme's numbers and
 * could not tell how their own work was going.
 *
 * The number that matters most is the one needing attention: records sent back
 * for correction. Those sit untouched otherwise, because nothing else tells
 * the volunteer they exist.
 */

interface Stats {
  total: number
  enrolled: number
  left: number
  mine: number
  sentBack: number
  awaiting: number
}

export default function FieldVolunteerHome() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['field_volunteer'])

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const centre = profile?.centre_eac_no ?? null

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError('')
    try {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id

      const atCentre = () => {
        const q = supabase.from('Child_Data').select('*', { count: 'exact', head: true })
        return centre ? q.eq('eac_no', centre) : q
      }

      const [all, enrolled, left, mine, sentBack, awaiting] = await Promise.all([
        atCentre(),
        atCentre().or('child_left.is.null,child_left.eq.false'),
        atCentre().eq('child_left', true),
        uid ? atCentre().eq('submitted_by', uid) : Promise.resolve({ count: 0 }),
        uid ? atCentre().eq('submitted_by', uid).eq('status', 'Rejected') : Promise.resolve({ count: 0 }),
        uid ? atCentre().eq('submitted_by', uid).in('status', ['Pending', 'Verified']) : Promise.resolve({ count: 0 }),
      ])

      setStats({
        total: all.count ?? 0,
        enrolled: enrolled.count ?? 0,
        left: left.count ?? 0,
        mine: mine.count ?? 0,
        sentBack: sentBack.count ?? 0,
        awaiting: awaiting.count ?? 0,
      })
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load your centre.'))
    } finally {
      setLoading(false)
    }
  }, [profile?.id, centre])

  useEffect(() => {
    load()
  }, [load])

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
    <AppShell
      role="field_volunteer"
      active="/field-volunteer"
      breadcrumb={['My work', 'Overview']}
      username={profile.username}
    >
      <div className="px-4 pb-10 pt-5 sm:px-6">
        {error && <Alert type="error" message={error} className="mb-4" />}

        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight">
            {centre ? `Centre ${centre}` : 'Your work'}
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            {centre
              ? 'Everything below is for your centre only.'
              : 'No centre is assigned to your account yet. Ask an admin to set one.'}
          </p>
        </div>

        {/* The one that needs acting on comes first. */}
        {!loading && (stats?.sentBack ?? 0) > 0 && (
          <Link
            href="/field-volunteer/child-data-entry"
            className="mb-5 flex items-center gap-3 rounded-md border border-status-returned-fg/30 bg-status-returned-bg px-4 py-3.5 transition-opacity hover:opacity-90"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-status-returned-fg" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-medium text-status-returned-fg">
                {stats!.sentBack} {stats!.sentBack === 1 ? 'record needs' : 'records need'} correcting
              </span>
              <span className="block text-[13px] text-status-returned-fg/80">
                Sent back to you. Open the Rejected Data tab to fix and resubmit.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-status-returned-fg" />
          </Link>
        )}

        <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-3">
          {[
            { label: 'Children at your centre', value: stats?.total },
            { label: 'Enrolled', value: stats?.enrolled },
            { label: 'Left the programme', value: stats?.left },
            { label: 'Entered by you', value: stats?.mine },
            { label: 'Waiting for approval', value: stats?.awaiting },
            { label: 'Sent back', value: stats?.sentBack },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1 bg-surface px-4 py-3.5">
              <span className="text-[12.5px] leading-tight text-ink-muted">{s.label}</span>
              <span className="text-xl font-semibold tracking-tight">{n(s.value)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { href: '/field-volunteer/child-data-entry', icon: UserPlus, title: 'New child', text: 'Enter a child, their family, siblings and uniform' },
            { href: '/field-volunteer/history', icon: History, title: 'My submissions', text: 'What you have sent and where it got to' },
            { href: '/field-volunteer/reports', icon: Download, title: 'Reports', text: 'Your centre’s records, ready to download' },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex min-h-[96px] flex-col gap-1.5 rounded-md border border-rule p-4 transition-colors hover:bg-surface-hover"
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
