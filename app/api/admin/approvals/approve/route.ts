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
      return NextResponse.json({ error: 'Forbidden - Only admin, DFI staff, and DFI field staff can approve' }, { status: 403 })
    }

    const isFieldStaff = profile.role === 'dfi_field_staff'
    const targetStatus = isFieldStaff ? 'Verified' : 'Approved'
    const actionType = isFieldStaff ? 'verify' : 'approve'

    const body = await request.json()
    const { entityType, entityId } = body

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }

    // Map entity type to table name
    const tableNameMap: Record<string, string> = {
      'child_data': 'Child_Data',
      'childfmly': 'childfmly',
      'childsibling': 'childsibling',
      'childuniform': 'childuniform',
      'childleaving': 'childleaving',
      'vocational_course': 'vocational_course',
      'computer_course': 'computer_course',
    }
    const tableName = tableNameMap[entityType] || entityType

    // Determine the ID column to use based on entity type
    const isVocationalOrComputer = ['vocational_course', 'computer_course'].includes(entityType)
    const idColumn = isVocationalOrComputer ? 'id' : 'record_id'

    const { data: pendingRecord, error: pendingError } = await supabaseAdmin
      .from(tableName)
      .select(idColumn)
      .eq(idColumn, entityId)
      .eq('status', 'Pending')
      .single()

    if (pendingError || !pendingRecord) {
      return NextResponse.json({ error: 'Pending record not found' }, { status: 404 })
    }

    // Update the entity record
    // dfi_field_staff uses verified_* columns (they are verifying), others use decided_* (they are deciding)
    const entityUpdateFields = isFieldStaff
      ? {
        status: targetStatus,
        verified_by: user.id,
        verified_at: new Date().toISOString()
      }
      : {
        status: targetStatus,
        decided_by: user.id,
        decided_at: new Date().toISOString()
      }
    console.log(`[Approve] Updating ${tableName} ${idColumn}=${entityId} with fields:`, entityUpdateFields)
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from(tableName)
      .update(entityUpdateFields)
      .eq(idColumn, entityId)
      .eq('status', 'Pending')

    if (updateError) {
      console.error(`[Approve] Update error for ${tableName}:`, updateError)
      return NextResponse.json({ error: 'Failed to approve record' }, { status: 500 })
    }

    // Determine which approval table to update based on entity type
    const approvalTableName = isVocationalOrComputer ? 'vocational_training_approvals' : 'child_approvals'

    // Update the appropriate approval table
    // dfi_field_staff uses verified_* columns (they are verifying), others use decided_* (they are deciding)
    const approvalUpdateFields = isFieldStaff
      ? {
        status: targetStatus,
        verified_by: user.id,
        verified_at: new Date().toISOString()
      }
      : {
        status: targetStatus,
        decided_by: user.id,
        decided_at: new Date().toISOString()
      }
    const { error: approvalUpdateError } = await supabaseAdmin
      .from(approvalTableName)
      .update(approvalUpdateFields)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('status', 'Pending')

    if (approvalUpdateError) {
      console.error('Approval table update error:', approvalUpdateError)
      return NextResponse.json({ error: 'Failed to approve record' }, { status: 500 })
    }

    // Log the activity
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: actionType,
        entity_type: entityType,
        entity_id: String(entityId),
        metadata: {
          verified_by_username: profile.username,
          verified_by_role: profile.role
        }
      })

    return NextResponse.json({
      success: true,
      message: isFieldStaff ? 'Record verified successfully' : 'Record approved successfully',
      data: { entityId, status: targetStatus }
    })
  } catch (error: any) {
    console.error('Approve error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
