import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type UserRole = 'field_volunteer' | 'dfi_field_staff' | 'dfi_staff' | 'admin' | 'tech_support'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const VALID_ROLES: UserRole[] = ['field_volunteer', 'dfi_field_staff', 'dfi_staff', 'admin', 'tech_support']

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

export async function PUT(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json()
    const { id, username, email, role, password, assigned_eacs, centre_eac_no } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    if (email || password || role || username) {
      const update: any = {}
      if (email) update.email = email
      if (password) update.password = password
      const userRole = role && VALID_ROLES.includes(role) ? role : undefined
      if (username || userRole) {
        update.user_metadata = {
          ...(username ? { username } : {}),
          ...(userRole ? { role: userRole } : {}),
        }
      }

      const { error: uErr } = await supabase.auth.admin.updateUserById(id, update)
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    const profileUpdate: any = {}
    if (username) profileUpdate.username = username
    if (email) profileUpdate.email = email
    if (role && VALID_ROLES.includes(role)) {
      profileUpdate.role = role
      if (role === 'dfi_field_staff') {
        profileUpdate.centre_eac_no = null
      }
    }

    if (Object.keys(profileUpdate).length > 0) {
      const { error: pErr } = await supabase.from('profiles').update(profileUpdate).eq('id', id)
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    const hasCentreEacNo = Object.prototype.hasOwnProperty.call(body, 'centre_eac_no')
    if (hasCentreEacNo) {
      const rawCentreEacNo = typeof centre_eac_no === 'number'
        ? String(centre_eac_no)
        : String(centre_eac_no || '').trim()

      if (!rawCentreEacNo) {
        return NextResponse.json({ error: 'centre_eac_no is required' }, { status: 400 })
      }

      if (!/^\d+$/.test(rawCentreEacNo)) {
        return NextResponse.json({ error: 'centre_eac_no must be a valid integer value' }, { status: 400 })
      }

      const { data: centre, error: centreErr } = await supabase
        .from('centre_data')
        .select('eac_no')
        .eq('eac_no', rawCentreEacNo)
        .maybeSingle()

      if (centreErr) return NextResponse.json({ error: centreErr.message }, { status: 500 })
      if (!centre) return NextResponse.json({ error: 'Selected centre_eac_no was not found' }, { status: 400 })

      const { error: updateCentreErr } = await supabase
        .from('profiles')
        .update({ centre_eac_no: rawCentreEacNo })
        .eq('id', id)

      if (updateCentreErr) return NextResponse.json({ error: updateCentreErr.message }, { status: 500 })
    }

    const hasAssignedEacs = Object.prototype.hasOwnProperty.call(body, 'assigned_eacs')
    if (hasAssignedEacs) {
      const rawAssignedEacs = Array.isArray(assigned_eacs) ? assigned_eacs : []
      const parsed = rawAssignedEacs
        .map((value: unknown) => String(value).trim())
        .filter((value: string) => value.length > 0)

      if (parsed.length === 0) {
        return NextResponse.json({ error: 'Please provide at least one assigned_eac' }, { status: 400 })
      }

      const uniqueParsed = Array.from(new Set(parsed))
      if (uniqueParsed.some((value) => !/^\d+$/.test(value))) {
        return NextResponse.json({ error: 'All assigned_eac values must be valid integer values' }, { status: 400 })
      }

      const { data: centres, error: centresErr } = await supabase
        .from('centre_data')
        .select('eac_no')
        .in('eac_no', uniqueParsed)

      if (centresErr) return NextResponse.json({ error: centresErr.message }, { status: 500 })

      const foundSet = new Set((centres || []).map((centre: any) => String(centre.eac_no)))
      const missing = uniqueParsed.filter((value) => !foundSet.has(value))
      if (missing.length > 0) {
        return NextResponse.json({ error: `Invalid assigned_eac values: ${missing.join(', ')}` }, { status: 400 })
      }

      const { error: deleteErr } = await supabase
        .from('dfi_field_staff_assigned_eacs')
        .delete()
        .eq('id', id)

      if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

      const rows = uniqueParsed.map((value) => ({ id, assigned_eac: Number(value) }))
      const { error: insertErr } = await supabase
        .from('dfi_field_staff_assigned_eacs')
        .insert(rows)

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

      const { error: clearCentreErr } = await supabase
        .from('profiles')
        .update({ centre_eac_no: null })
        .eq('id', id)

      if (clearCentreErr) return NextResponse.json({ error: clearCentreErr.message }, { status: 500 })
    }

    if (role && VALID_ROLES.includes(role) && role !== 'dfi_field_staff') {
      const { error: deleteAssignedErr } = await supabase
        .from('dfi_field_staff_assigned_eacs')
        .delete()
        .eq('id', id)

      if (deleteAssignedErr) return NextResponse.json({ error: deleteAssignedErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    const message = err?.message || String(err)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
