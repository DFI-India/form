import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'dfi_staff', 'dfi_field_staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }

    // Map entity type to table name
    let tableName = entityType
    if (entityType === 'child_data') tableName = 'Child_Data'

    // Get the record with related data
    const { data: record, error } = await supabaseAdmin
      .from(tableName)
      .select(`
        *,
        submitter:profiles!submitted_by(id, username, role, email),
        approver:profiles!approved_by(id, username, role, email)
      `)
      .eq('record_id', entityId)
      .single()

    if (error) {
      console.error('Fetch error:', error)
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    // Get related data based on entity type
    let relatedData: any = {}

    if (entityType === 'child_data' && record.reg_no) {
      // Get family, sibling, uniform, leaving data for this child
      const [family, siblings, uniform, leaving] = await Promise.all([
        supabaseAdmin.from('childfmly').select('*').eq('reg_no', String(record.reg_no)).maybeSingle(),
        supabaseAdmin.from('childsibling').select('*').eq('reg_no', String(record.reg_no)).maybeSingle(),
        supabaseAdmin.from('childuniform').select('*').eq('reg_no', String(record.reg_no)).maybeSingle(),
        supabaseAdmin.from('childleaving').select('*').eq('reg_no', String(record.reg_no)).maybeSingle()
      ])

      relatedData = {
        family: family.data,
        siblings: siblings.data,
        uniform: uniform.data,
        leaving: leaving.data
      }
    }

    // Get activity history for this record
    const { data: history } = await supabaseAdmin
      .from('activity_logs')
      .select(`
        *,
        user:profiles!user_id(username, role)
      `)
      .eq('entity_type', entityType)
      .eq('entity_id', String(entityId))
      .order('created_at', { ascending: false })
      .limit(20)

    // Log view activity
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'view',
        entity_type: entityType,
        entity_id: String(entityId)
      })

    return NextResponse.json({
      success: true,
      data: record,
      relatedData,
      history: history || []
    })
  } catch (error: any) {
    console.error('Details error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
