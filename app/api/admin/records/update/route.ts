import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PRIMARY_KEYS, isRecordEntity, sanitiseUpdates, tableFor } from '../../../../../lib/recordTables'

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

export async function PUT(request: NextRequest) {
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

    // Check if user has edit access
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, username')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'dfi_staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Only admin and DFI staff can edit records' }, { status: 403 })
    }

    const body = await request.json()
    const { entityType, entityId, entityKey, updates } = body

    if (!entityType || entityId === null || entityId === undefined || !updates) {
      return NextResponse.json({ error: 'entityType, entityId, and updates are required' }, { status: 400 })
    }

    // The table comes from the request and this runs with the service key, so
    // it has to be one we named. Without this, 'profiles' would be a valid
    // target and a role change one field away.
    if (!isRecordEntity(entityType)) {
      return NextResponse.json({ error: 'Unknown record type' }, { status: 400 })
    }
    const tableName = tableFor(entityType)

    // Approval state and ownership are moved by the approval endpoints, which
    // enforce who may do it. An edit must not be able to set them.
    const { clean: safeUpdates, rejected } = sanitiseUpdates(updates)
    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json(
        { error: rejected.length ? `These fields cannot be edited here: ${rejected.join(', ')}` : 'Nothing to update' },
        { status: 400 }
      )
    }

    const candidates = [
      ...(entityKey && PRIMARY_KEYS[entityType].includes(String(entityKey)) ? [String(entityKey)] : []),
      ...PRIMARY_KEYS[entityType]
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

    // Get current record for change tracking
    if (!currentRecord || !resolvedPrimaryKey) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    // Calculate changes
    const changes: Record<string, { old: any; new: any }> = {}
    for (const [key, newValue] of Object.entries(safeUpdates)) {
      if (currentRecord[key] !== newValue) {
        changes[key] = {
          old: currentRecord[key],
          new: newValue
        }
      }
    }

    // Don't update if no changes
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected',
        data: currentRecord
      })
    }

    // Update the record
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from(tableName)
      .update(updates)
      .eq(resolvedPrimaryKey, entityId)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
    }

    // Log the activity with changes
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'edit',
        entity_type: entityType,
        entity_id: String(currentRecord[resolvedPrimaryKey] ?? entityId),
        changes,
        metadata: {
          edited_by_username: profile.username,
          edited_by_role: profile.role,
          fields_changed: Object.keys(changes),
          primary_key: resolvedPrimaryKey,
          rejected_fields: rejected.length ? rejected : undefined
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Record updated successfully',
      data: updatedRecord,
      changes
    })
  } catch (error: any) {
    console.error('Update record error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
