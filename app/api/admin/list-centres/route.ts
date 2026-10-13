import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const SCAN_CAP = 5000

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function requireAdmin(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null
  if (!token) throw new Error('Unauthorized')

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (pErr || !profile || (profile as any).role !== 'admin') throw new Error('Forbidden')
  return data.user
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req)

    const { data, error } = await supabase
      .from('centre_data')
      .select('*')
      .order('eac_no', { ascending: true })

    if (error) {
      console.error('Centre fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const url = new URL(req.url)
    if (url.searchParams.get('counts') !== '1') {
      return NextResponse.json({ centres: data || [] })
    }

    // Per-centre roll-up. PostgREST can't GROUP BY and "no family row" is an
    // anti-join, so both are done here over two key-only scans. Opt-in via
    // ?counts=1 so callers that only need the centre list don't pay for it.
    const [{ data: children }, { data: family }] = await Promise.all([
      supabase.from('Child_Data').select('eac_no, reg_no, child_left').limit(SCAN_CAP),
      supabase.from('childfmly').select('eac_no, reg_no').limit(SCAN_CAP),
    ])

    const familySet = new Set((family || []).map((r: any) => `${String(r.eac_no)}::${String(r.reg_no)}`))
    const counts: Record<string, { total: number; enrolled: number; left: number; missingFamily: number }> = {}

    for (const row of children || []) {
      const eac = String(row.eac_no ?? '').trim()
      if (!eac) continue
      const bucket = counts[eac] || (counts[eac] = { total: 0, enrolled: 0, left: 0, missingFamily: 0 })
      bucket.total += 1
      if (row.child_left) bucket.left += 1
      else bucket.enrolled += 1
      if (!familySet.has(`${String(row.eac_no)}::${String(row.reg_no)}`)) bucket.missingFamily += 1
    }

    return NextResponse.json({ centres: data || [], counts })
  } catch (err: any) {
    const message = err?.message || String(err)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
