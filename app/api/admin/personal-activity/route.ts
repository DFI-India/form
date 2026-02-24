import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type EntityType = 'child_data' | 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving' | 'vocational_course' | 'computer_course'
type DateField = 'approved_at' | 'verified_at' | 'all'

interface EntityConfig {
    key: EntityType
    tableName: string
    approvalTable: 'child_approvals' | 'vocational_training_approvals'
    approvalEntityType: string
}

const ENTITY_CONFIGS: EntityConfig[] = [
    { key: 'child_data', tableName: 'Child_Data', approvalTable: 'child_approvals', approvalEntityType: 'Child_Data' },
    { key: 'childfmly', tableName: 'childfmly', approvalTable: 'child_approvals', approvalEntityType: 'childfmly' },
    { key: 'childsibling', tableName: 'childsibling', approvalTable: 'child_approvals', approvalEntityType: 'childsibling' },
    { key: 'childuniform', tableName: 'childuniform', approvalTable: 'child_approvals', approvalEntityType: 'childuniform' },
    { key: 'childleaving', tableName: 'childleaving', approvalTable: 'child_approvals', approvalEntityType: 'childleaving' },
    { key: 'vocational_course', tableName: 'vocational_course', approvalTable: 'vocational_training_approvals', approvalEntityType: 'vocational_course' },
    { key: 'computer_course', tableName: 'computer_course', approvalTable: 'vocational_training_approvals', approvalEntityType: 'computer_course' }
]

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

function matchesDateFilter(row: any, dateField: DateField, fromDate: string, toDate: string) {
    if (!fromDate && !toDate) return true

    const approvedAt = row.approved_at ? new Date(row.approved_at) : null
    const verifiedAt = row.verified_at ? new Date(row.verified_at) : null
    const from = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null
    const to = toDate ? new Date(`${toDate}T23:59:59.999Z`) : null

    const inRange = (date: Date | null) => {
        if (!date) return false
        if (from && date < from) return false
        if (to && date > to) return false
        return true
    }

    if (dateField === 'approved_at') return inRange(approvedAt)
    if (dateField === 'verified_at') return inRange(verifiedAt)
    return inRange(approvedAt) || inRange(verifiedAt)
}

async function fetchBaseRecords(tableName: string, entityIds: Array<string | number>) {
    if (entityIds.length === 0) return [] as any[]

    const { data: byRecordId, error: recordIdError } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .in('record_id', entityIds as any[])

    if (!recordIdError) return byRecordId || []

    const { data: byId, error: idError } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .in('id', entityIds as any[])

    if (idError) {
        console.error(`Failed fetching base records for ${tableName}`, { recordIdError, idError })
        return []
    }

    return byId || []
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const {
            data: { user },
            error: authError
        } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || !['admin', 'dfi_staff', 'dfi_field_staff'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const dateField = (searchParams.get('dateField') || 'all') as DateField
        const fromDate = searchParams.get('fromDate') || ''
        const toDate = searchParams.get('toDate') || ''

        const data: Record<string, any[]> = {}
        const counts: Record<string, { total: number; approved: number; rejected: number }> = {}

        for (const config of ENTITY_CONFIGS) {
            const { data: approvalRows, error: approvalError } = await supabaseAdmin
                .from(config.approvalTable)
                .select('entity_id, status, approved_by, verified_by, approved_at, verified_at, decided_by, decided_at')
                .eq('entity_type', config.approvalEntityType)
                .in('status', ['Approved', 'Rejected'])

            if (approvalError) {
                console.error(`Failed fetching approvals for ${config.key}`, approvalError)
                data[config.key] = []
                counts[config.key] = { total: 0, approved: 0, rejected: 0 }
                continue
            }

            const filteredApprovals = (approvalRows || []).filter((row: any) => {
                const actedByUser = row.approved_by === user.id || row.verified_by === user.id || row.decided_by === user.id
                return actedByUser && matchesDateFilter(row, dateField, fromDate, toDate)
            })

            if (filteredApprovals.length === 0) {
                data[config.key] = []
                counts[config.key] = { total: 0, approved: 0, rejected: 0 }
                continue
            }

            const entityIds = filteredApprovals
                .map((row: any) => row.entity_id)
                .filter((value: any) => value !== null && value !== undefined)

            const baseRows = await fetchBaseRecords(config.tableName, entityIds)
            const rowsByEntityId = new Map<string, any>()

            for (const row of baseRows) {
                if (row.record_id !== undefined && row.record_id !== null) {
                    rowsByEntityId.set(String(row.record_id), row)
                }
                if (row.id !== undefined && row.id !== null) {
                    rowsByEntityId.set(String(row.id), row)
                }
            }

            const mergedRows = filteredApprovals.map((approval: any) => {
                const entityId = String(approval.entity_id)
                const baseRow = rowsByEntityId.get(entityId) || { record_id: approval.entity_id }

                return {
                    ...baseRow,
                    approved_at: approval.approved_at || null,
                    verified_at: approval.verified_at || approval.decided_at || null,
                    _decision_status: approval.status,
                    _entity_id: approval.entity_id
                }
            })

            mergedRows.sort((a, b) => {
                const firstTime = new Date(a.approved_at || a.verified_at || 0).getTime()
                const secondTime = new Date(b.approved_at || b.verified_at || 0).getTime()
                return secondTime - firstTime
            })

            const approvedCount = filteredApprovals.filter((r: any) => r.status === 'Approved').length
            const rejectedCount = filteredApprovals.filter((r: any) => r.status === 'Rejected').length

            data[config.key] = mergedRows
            counts[config.key] = {
                total: mergedRows.length,
                approved: approvedCount,
                rejected: rejectedCount
            }
        }

        return NextResponse.json({
            success: true,
            data,
            counts
        })
    } catch (error: any) {
        console.error('Personal activity error:', error)
        return NextResponse.json({ error: error.message || 'Failed to load personal activity' }, { status: 500 })
    }
}
