'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireRole } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { getErrorMessage } from '../../lib/errors'
import { LoadingSpinner, Alert } from '../components/UI'
import AppShell from '../components/AppShell'
import { ClipboardCheck, Eye, History, ArrowRight } from 'lucide-react'

/**
 * What field staff need on opening the app: what volunteers have sent that
 * nobody has checked. Their queue is the unverified one, and the API already
 * narrows it to the centres assigned to them.
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

export default function FieldStaffHome() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_field_staff'])

  const [token, setToken] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<Record<string, number>>({})
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
      const res = await fetch('/api/admin/approvals/list?status=Pending&limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load your queue')
      setWaiting(json.counts || {})
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load your queue.'))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const total = Object.values(waiting).reduce((a, b) => a + b, 0)

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
      role="dfi_field_staff"
      active="/dfi-field-staff"
      breadcrumb={['Field', 'Overview']}
      username={profile.username}
    >
      <div className="px-4 pb-10 pt-5 sm:px-6">
        {error && <Alert type="error" message={error} className="mb-4" />}

        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight">Field</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            You check what volunteers submit before DFI staff sign it off.
          </p>
        </div>

        <Link
          href="/dfi-field-staff/approve-data"
          className={`mb-5 flex items-center gap-3 rounded-md border px-4 py-4 transition-colors ${
            total > 0
              ? 'border-status-pending-fg/30 bg-status-pending-bg hover:opacity-90'
              : 'border-rule hover:bg-surface-hover'
          }`}
        >
          <ClipboardCheck className={`h-5 w-5 shrink-0 ${total > 0 ? 'text-status-pending-fg' : 'text-ink-muted'}`} />
          <span className="min-w-0 flex-1">
            <span className={`block text-[15px] font-medium ${total > 0 ? 'text-status-pending-fg' : ''}`}>
              {loading
                ? 'Checking the queue…'
                : total > 0
                ? `${total} ${total === 1 ? 'record needs' : 'records need'} checking`
                : 'Nothing is waiting to be checked'}
            </span>
            {!loading && total > 0 && (
              <span className="mt-1 flex flex-wrap gap-1.5">
                {Object.entries(waiting)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => (
                    <span key={k} className="rounded bg-surface px-1.5 py-0.5 text-[12px] text-ink-muted">
                      {ENTITY_LABELS[k] ?? k} {v}
                    </span>
                  ))}
              </span>
            )}
          </span>
          <ArrowRight className={`h-4 w-4 shrink-0 ${total > 0 ? 'text-status-pending-fg' : 'text-ink-faint'}`} />
        </Link>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { href: '/dfi-field-staff/view-data', icon: Eye, title: 'View data', text: 'Everything recorded at your centres' },
            { href: '/dfi-field-staff/history', icon: History, title: 'My activity', text: 'What you have verified or sent back' },
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
