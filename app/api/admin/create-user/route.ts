import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type UserRole = 'field_volunteer' | 'dfi_field_staff' | 'dfi_staff' | 'admin' | 'tech_support'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL! || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || ''
const supabase = createClient(supabaseUrl, serviceRoleKey)

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
    let { username, email, password, role } = body

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
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

    await supabase.from('profiles').insert({ id: (created as any).user?.id, username, email, role: userRole })

    return NextResponse.json({ success: true, user: created })
  } catch (err: any) {
    const message = err?.message || String(err)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
