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
    const searchBy = searchParams.get('searchBy') || 'name'
    const sortColumn = searchParams.get('sortColumn') || 'created_at'
    const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Map entity type to table name
    let tableName = entityType
    if (entityType === 'child_data') tableName = 'Child_Data'

    // Build query - just select all columns without joins for now
    let query = supabaseAdmin
      .from(tableName)
      .select('*', { count: 'exact' })

    // Apply enrollment filter (Child Left) across entities.
    if (status === 'ENROLLED' || status === 'LEFT') {
      const childLeftValue = status === 'LEFT'

      if (entityType === 'child_data') {
        query = query.eq('child_left', childLeftValue)
      } else {
        let childStatusQuery = supabaseAdmin
          .from('Child_Data')
          .select('reg_no')
          .eq('child_left', childLeftValue)

        if (profile.role === 'dfi_field_staff' && profile.centre_eac_no) {
          childStatusQuery = childStatusQuery.eq('eac_no', profile.centre_eac_no)
        }

        const { data: childStatusMatches, error: childStatusError } = await childStatusQuery

        if (childStatusError) {
          console.error('Child enrollment filter error:', childStatusError)
          return NextResponse.json({ error: 'Failed to filter records' }, { status: 500 })
        }

        const matchingRegNos = (childStatusMatches || [])
          .map((row: any) => row.reg_no)
          .filter((regNo: any) => regNo !== null && regNo !== undefined)

        if (matchingRegNos.length === 0) {
          return NextResponse.json({
            success: true,
            data: [],
            total: 0,
            pagination: {
              page,
              limit,
              totalPages: 0
            }
          })
        }

        query = query.in('reg_no', matchingRegNos)
      }
    }

    // Apply centre filter only for DFI field staff
    if (profile.role === 'dfi_field_staff' && profile.centre_eac_no) {
      query = query.eq('eac_no', profile.centre_eac_no)
    }

    // Apply search filter
    if (search) {
      if (searchBy === 'reg_no') {
        const regNo = Number(search)
        if (!Number.isNaN(regNo)) {
          query = query.eq('reg_no', regNo)
        }
      } else {
        if (entityType === 'child_data') {
          query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
        } else if (entityType === 'vocational_course') {
          query = query.or(`trainee_name.ilike.%${search}%`)
        } else if (entityType === 'computer_course') {
          query = query.or(`child_name.ilike.%${search}%`)
        } else {
          let childNameQuery = supabaseAdmin
            .from('Child_Data')
            .select('reg_no')
            .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)

          if (profile.role === 'dfi_field_staff' && profile.centre_eac_no) {
            childNameQuery = childNameQuery.eq('eac_no', profile.centre_eac_no)
          }

          const { data: childMatches, error: childMatchesError } = await childNameQuery

          if (childMatchesError) {
            console.error('Child name search error:', childMatchesError)
            return NextResponse.json({ error: 'Failed to search records by name' }, { status: 500 })
          }

          const matchingRegNos = (childMatches || [])
            .map((row: any) => row.reg_no)
            .filter((regNo: any) => regNo !== null && regNo !== undefined)

          if (matchingRegNos.length === 0) {
            return NextResponse.json({
              success: true,
              data: [],
              total: 0,
              pagination: {
                page,
                limit,
                totalPages: 0
              }
            })
          }

          query = query.in('reg_no', matchingRegNos)
        }
      }
    }

    const sortableColumnsByEntity: Record<string, string[]> = {
      child_data: ['created_at', 'first_name', 'last_name', 'reg_no', 'eac_no', 'village_name', 'class_std_text'],
      childfmly: ['created_at', 'reg_no', 'eac_no'],
      childsibling: ['created_at', 'reg_no', 'eac_no'],
      childuniform: ['created_at', 'reg_no', 'eac_no'],
      childleaving: ['created_at', 'reg_no', 'eac_no'],
      vocational_course: ['created_at', 'reg_no', 'eac_no'],
      computer_course: ['created_at', 'reg_no', 'eac_no']
    }

    const allowedSortColumns = sortableColumnsByEntity[entityType] || ['created_at']
    const safeSortColumn = allowedSortColumns.includes(sortColumn) ? sortColumn : 'created_at'

    // Apply sorting before pagination so ordering is global across the dataset.
    query = query
      .order(safeSortColumn, { ascending: sortDirection === 'asc' })
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
