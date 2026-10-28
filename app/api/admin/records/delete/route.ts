import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PRIMARY_KEYS, isRecordEntity, tableFor } from '../../../../../lib/recordTables'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
)

export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const {
            data: { user },
            error: authError,
        } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, username')
            .eq('id', user.id)
            .single()

        if (!profile || !['admin', 'dfi_staff'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden - Only admin and DFI staff can delete records' }, { status: 403 })
        }

        const body = await request.json()
        const { entityType, entityId, entityKey } = body

        if (!entityType || entityId === null || entityId === undefined) {
            return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
        }

        // Same reasoning as the update route: the table must be one we named,
        // because this runs with the service key and ignores row-level security.
        if (!isRecordEntity(entityType)) {
            return NextResponse.json({ error: 'Unknown record type' }, { status: 400 })
        }
        const tableName = tableFor(entityType)
        const primaryKeyCandidatesByEntity = PRIMARY_KEYS

        const candidates = [
            ...(entityKey && primaryKeyCandidatesByEntity[entityType].includes(String(entityKey))
              ? [String(entityKey)]
              : []),
            ...primaryKeyCandidatesByEntity[entityType],
        ]
        const uniqueCandidates = Array.from(new Set(candidates))

        let currentRecord: any = null
        let resolvedPrimaryKey: string | null = null

        for (const key of uniqueCandidates) {
            const { data, error } = await supabaseAdmin
                .from(tableName)
                .select('*')
                .eq(key, entityId)
                .maybeSingle()

            if (!error && data) {
                currentRecord = data
                resolvedPrimaryKey = key
                break
            }
        }

        if (!currentRecord || !resolvedPrimaryKey) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 })
        }

        const { error: deleteError } = await supabaseAdmin
            .from(tableName)
            .delete()
            .eq(resolvedPrimaryKey, entityId)

        if (deleteError) {
            console.error('Delete error:', deleteError)
            return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
        }

        await supabaseAdmin.from('activity_logs').insert({
            user_id: user.id,
            action_type: 'delete',
            entity_type: entityType,
            entity_id: String(currentRecord[resolvedPrimaryKey] ?? entityId),
            metadata: {
                deleted_by_username: profile.username,
                deleted_by_role: profile.role,
                primary_key: resolvedPrimaryKey,
            },
        })

        return NextResponse.json({
            success: true,
            message: 'Record deleted successfully',
        })
    } catch (error: any) {
        console.error('Delete record error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
