import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type EntityType = 'child_data' | 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving' | 'vocational_course' | 'computer_course'

const DEFAULT_SORT_COLUMN_BY_ENTITY: Record<EntityType, string> = {
  child_data: 'first_name',
  childfmly: 'f_name',
  childsibling: 'reg_no',
  childuniform: 'reg_no',
  childleaving: 'reg_no',
  vocational_course: 'trainee_name',
  computer_course: 'child_name',
}

const SORTABLE_COLUMNS_BY_ENTITY: Record<EntityType, Set<string>> = {
  child_data: new Set([
    'id', 'record_id', 'reg_no', 'eac_no', 'first_name', 'last_name', 'village_name', 'gender', 'class_std_text', 'adm_date', 'status', 'created_at', 'updated_at', 'verified_at', 'approved_at',
  ]),
  childfmly: new Set([
    'id', 'record_id', 'reg_no', 'eac_no', 'f_name', 'm_name', 'guardian_name', 'village_name', 'f_mobile', 'm_mobile', 'status', 'created_at', 'updated_at', 'verified_at', 'approved_at',
  ]),
  childsibling: new Set([
    'id', 'record_id', 'reg_no', 'eac_no', 'sibling_name', 'name', 'gender', 'class_std_text', 'age', 'status', 'created_at', 'updated_at', 'verified_at', 'approved_at',
  ]),
  childuniform: new Set([
    'id', 'record_id', 'reg_no', 'eac_no', 'uniform_size', 'shoe_size', 'status', 'created_at', 'updated_at', 'verified_at', 'approved_at',
  ]),
  childleaving: new Set([
    'id', 'record_id', 'reg_no', 'eac_no', 'reason', 'leaving_reason', 'leave_date', 'status', 'created_at', 'updated_at', 'verified_at', 'approved_at',
  ]),
  vocational_course: new Set([
    'id', 'record_id', 'vocational_id', 'reg_no', 'eac_no', 'trainee_name', 'course_name', 'institution_name', 'status', 'created_at', 'updated_at', 'verified_at', 'approved_at',
  ]),
  computer_course: new Set([
    'id', 'record_id', 'computer_id', 'reg_no', 'eac_no', 'child_name', 'course_name', 'institution_name', 'status', 'created_at', 'updated_at', 'verified_at', 'approved_at',
  ]),
}

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
    const entityType = (searchParams.get('entityType') || 'child_data') as EntityType
    const status = searchParams.get('status') || 'all'
    const search = (searchParams.get('search') || '').trim()
    const searchBy = searchParams.get('searchBy') || 'name'
    const eacNoFilter = (searchParams.get('eacNoFilter') || '').trim()
    const villageFilter = (searchParams.get('villageFilter') || '').trim()
    const rawSortColumn = searchParams.get('sortColumn') || DEFAULT_SORT_COLUMN_BY_ENTITY[entityType] || 'created_at'
    const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const includeFilterOptions = searchParams.get('includeFilterOptions') === '1'
    const offset = (page - 1) * limit

    // Map entity type to table name
    let tableName: string = entityType
    if (entityType === 'child_data') tableName = 'Child_Data'

    const sortableColumns = SORTABLE_COLUMNS_BY_ENTITY[entityType]
    const sortColumn = sortableColumns.has(rawSortColumn)
      ? rawSortColumn
      : (DEFAULT_SORT_COLUMN_BY_ENTITY[entityType] || 'created_at')

    const getChildDataMatchingPairs = async (childLeftValue: boolean) => {
      let childStatusQuery = supabaseAdmin
        .from('Child_Data')
        .select('eac_no, reg_no')
        .eq('child_left', childLeftValue)

      if (profile.role === 'dfi_field_staff' && profile.centre_eac_no) {
        childStatusQuery = childStatusQuery.eq('eac_no', profile.centre_eac_no)
      }

      if (eacNoFilter) {
        childStatusQuery = childStatusQuery.eq('eac_no', eacNoFilter)
      }

      if (villageFilter) {
        childStatusQuery = childStatusQuery.eq('village_name', villageFilter)
      }

      const { data: childStatusMatches, error: childStatusError } = await childStatusQuery
      if (childStatusError) {
        throw childStatusError
      }

      return (childStatusMatches || [])
        .map((row: any) => ({
          eac_no: row.eac_no,
          reg_no: row.reg_no,
        }))
        .filter((row: any) => row.eac_no !== null && row.eac_no !== undefined && row.reg_no !== null && row.reg_no !== undefined)
    }

    let matchingRegNosForNameSearch: any[] | null = null
    let forceEmptyResult = false

    if (search && searchBy === 'name' && !['child_data', 'vocational_course', 'computer_course'].includes(entityType)) {
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

      matchingRegNosForNameSearch = (childMatches || [])
        .map((row: any) => row.reg_no)
        .filter((regNo: any) => regNo !== null && regNo !== undefined)

      if (matchingRegNosForNameSearch.length === 0) {
        forceEmptyResult = true
      }
    }

    const applyFilters = <T extends { eq: Function; in: Function; or: Function }>(baseQuery: T, includeStatusFilter: boolean) => {
      let query = baseQuery

      if (includeStatusFilter) {
        // Note: ENROLLED/LEFT status is handled separately above; this filters by approval status only
        if (status !== 'all' && status !== 'ENROLLED' && status !== 'LEFT') {
          if (status === 'reviewable') {
            query = query.in('status', ['Verified', 'Approved']) as T
          } else {
            query = query.eq('status', status) as T
          }
        }
      }

      if (profile.role === 'dfi_field_staff' && profile.centre_eac_no) {
        query = query.eq('eac_no', profile.centre_eac_no) as T
      }

      if (eacNoFilter) {
        query = query.eq('eac_no', eacNoFilter) as T
      }

      if (villageFilter) {
        query = query.eq('village_name', villageFilter) as T
      }

      if (search) {
        if (searchBy === 'reg_no') {
          const regNo = Number(search)
          if (Number.isNaN(regNo)) {
            forceEmptyResult = true
            return query
          }
          query = query.eq('reg_no', regNo) as T
        } else if (searchBy === 'eac_no') {
          query = query.eq('eac_no', search) as T
        } else {
          if (entityType === 'child_data') {
            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`) as T
          } else if (entityType === 'vocational_course') {
            query = query.or(`trainee_name.ilike.%${search}%`) as T
          } else if (entityType === 'computer_course') {
            query = query.or(`child_name.ilike.%${search}%`) as T
          } else if (matchingRegNosForNameSearch && matchingRegNosForNameSearch.length > 0) {
            query = query.in('reg_no', matchingRegNosForNameSearch) as T
          } else {
            forceEmptyResult = true
          }
        }
      }

      return query
    }

    if (forceEmptyResult) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        statusSummary: {
          Pending: 0,
          Verified: 0,
          Approved: 0,
          Rejected: 0,
        },
        pagination: {
          page,
          limit,
          totalPages: 0,
        },
      })
    }

    // Build query - just select all columns without joins for now
    let query = supabaseAdmin
      .from(tableName)
      .select('*', { count: 'exact' })

    // Apply enrollment filter (Child Left) across entities.
    let enrolledChildPairs: Array<{ eac_no: string | number; reg_no: string | number }> = []

    if (status === 'ENROLLED' || status === 'LEFT') {
      const childLeftValue = status === 'LEFT'

      if (entityType === 'child_data') {
        query = query.eq('child_left', childLeftValue)
      } else {
        enrolledChildPairs = await getChildDataMatchingPairs(childLeftValue)

        if (enrolledChildPairs.length === 0) {
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
      }
    }

    query = applyFilters(query, true)

    if (forceEmptyResult) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        statusSummary: {
          Pending: 0,
          Verified: 0,
          Approved: 0,
          Rejected: 0,
        },
        pagination: {
          page,
          limit,
          totalPages: 0,
        },
      })
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
    const finalSortColumn = allowedSortColumns.includes(rawSortColumn)
      ? rawSortColumn
      : (DEFAULT_SORT_COLUMN_BY_ENTITY[entityType] || 'created_at')

    // Apply sorting before pagination so ordering is global across the dataset.
    query = query.order(finalSortColumn, { ascending: sortDirection === 'asc' })

    const { data, count, error } = await query

    if (error) {
      console.error('List records error:', error)
      return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
    }

    let filteredRecords = data || []

    if (status === 'ENROLLED' || status === 'LEFT') {
      const matchingPairs = new Set(
        enrolledChildPairs.map((pair) => `${String(pair.eac_no)}::${String(pair.reg_no)}`)
      )

      if (entityType !== 'child_data' && matchingPairs.size > 0) {
        filteredRecords = (data || []).filter((row: any) => {
          const rowEacNo = row?.eac_no
          const rowRegNo = row?.reg_no

          if (rowEacNo === null || rowEacNo === undefined || rowRegNo === null || rowRegNo === undefined) {
            return false
          }

          return matchingPairs.has(`${String(rowEacNo)}::${String(rowRegNo)}`)
        })
      }
    }

    const paginatedRecords = filteredRecords.slice(offset, offset + limit)
    const filteredCount = filteredRecords.length

    const statuses = ['Pending', 'Verified', 'Approved', 'Rejected'] as const
    const statusCounts = await Promise.all(
      statuses.map(async (statusValue) => {
        let statusQuery = supabaseAdmin
          .from(tableName)
          .select('*', { count: 'exact', head: true })

        statusQuery = applyFilters(statusQuery, false)

        if (forceEmptyResult) {
          return [statusValue, 0] as const
        }

        statusQuery = statusQuery.eq('status', statusValue)

        // Approved card should represent actively enrolled children for Child_Data.
        if (entityType === 'child_data' && statusValue === 'Approved') {
          statusQuery = statusQuery.eq('child_left', false)
        }

        const { count: statusCount } = await statusQuery
        return [statusValue, statusCount || 0] as const
      })
    )

    const statusSummary = Object.fromEntries(statusCounts)

    let filterOptions: { eacNos: string[]; villagesByEacNo: Record<string, string[]> } | undefined

    if (includeFilterOptions && entityType === 'child_data') {
      let filterQuery = supabaseAdmin
        .from('Child_Data')
        .select('eac_no, village_name')

      if (profile.role === 'dfi_field_staff' && profile.centre_eac_no) {
        filterQuery = filterQuery.eq('eac_no', profile.centre_eac_no)
      }

      const { data: filterRows, error: filterError } = await filterQuery

      if (filterError) {
        console.error('List record filter options error:', filterError)
        return NextResponse.json({ error: 'Failed to fetch filter options' }, { status: 500 })
      }

      const eacMap = new Map<string, Set<string>>()
      for (const row of filterRows || []) {
        const eacNo = String(row.eac_no ?? '').trim()
        const villageName = String(row.village_name ?? '').trim()
        if (!eacNo) continue

        if (!eacMap.has(eacNo)) {
          eacMap.set(eacNo, new Set<string>())
        }

        if (villageName) {
          eacMap.get(eacNo)!.add(villageName)
        }
      }

      filterOptions = {
        eacNos: Array.from(eacMap.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
        villagesByEacNo: Object.fromEntries(
          Array.from(eacMap.entries()).map(([eacNo, villages]) => [
            eacNo,
            Array.from(villages).sort((a, b) => a.localeCompare(b))
          ])
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: paginatedRecords,
      total: filteredCount || 0,
      statusSummary,
      filterOptions,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil((filteredCount || 0) / limit)
      }
    })
  } catch (error: any) {
    console.error('List records error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
