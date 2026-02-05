import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    const { entityType, entityId, updates } = body

    if (!entityType || !entityId || !updates) {
      return NextResponse.json({ error: 'entityType, entityId, and updates are required' }, { status: 400 })
    }

    // Map entity type to table name
    let tableName = entityType
    if (entityType === 'child_data') tableName = 'Child_Data'

    // Get current record for change tracking
    const { data: currentRecord, error: fetchError } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('record_id', entityId)
      .single()

    if (fetchError || !currentRecord) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    // Calculate changes
    const changes: Record<string, { old: any; new: any }> = {}
    for (const [key, newValue] of Object.entries(updates)) {
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
      .eq('record_id', entityId)
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
        entity_id: String(entityId),
        changes,
        metadata: {
          edited_by_username: profile.username,
          edited_by_role: profile.role,
          fields_changed: Object.keys(changes)
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
