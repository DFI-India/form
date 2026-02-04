import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type UserRole = 'field_volunteer' | 'dfi_field_staff' | 'dfi_staff' | 'admin' | 'tech_support'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, serviceRoleKey)

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
    const { id, username, email, role, password } = body
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
    if (role && VALID_ROLES.includes(role)) profileUpdate.role = role

    if (Object.keys(profileUpdate).length > 0) {
      const { error: pErr } = await supabase.from('profiles').update(profileUpdate).eq('id', id)
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
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
