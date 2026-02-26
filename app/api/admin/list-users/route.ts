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

    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, email, role, first_name, last_name, phone_no, centre_eac_no')

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

    const dfiFieldStaffIds = (profiles || [])
      .filter((profile: any) => profile.role === 'dfi_field_staff')
      .map((profile: any) => profile.id)

    let assignedEacMap: Record<string, number[]> = {}

    if (dfiFieldStaffIds.length > 0) {
      const { data: assignments, error: assignmentErr } = await supabase
        .from('dfi_field_staff_assigned_eacs')
        .select('id, assigned_eac')
        .in('id', dfiFieldStaffIds)

      if (assignmentErr) return NextResponse.json({ error: assignmentErr.message }, { status: 500 })

      assignedEacMap = (assignments || []).reduce((acc: Record<string, number[]>, row: any) => {
        const userId = row.id
        const assignedEac = Number(row.assigned_eac)
        if (!acc[userId]) acc[userId] = []
        if (!Number.isNaN(assignedEac)) {
          acc[userId].push(assignedEac)
        }
        return acc
      }, {})

      Object.keys(assignedEacMap).forEach((userId) => {
        assignedEacMap[userId] = assignedEacMap[userId].sort((a, b) => a - b)
      })
    }

    const users = (profiles || []).map((profile: any) => ({
      ...profile,
      assigned_eacs: assignedEacMap[profile.id] || [],
    }))

    return NextResponse.json({ users })
  } catch (err: any) {
    const message = err?.message || String(err)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
