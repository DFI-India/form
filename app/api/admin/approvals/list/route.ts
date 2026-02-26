import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin or dfi_staff
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, centre_eac_no')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'dfi_staff', 'dfi_field_staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') || 'all'
    const status = searchParams.get('status') || 'Pending'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build response with all entity types
    const results: Record<string, any[]> = {}
    const counts: Record<string, number> = {}

    const entityTypes = entityType === 'all'
      ? ['child_data', 'childfmly', 'childsibling', 'childuniform', 'childleaving', 'vocational_course', 'computer_course']
      : [entityType]

    for (const type of entityTypes) {
      let tableName = type
      if (type === 'child_data') tableName = 'Child_Data'

      // Get count
      let countQuery = supabaseAdmin
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('status', status)

      // Filter by centre only for DFI field staff
      if (profile.role === 'dfi_field_staff' && profile.centre_eac_no) {
        countQuery = countQuery.eq('eac_no', profile.centre_eac_no)
      }

      const { count } = await countQuery
      counts[type] = count || 0

      // Get data without joins (foreign keys not set up)
      let dataQuery = supabaseAdmin
        .from(tableName)
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      // Filter by centre only for DFI field staff
      if (profile.role === 'dfi_field_staff' && profile.centre_eac_no) {
        dataQuery = dataQuery.eq('eac_no', profile.centre_eac_no)
      }

      const { data, error } = await dataQuery

      if (error) {
        console.error(`Error fetching ${type}:`, error)
        results[type] = []
      } else {
        results[type] = data || []
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      counts,
      pagination: { page, limit, offset }
    })
  } catch (error: any) {
    console.error('List approvals error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
