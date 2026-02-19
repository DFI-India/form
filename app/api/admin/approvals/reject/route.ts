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

    const isFieldStaff = profile.role === 'dfi_field_staff'

    const body = await request.json()
    const { entityType, entityId, reason } = body

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    const normalizedEntityType = String(entityType).trim().toLowerCase()
    const canonicalEntityType = normalizedEntityType === 'child_data' ? 'Child_Data' : normalizedEntityType

    // Determine which approval table to use based on entity type
    const childApprovalTypes = ['child_data', 'childfmly', 'childsibling', 'childuniform', 'childleaving']
    const vocationalApprovalTypes = ['vocational_course', 'computer_course']

    let approvalTableName: string
    let normalizedEntityId: string | number

    if (childApprovalTypes.includes(normalizedEntityType)) {
      approvalTableName = 'child_approvals'
      // child_approvals.entity_id is bigint
      normalizedEntityId = parseInt(String(entityId), 10)
      if (isNaN(normalizedEntityId)) {
        console.error(`[Reject] Invalid entity_id for ${normalizedEntityType}: ${entityId}`)
        return NextResponse.json({ error: `Invalid entity_id format: ${entityId}` }, { status: 400 })
      }
    } else if (vocationalApprovalTypes.includes(normalizedEntityType)) {
      approvalTableName = 'vocational_training_approvals'
      // vocational_training_approvals.entity_id is uuid - keep as string
      normalizedEntityId = String(entityId).trim()
    } else {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 })
    }

    console.log(`[Reject] Request: entityType=${entityType}, normalizedType=${normalizedEntityType}, canonicalType=${canonicalEntityType}, entityId=${entityId}, normalizedId=${normalizedEntityId} (type: ${typeof normalizedEntityId})`)

    // Check if record exists and is pending
    console.log(`[Reject] Checking approval record: ${approvalTableName} entity_type='${canonicalEntityType}', entity_id=${normalizedEntityId}`)
    const query = supabaseAdmin
      .from(approvalTableName)
      .select('*')
      .eq('entity_type', canonicalEntityType)
      .eq('status', 'Pending')

    // For debugging, get all pending records of this type
    const { data: allPending, error: allError } = await query
    console.log(`[Reject] All pending ${canonicalEntityType} records in ${approvalTableName}:`, allPending?.map((r: any) => ({ entity_id: r.entity_id, entity_id_type: typeof r.entity_id, status: r.status })) || [])

    const { data: pendingRecord, error: pendingError } = await supabaseAdmin
      .from(approvalTableName)
      .select('id')
      .eq('entity_type', canonicalEntityType)
      .eq('entity_id', normalizedEntityId)
      .eq('status', 'Pending')
      .single()

    if (pendingError || !pendingRecord) {
      console.error(`[Reject] Pending record not found for ${canonicalEntityType}/${normalizedEntityId}. Error:`, pendingError)
      return NextResponse.json({ error: `Pending record not found for ${canonicalEntityType}/${normalizedEntityId}` }, { status: 404 })
    }

    console.log(`[Reject] Found approval record:`, pendingRecord)

    // Update ONLY the approval table
    // dfi_field_staff uses verified_* columns (they are verifying), others use decided_* (they are deciding)
    const approvalUpdateFields = isFieldStaff
      ? {
        status: 'Rejected',
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        rejection_reason: reason.trim()
      }
      : {
        status: 'Rejected',
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        rejection_reason: reason.trim()
      }

    console.log(`[Reject] Updating ${approvalTableName} for ${canonicalEntityType}/${normalizedEntityId} with status=Rejected`)
    const { error: approvalUpdateError } = await supabaseAdmin
      .from(approvalTableName)
      .update(approvalUpdateFields)
      .eq('entity_type', canonicalEntityType)
      .eq('entity_id', normalizedEntityId)
      .eq('status', 'Pending')

    if (approvalUpdateError) {
      console.error(`[Reject] Approval table update error for ${approvalTableName}:`, approvalUpdateError)
      return NextResponse.json({ error: 'Failed to reject record' }, { status: 500 })
    }

    // Log the activity
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'reject',
        entity_type: canonicalEntityType,
        entity_id: String(entityId),
        metadata: {
          rejected_by_username: profile.username,
          rejected_by_role: profile.role,
          rejection_reason: reason.trim()
        }
      })

    console.log(`[Reject] Successfully rejected ${canonicalEntityType}/${normalizedEntityId}`)
    return NextResponse.json({
      success: true,
      message: 'Record rejected successfully',
      data: { entityType: canonicalEntityType, entityId, status: 'Rejected' }
    })
  } catch (error: any) {
    console.error('Reject error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
