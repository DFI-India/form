'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { getErrorMessage } from '../../../lib/errors'
import { toCsv } from '../../../lib/csv'
import { LoadingSpinner, Alert } from '../../components/UI'
import AppShell from '../../components/AppShell'
import { Download, Inbox, Search } from 'lucide-react'

/**
 * A volunteer's own centre, ready to take away.
 *
 * Not the admin report builder: a volunteer wants their centre's list on paper
 * or in a spreadsheet, not a query tool. Everything is scoped to the centre on
 * their profile.
 */

const SHEETS = [
  {
    key: 'Child_Data',
    label: 'Children',
    columns: [
      ['reg_no', 'Reg No'], ['first_name', 'First name'], ['last_name', 'Last name'],
      ['gender', 'Gender'], ['dateofbirth', 'Date of birth'], ['class_std_text', 'Class'],
      ['village', 'Village'], ['school_name', 'School'], ['status', 'Approval'],
    ],
  },
  {
    key: 'childfmly',
    label: 'Family',
    columns: [
      ['reg_no', 'Reg No'], ['f_name', 'Father'], ['f_occup', 'Father occupation'], ['f_mobile', 'Father mobile'],
      ['m_name', 'Mother'], ['m_occup', 'Mother occupation'], ['m_mobile', 'Mother mobile'],
      ['fmly_pincode', 'Pincode'], ['status', 'Approval'],
    ],
  },
  {
    key: 'childuniform',
    label: 'Uniform',
    columns: [
      ['reg_no', 'Reg No'], ['shirtsize', 'Shirt'], ['knickersize', 'Knicker'],
      ['pant_skirtsize', 'Pant or skirt'], ['chudidharsize', 'Chudidhar'],
      ['top_pantsize', 'Top and pant'], ['footwearsize', 'Footwear'], ['status', 'Approval'],
    ],
  },
  {
    key: 'childleaving',
    label: 'Leaving',
    columns: [
      ['reg_no', 'Reg No'], ['leav_date', 'Left on'], ['reason', 'Reason'],
      ['leav_class', 'Class when leaving'], ['pass_status', 'Pass or drop out'], ['status', 'Approval'],
    ],
  },
] as const

type SheetKey = (typeof SHEETS)[number]['key']

const txt = (v: unknown) => String(v ?? '').trim()

const cell = (v: unknown) => {
  if (v === null || v === undefined || txt(v) === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  const s = txt(v)
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s
}

export default function VolunteerReportsPage() {
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['field_volunteer'])

  const [sheet, setSheet] = useState<SheetKey>('Child_Data')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const centre = profile?.centre_eac_no ?? null
  const definition = useMemo(() => SHEETS.find((s) => s.key === sheet)!, [sheet])

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError('')
    try {
      let q = supabase.from(sheet).select('*').limit(2000)
      // Child_Data stores the centre as a number, the linked tables as text.
      if (centre) q = q.eq('eac_no', sheet === 'Child_Data' ? Number(centre) : String(centre))
      const { data, error: err } = await q
      if (err) throw err
      setRows(data ?? [])
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load your centre’s records.'))
    } finally {
      setLoading(false)
    }
  }, [profile?.id, sheet, centre])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      definition.columns.some(([key]) => txt(r[key]).toLowerCase().includes(q))
    )
  }, [rows, query, definition])

  const download = () => {
    const csv = toCsv(
      definition.columns.map(([, label]) => label),
      visible.map((r) => definition.columns.map(([key]) => r[key]))
    )
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `EAC${centre ?? ''}-${definition.label}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
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

  return (
    <AppShell
      role="field_volunteer"
      active="/field-volunteer/reports"
      breadcrumb={['My work', 'Reports']}
      username={profile.username}
      actions={
        <button
          type="button"
          onClick={download}
          disabled={visible.length === 0}
          className="flex h-[32px] items-center gap-1.5 rounded-md border border-rule-strong px-2.5 text-[13.5px] transition-colors hover:bg-surface-hover disabled:opacity-40"
        >
          <Download className="h-[13px] w-[13px]" />
          <span className="hidden sm:inline">Spreadsheet</span>
        </button>
      }
    >
      <div className="px-4 pb-10 pt-5 sm:px-6">
        {error && <Alert type="error" message={error} className="mb-4" />}

        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            {centre ? `Records at centre ${centre}.` : 'No centre is assigned to your account yet.'}
          </p>
        </div>

        <div className="-mx-4 mb-3 overflow-x-auto border-b border-rule px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1">
            {SHEETS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSheet(s.key)}
                className={`-mb-px h-10 whitespace-nowrap border-b-2 px-3 text-[14px] transition-colors ${
                  sheet === s.key ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex h-9 w-full items-center gap-2 rounded-md border border-rule-strong px-2.5 focus-within:border-blue-500 sm:w-[260px]">
            <Search className="h-[13px] w-[13px] shrink-0 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this list"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint"
            />
          </div>
          <span className="shrink-0 text-[13px] text-ink-faint">
            {loading ? 'Loading…' : `${visible.length.toLocaleString()} rows`}
          </span>
        </div>

        <div className="overflow-hidden rounded-md border border-rule">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-surface-sunken">
                  {definition.columns.map(([key, label]) => (
                    <th
                      key={key}
                      className="whitespace-nowrap border-b border-rule px-2.5 py-2 text-left text-[12.5px] font-medium text-ink-muted"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={definition.columns.length} className="p-12 text-center">
                      <LoadingSpinner size="lg" />
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={definition.columns.length} className="p-12 text-center">
                      <Inbox className="mx-auto mb-3 h-10 w-10 text-rule-strong" />
                      <p className="text-[14.5px] text-ink-muted">Nothing recorded here yet.</p>
                    </td>
                  </tr>
                ) : (
                  visible.map((row, i) => (
                    <tr key={i} className="border-b border-rule-faint last:border-0">
                      {definition.columns.map(([key]) => (
                        <td key={key} className="whitespace-nowrap px-2.5 py-1.5 text-ink-muted">
                          {cell(row[key])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
