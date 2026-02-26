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

// Basic email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

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

export async function POST(req: Request) {
  try {
    await requireAdmin(req)

    const body = await req.json()
    let { username, email, password, role, centre_eac_no, assigned_eacs, first_name, last_name, phone_no } = body

    if (!email || !password || !username || !first_name || !last_name || !phone_no) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    first_name = String(first_name || '').trim()
    last_name = String(last_name || '').trim()
    phone_no = String(phone_no || '').trim()

    if (!first_name || !last_name || !phone_no) {
      return NextResponse.json({ error: 'first_name, last_name and phone_no are required' }, { status: 400 })
    }

    // Trim and validate email
    email = (email || '').trim().toLowerCase()
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Trim username
    username = (username || '').trim()
    if (!username || username.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 })
    }

    const userRole: UserRole = VALID_ROLES.includes(role) ? role : 'field_volunteer'

    let centreEacNoValue: string | null = null
    let assignedEacsForDfiFieldStaff: number[] = []
    if (userRole === 'field_volunteer') {
      const rawCentreEacNo = typeof centre_eac_no === 'number'
        ? String(centre_eac_no)
        : String(centre_eac_no || '').trim()

      if (!rawCentreEacNo) {
        return NextResponse.json({ error: 'centre_eac_no is required for field volunteers' }, { status: 400 })
      }

      if (!/^\d+$/.test(rawCentreEacNo)) {
        return NextResponse.json({ error: 'centre_eac_no must be a valid integer value' }, { status: 400 })
      }

      const { data: centre, error: centreErr } = await supabase
        .from('centre_data')
        .select('eac_no')
        .eq('eac_no', rawCentreEacNo)
        .maybeSingle()

      if (centreErr) {
        return NextResponse.json({ error: centreErr.message }, { status: 500 })
      }

      if (!centre) {
        return NextResponse.json({ error: 'Selected centre_eac_no was not found' }, { status: 400 })
      }

      centreEacNoValue = rawCentreEacNo
    }

    if (userRole === 'dfi_field_staff') {
      const rawAssignedEacs = Array.isArray(assigned_eacs) ? assigned_eacs : []
      const parsed = rawAssignedEacs
        .map((value: unknown) => String(value).trim())
        .filter((value: string) => value.length > 0)

      if (parsed.length === 0) {
        return NextResponse.json({ error: 'At least one assigned_eac is required for DFI Field Staff' }, { status: 400 })
      }

      const uniqueParsed = Array.from(new Set(parsed))
      if (uniqueParsed.some((value) => !/^\d+$/.test(value))) {
        return NextResponse.json({ error: 'All assigned_eac values must be valid integer values' }, { status: 400 })
      }

      const { data: centres, error: centresErr } = await supabase
        .from('centre_data')
        .select('eac_no')
        .in('eac_no', uniqueParsed)

      if (centresErr) {
        return NextResponse.json({ error: centresErr.message }, { status: 500 })
      }

      const foundSet = new Set((centres || []).map((centre: any) => String(centre.eac_no)))
      const missing = uniqueParsed.filter((value) => !foundSet.has(value))
      if (missing.length > 0) {
        return NextResponse.json({ error: `Invalid assigned_eac values: ${missing.join(', ')}` }, { status: 400 })
      }

      assignedEacsForDfiFieldStaff = uniqueParsed.map((value) => Number(value))
    }

    // Check if username already exists
    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingUsername) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingEmail) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { role: userRole, username },
      email_confirm: true,
    } as any)

    if (createErr) {
      // Check if it's a duplicate email error from Auth (orphaned user)
      if (createErr.message?.includes('already exists') || createErr.message?.includes('already registered')) {
        // Email exists in Auth but not in profiles - this is an orphaned user
        return NextResponse.json({
          error: 'Email already registered in system. If you believe this is an error, please contact support.'
        }, { status: 400 })
      }
      return NextResponse.json({ error: createErr.message }, { status: 500 })
    }

    const createdUserId = (created as any).user?.id

    const { error: profileInsertErr } = await supabase.from('profiles').insert({
      id: (created as any).user?.id,
      username,
      email,
      first_name,
      last_name,
      phone_no,
      role: userRole,
      centre_eac_no: centreEacNoValue,
    })

    if (profileInsertErr) {
      await supabase.auth.admin.deleteUser(createdUserId)
      return NextResponse.json({ error: profileInsertErr.message }, { status: 500 })
    }

    if (userRole === 'dfi_field_staff') {
      const rows = assignedEacsForDfiFieldStaff.map((assignedEac) => ({
        id: createdUserId,
        assigned_eac: assignedEac,
      }))

      const { error: assignErr } = await supabase
        .from('dfi_field_staff_assigned_eacs')
        .insert(rows)

      if (assignErr) {
        await supabase.from('profiles').delete().eq('id', createdUserId)
        await supabase.auth.admin.deleteUser(createdUserId)
        return NextResponse.json({ error: assignErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, user: created })
  } catch (err: any) {
    const message = err?.message || String(err)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
