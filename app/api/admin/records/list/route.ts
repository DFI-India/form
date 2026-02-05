import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // Check if user has access
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
    const entityType = searchParams.get('entityType') || 'child_data'
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Map entity type to table name
    let tableName = entityType
    if (entityType === 'child_data') tableName = 'Child_Data'

    // Build query
    let query = supabaseAdmin
      .from(tableName)
      .select(`
        *,
        submitter:profiles!submitted_by(username, role),
        approver:profiles!approved_by(username, role)
      `, { count: 'exact' })

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply search filter
    if (search) {
      if (entityType === 'child_data') {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,reg_no.eq.${search},aadhar_no.eq.${search}`)
      } else if (entityType === 'vocational_course' || entityType === 'computer_course') {
        query = query.or(`trainee_name.ilike.%${search}%,child_name.ilike.%${search}%,reg_no.eq.${search},aadhar_no.ilike.%${search}%`)
      } else {
        query = query.or(`reg_no.eq.${search}`)
      }
    }

    // Apply centre filter for non-admin roles
    if (profile.role !== 'admin' && profile.centre_eac_no) {
      query = query.eq('eac_no', profile.centre_eac_no)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('List records error:', error)
      return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error: any) {
    console.error('List records error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
