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

type ReportSource = 'child_data' | 'vocational_course'

const ALLOWED_COLUMNS_BY_SOURCE = {
    child_data: [
        'village',
        'eac_no',
        'centre_id',
        'district',
        'taluk',
        'gender',
        'caste',
        'mother_tongue',
        'class_std'
    ],
    vocational_course: [
        'eac_no',
        'district',
        'taluk',
        'village',
        'religion',
        'caste',
        'mother_tongue'
    ]
} as const

type AllowedColumn = (typeof ALLOWED_COLUMNS_BY_SOURCE)[ReportSource][number]

const TABLE_MAP: Record<ReportSource, string> = {
    child_data: 'Child_Data',
    vocational_course: 'vocational_course'
}

const NUMERIC_COLUMNS = new Set<string>(['eac_no', 'class_std', 'centre_id'])

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || !['admin'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const source = (body?.source || 'child_data') as ReportSource
        const groupByRaw = String(body?.groupBy || '').trim()
        const filtersRaw = (body?.filters || {}) as Record<string, unknown>

        if (!Object.keys(TABLE_MAP).includes(source)) {
            return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
        }

        const allowedColumns = ALLOWED_COLUMNS_BY_SOURCE[source]
        const allowedColumnSet = new Set<string>(allowedColumns)

        if (!groupByRaw || !allowedColumnSet.has(groupByRaw)) {
            return NextResponse.json(
                { error: `Invalid groupBy. Allowed values: ${allowedColumns.join(', ')}` },
                { status: 400 }
            )
        }

        for (const key of Object.keys(filtersRaw)) {
            if (!allowedColumnSet.has(key)) {
                return NextResponse.json(
                    { error: `Invalid filter column: ${key}` },
                    { status: 400 }
                )
            }
        }

        const groupBy = groupByRaw as AllowedColumn
        const tableName = TABLE_MAP[source]

        const normalizeGroup = (rawGroup: unknown) => {
            if (rawGroup === null || rawGroup === undefined || String(rawGroup).trim() === '') {
                return 'Not Specified'
            }
            return String(rawGroup)
        }

        const { data: allGroupRows, error: allGroupRowsError } = await supabaseAdmin
            .from(tableName)
            .select(groupBy)

        if (allGroupRowsError) {
            console.error('Generate report groups query error:', allGroupRowsError)
            return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
        }

        const allGroups = new Set<string>()
        for (const row of (allGroupRows || []) as Record<string, unknown>[]) {
            allGroups.add(normalizeGroup(row[groupBy]))
        }

        // Query is built with validated column names and bound filter values via query builder methods.
        // This avoids direct SQL string interpolation of user-provided values.
        let query = supabaseAdmin
            .from(tableName)
            .select(groupBy)

        for (const [column, rawValue] of Object.entries(filtersRaw)) {
            if (rawValue === null || rawValue === undefined) continue
            const value = String(rawValue).trim()
            if (!value) continue

            if (NUMERIC_COLUMNS.has(column)) {
                const numericValue = Number(value)
                if (!Number.isNaN(numericValue)) {
                    query = query.eq(column, numericValue)
                }
            } else {
                query = query.eq(column, value)
            }
        }

        const { data, error } = await query

        if (error) {
            console.error('Generate report query error:', error)
            return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
        }

        const grouped = new Map<string, number>()

        for (const row of (data || []) as Record<string, unknown>[]) {
            const groupValue = normalizeGroup(row[groupBy])

            grouped.set(groupValue, (grouped.get(groupValue) || 0) + 1)
        }

        const result = Array.from(allGroups)
            .map((group) => ({
                group,
                total_children: grouped.get(group) || 0
            }))
            .sort((a, b) => a.group.localeCompare(b.group, undefined, { sensitivity: 'base' }))

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Generate report error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
