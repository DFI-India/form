import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
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
}

type Level = 'district' | 'taluk' | 'panchayat' | 'village'

function getScope(body: any) {
  return {
    district: String(body?.district || '').trim(),
    taluk: String(body?.taluk || '').trim(),
    panchayat: String(body?.panchayat || '').trim(),
  }
}

function validateLevel(level: string): level is Level {
  return ['district', 'taluk', 'panchayat', 'village'].includes(level)
}

export async function PUT(req: Request) {
  try {
    await requireAdmin(req)

    const body = await req.json()
    const level = String(body?.level || '').trim() as Level
    const oldValue = String(body?.oldValue || '').trim()
    const newValue = String(body?.newValue || '').trim()
    const { district, taluk, panchayat } = getScope(body)

    if (!validateLevel(level)) {
      return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
    }

    if (!oldValue || !newValue) {
      return NextResponse.json({ error: 'Missing oldValue or newValue' }, { status: 400 })
    }

    if (oldValue === newValue) {
      return NextResponse.json({ success: true, updatedCount: 0 })
    }

    let query = supabase.from('centre_data').update({})

    if (level === 'district') {
      query = supabase.from('centre_data').update({ district: newValue }).eq('district', oldValue)
    }

    if (level === 'taluk') {
      if (!district) {
        return NextResponse.json({ error: 'District is required for taluk rename' }, { status: 400 })
      }
      query = supabase
        .from('centre_data')
        .update({ taluk: newValue })
        .eq('district', district)
        .eq('taluk', oldValue)
    }

    if (level === 'panchayat') {
      if (!district || !taluk) {
        return NextResponse.json({ error: 'District and taluk are required for panchayat rename' }, { status: 400 })
      }
      query = supabase
        .from('centre_data')
        .update({ panchayat: newValue })
        .eq('district', district)
        .eq('taluk', taluk)
        .eq('panchayat', oldValue)
    }

    if (level === 'village') {
      if (!district || !taluk || !panchayat) {
        return NextResponse.json(
          { error: 'District, taluk, and panchayat are required for village rename' },
          { status: 400 }
        )
      }
      query = supabase
        .from('centre_data')
        .update({ village_name: newValue })
        .eq('district', district)
        .eq('taluk', taluk)
        .eq('panchayat', panchayat)
        .eq('village_name', oldValue)
    }

    const { data, error } = await query.select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updatedCount: data?.length || 0 })
  } catch (err: any) {
    const message = err?.message || String(err)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin(req)

    const body = await req.json()
    const level = String(body?.level || '').trim()
    const oldValue = String(body?.oldValue || '').trim()
    const { district, taluk, panchayat } = getScope(body)

    if (!validateLevel(level)) {
      return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
    }

    if (!oldValue) {
      return NextResponse.json({ error: 'Missing oldValue' }, { status: 400 })
    }

    let query = supabase.from('centre_data').update({})

    if (level === 'district') {
      query = supabase
        .from('centre_data')
        .update({ district: null, taluk: null, panchayat: null, village_name: null })
        .eq('district', oldValue)
    }

    if (level === 'taluk') {
      if (!district) {
        return NextResponse.json({ error: 'District is required for taluk delete' }, { status: 400 })
      }
      query = supabase
        .from('centre_data')
        .update({ taluk: null, panchayat: null, village_name: null })
        .eq('district', district)
        .eq('taluk', oldValue)
    }

    if (level === 'panchayat') {
      if (!district || !taluk) {
        return NextResponse.json({ error: 'District and taluk are required for panchayat delete' }, { status: 400 })
      }
      query = supabase
        .from('centre_data')
        .update({ panchayat: null, village_name: null })
        .eq('district', district)
        .eq('taluk', taluk)
        .eq('panchayat', oldValue)
    }

    if (level === 'village') {
      if (!district || !taluk || !panchayat) {
        return NextResponse.json(
          { error: 'District, taluk, and panchayat are required for village delete' },
          { status: 400 }
        )
      }
      query = supabase
        .from('centre_data')
        .update({ village_name: null })
        .eq('district', district)
        .eq('taluk', taluk)
        .eq('panchayat', panchayat)
        .eq('village_name', oldValue)
    }

    const { data, error } = await query.select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updatedCount: data?.length || 0 })
  } catch (err: any) {
    const message = err?.message || String(err)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
