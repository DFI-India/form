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
    const sourceStatus = isFieldStaff ? 'Pending' : 'Verified'
    const targetStatus = isFieldStaff ? 'Verified' : 'Approved'

    const body = await request.json()
    const { entityType, entityId } = body

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
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
        console.error(`[Approve] Invalid entity_id for ${normalizedEntityType}: ${entityId}`)
        return NextResponse.json({ error: `Invalid entity_id format: ${entityId}` }, { status: 400 })
      }
    } else if (vocationalApprovalTypes.includes(normalizedEntityType)) {
      approvalTableName = 'vocational_training_approvals'
      // vocational_training_approvals.entity_id is uuid - keep as string
      normalizedEntityId = String(entityId).trim()
    } else {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 })
    }

    console.log(`[Approve] Request: entityType=${entityType}, normalizedType=${normalizedEntityType}, canonicalType=${canonicalEntityType}, entityId=${entityId}, normalizedId=${normalizedEntityId} (type: ${typeof normalizedEntityId})`)

    // Check if record exists and is in the expected source status
    console.log(`[Approve] Checking approval record: ${approvalTableName} entity_type='${canonicalEntityType}', entity_id=${normalizedEntityId}, status='${sourceStatus}'`)
    const query = supabaseAdmin
      .from(approvalTableName)
      .select('*')
      .eq('entity_type', canonicalEntityType)
      .eq('status', sourceStatus)

    // For debugging, get all matching records of this type/status
    const { data: allSourceStatusRecords } = await query
    console.log(`[Approve] All ${sourceStatus} ${canonicalEntityType} records in ${approvalTableName}:`, allSourceStatusRecords?.map((r: any) => ({ entity_id: r.entity_id, entity_id_type: typeof r.entity_id, status: r.status })) || [])

    const { data: sourceRecord, error: sourceError } = await supabaseAdmin
      .from(approvalTableName)
      .select('id')
      .eq('entity_type', canonicalEntityType)
      .eq('entity_id', normalizedEntityId)
      .eq('status', sourceStatus)
      .single()

    if (sourceError || !sourceRecord) {
      console.error(`[Approve] ${sourceStatus} record not found for ${canonicalEntityType}/${normalizedEntityId}. Error:`, sourceError)
      return NextResponse.json({ error: `${sourceStatus} record not found for ${canonicalEntityType}/${normalizedEntityId}` }, { status: 404 })
    }

    console.log(`[Approve] Found approval record:`, sourceRecord)

    // Update ONLY the approval table
    const approvalUpdateFields = approvalTableName === 'vocational_training_approvals'
      ? {
        status: targetStatus,
        ...(targetStatus === 'Approved'
          ? {
            approved_by: user.id,
            approved_at: new Date().toISOString()
          }
          : {
            verified_by: user.id,
            verified_at: new Date().toISOString()
          })
      }
      : (isFieldStaff
        ? {
          status: targetStatus,
          verified_by: user.id,
          verified_at: new Date().toISOString()
        }
        : {
          status: targetStatus,
          decided_by: user.id,
          decided_at: new Date().toISOString()
        })

    console.log(`[Approve] Updating ${approvalTableName} for ${canonicalEntityType}/${normalizedEntityId} with status=${targetStatus}`)
    const { error: approvalUpdateError } = await supabaseAdmin
      .from(approvalTableName)
      .update(approvalUpdateFields)
      .eq('entity_type', canonicalEntityType)
      .eq('entity_id', normalizedEntityId)
      .eq('status', sourceStatus)

    if (approvalUpdateError) {
      console.error(`[Approve] Approval table update error for ${approvalTableName}:`, approvalUpdateError)
      return NextResponse.json({ error: 'Failed to approve record' }, { status: 500 })
    }

    // Log the activity
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'approve',
        entity_type: canonicalEntityType,
        entity_id: String(entityId),
        metadata: {
          verified_by_username: profile.username,
          verified_by_role: profile.role
        }
      })

    console.log(`[Approve] Successfully approved ${canonicalEntityType}/${normalizedEntityId}`)
    return NextResponse.json({
      success: true,
      message: isFieldStaff ? 'Record verified successfully' : 'Record approved successfully',
      data: { entityType: canonicalEntityType, entityId, status: targetStatus }
    })
  } catch (error: any) {
    console.error('Approve error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
