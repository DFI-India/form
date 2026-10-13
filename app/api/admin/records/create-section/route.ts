import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { SECTION_SCHEMA, coerceSectionValues, isChildSectionKey } from '../../../../../lib/childSections'

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

/**
 * Add a family / siblings / uniform / leaving section to an existing child.
 *
 * The volunteer form is the only other way these rows get created, and it
 * sends them into the approval queue. An admin or DFI staff member *is* the
 * final approver, so rows created here are written as Approved, stamped with
 * who did it, with a matching child_approvals row so the approval history has
 * no gaps. Refuses when the child already has that section: a second row is how
 * the existing duplicates happened, and editing the first is the right move.
 */
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
      .select('role, username')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'dfi_staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Only admin and DFI staff can add records' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const section = body?.section
    const eacNo = Number(body?.eacNo)
    const regNo = Number(body?.regNo)
    const values = body?.values
    const markLeft = body?.markLeft === true

    if (!isChildSectionKey(section)) {
      return NextResponse.json({ error: 'Unknown section' }, { status: 400 })
    }
    if (!Number.isFinite(eacNo) || !Number.isFinite(regNo)) {
      return NextResponse.json({ error: 'eacNo and regNo must be numeric' }, { status: 400 })
    }
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return NextResponse.json({ error: 'values must be an object' }, { status: 400 })
    }

    const coerced = coerceSectionValues(section, values)
    if ('error' in coerced) {
      return NextResponse.json({ error: coerced.error }, { status: 400 })
    }
    if (Object.values(coerced.value).every((v) => v === null)) {
      return NextResponse.json({ error: 'Fill in at least one field before saving.' }, { status: 400 })
    }

    const schema = SECTION_SCHEMA[section]

    // Child_Data keys are bigint; the section tables store both as varchar.
    const { data: child, error: childError } = await supabaseAdmin
      .from('Child_Data')
      .select('record_id, village_name, child_left')
      .eq('eac_no', eacNo)
      .eq('reg_no', regNo)
      .maybeSingle()

    if (childError) throw childError
    if (!child) {
      return NextResponse.json({ error: 'No child found for that EAC No / Reg No' }, { status: 404 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from(section)
      .select('record_id')
      .eq('eac_no', String(eacNo))
      .eq('reg_no', String(regNo))
      .limit(1)

    if (existingError) throw existingError
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `This child already has ${schema.noun}. Close and reopen the editor to change them.` },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const row: Record<string, unknown> = {
      ...coerced.value,
      eac_no: String(eacNo),
      reg_no: String(regNo),
      status: 'Approved',
      submitted_by: user.id,
      approved_by: user.id,
      approved_at: now,
    }
    if (schema.hasVillageName) row.village_name = child.village_name ?? null

    const { data: created, error: insertError } = await supabaseAdmin
      .from(section)
      .insert([row])
      .select()
      .single()

    if (insertError || !created) {
      console.error(`create-section: insert into ${section} failed`, insertError)
      return NextResponse.json({ error: insertError?.message || 'Could not save' }, { status: 500 })
    }

    // Keep one approval row per section row. Update rather than insert in case
    // a trigger already made one.
    const approvalFields = {
      status: 'Approved',
      decided_by: user.id,
      decided_at: now,
    }
    const { data: approvalRows, error: approvalLookupError } = await supabaseAdmin
      .from('child_approvals')
      .select('id')
      .eq('entity_type', section)
      .eq('entity_id', created.record_id)

    const approvalWrite =
      !approvalLookupError && approvalRows && approvalRows.length > 0
        ? await supabaseAdmin
            .from('child_approvals')
            .update(approvalFields)
            .eq('entity_type', section)
            .eq('entity_id', created.record_id)
        : await supabaseAdmin.from('child_approvals').insert([
            {
              entity_type: section,
              entity_id: created.record_id,
              submitted_by: user.id,
              ...approvalFields,
            },
          ])

    if (approvalLookupError || approvalWrite.error) {
      // A section with no approval row would be invisible to the approval
      // screens, so undo the insert rather than leave it half-recorded.
      console.error('create-section: approval row failed, rolling back', approvalLookupError || approvalWrite.error)
      await supabaseAdmin.from(section).delete().eq('record_id', created.record_id)
      return NextResponse.json({ error: 'Could not record the approval, so nothing was saved.' }, { status: 500 })
    }

    let childLeftUpdated = false
    if (section === 'childleaving' && markLeft && child.child_left !== true) {
      const { error: leftError } = await supabaseAdmin
        .from('Child_Data')
        .update({ child_left: true })
        .eq('record_id', child.record_id)
      if (leftError) {
        console.error('create-section: could not mark child as left', leftError)
      } else {
        childLeftUpdated = true
      }
    }

    const changes: Record<string, { old: unknown; new: unknown }> = Object.fromEntries(
      Object.entries(coerced.value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, { old: null, new: v }])
    )
    if (childLeftUpdated) changes.child_left = { old: child.child_left ?? null, new: true }

    const { error: logError } = await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'create',
      entity_type: section,
      entity_id: String(created.record_id),
      changes,
      metadata: {
        created_by_username: profile.username,
        created_by_role: profile.role,
        eac_no: eacNo,
        reg_no: regNo,
        auto_approved: true,
        marked_child_left: childLeftUpdated,
      },
    })
    if (logError) console.error('create-section: activity log failed', logError)

    return NextResponse.json({ success: true, data: created, childLeftUpdated })
  } catch (error: any) {
    console.error('Create section error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
