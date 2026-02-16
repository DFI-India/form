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

export async function POST(request: NextRequest) {
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

    // Check if user is admin, dfi_staff, or dfi_field_staff
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, username')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'dfi_staff', 'dfi_field_staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Only admin, DFI staff, and DFI field staff can reject' }, { status: 403 })
    }

    const body = await request.json()
    const { entityType, entityId, reason } = body

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    // Map entity type to table name
    let tableName = entityType
    if (entityType === 'child_data') tableName = 'Child_Data'

    // Determine the ID column to use based on entity type
    const isVocationalOrComputer = ['vocational_course', 'computer_course'].includes(entityType)
    const idColumn = isVocationalOrComputer ? 'id' : 'record_id'

    // Update the entity record
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from(tableName)
      .update({
        status: 'Rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq(idColumn, entityId)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to reject record' }, { status: 500 })
    }

    // Determine which approval table to update based on entity type
    const approvalTableName = isVocationalOrComputer ? 'vocational_training_approvals' : 'child_approvals'

    // Update the appropriate approval table
    await supabaseAdmin
      .from(approvalTableName)
      .update({
        status: 'Rejected',
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        rejection_reason: reason.trim()
      })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)

    // Log the activity
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'reject',
        entity_type: entityType,
        entity_id: String(entityId),
        metadata: {
          rejected_by_username: profile.username,
          rejected_by_role: profile.role,
          rejection_reason: reason.trim()
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Record rejected successfully',
      data: updatedRecord
    })
  } catch (error: any) {
    console.error('Reject error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
