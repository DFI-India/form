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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'tech_support'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const actionType = searchParams.get('actionType') || 'all'
    const entityType = searchParams.get('entityType') || 'all'
    const userId = searchParams.get('userId') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabaseAdmin
      .from('activity_logs')
      .select(`
        *,
        user:profiles!user_id(id, username, role)
      `, { count: 'exact' })

    // Apply filters
    if (actionType !== 'all') {
      query = query.eq('action_type', actionType)
    }
    if (entityType !== 'all') {
      query = query.eq('entity_type', entityType)
    }
    if (userId !== 'all') {
      query = query.eq('user_id', userId)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('List logs error:', error)
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }

    // Get unique users for filter dropdown
    const { data: usersData } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role')
      .order('username')

    return NextResponse.json({
      success: true,
      logs: data || [],
      users: usersData || [],
      total: count || 0,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error: any) {
    console.error('List logs error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
