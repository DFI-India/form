import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { IMPORT_SPECS, type ImportEntity } from '../../../../../lib/importSpecs'

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

const PAGE_SIZE = 50

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) throw new Error('Unauthorized')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, username')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') throw new Error('Forbidden')
  return { user, username: (profile as any).username as string }
}

function fail(err: any) {
  const message = err?.message || String(err)
  if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 })
  if (message === 'Forbidden') return NextResponse.json({ error: message }, { status: 403 })
  console.error('Import conflicts error:', err)
  return NextResponse.json({ error: message }, { status: 500 })
}

/** Missing table reads as "nothing staged" rather than an error the UI can't act on. */
const MISSING_TABLE = '42P01'

/**
 * The conflicts held back by a staged import.
 *
 * Also reports the pending count per entity and per batch so the review page
 * can show what's outstanding without pulling every row.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state') || 'pending'
    const entity = searchParams.get('entity') || ''
    const batchId = searchParams.get('batchId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))

    let query = supabaseAdmin
      .from('import_staging')
      .select('*', { count: 'exact' })
      .eq('state', state)
      .order('entity', { ascending: true })
      .order('eac_no', { ascending: true })
      .order('reg_no', { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (entity) query = query.eq('entity', entity)
    if (batchId) query = query.eq('batch_id', batchId)

    const { data, error, count } = await query

    if (error) {
      if (error.code === MISSING_TABLE) {
        return NextResponse.json({ success: true, rows: [], total: 0, pageSize: PAGE_SIZE, byEntity: {}, setupRequired: true })
      }
      throw error
    }

    // Counts for the filter chips — keys only, so this stays cheap.
    const { data: allPending } = await supabaseAdmin
      .from('import_staging')
      .select('entity, batch_id')
      .eq('state', 'pending')

    const byEntity: Record<string, number> = {}
    const byBatch: Record<string, number> = {}
    for (const row of allPending || []) {
      byEntity[(row as any).entity] = (byEntity[(row as any).entity] ?? 0) + 1
      byBatch[(row as any).batch_id] = (byBatch[(row as any).batch_id] ?? 0) + 1
    }

    return NextResponse.json({
      success: true,
      rows: data || [],
      total: count || 0,
      pageSize: PAGE_SIZE,
      byEntity,
      byBatch,
      setupRequired: false,
    })
  } catch (err) {
    return fail(err)
  }
}

interface ResolveBody {
  action: 'apply' | 'discard'
  /** Staged row ids to act on. */
  ids: string[]
  /**
   * Per-staged-row patch, applied only for `action: 'apply'`.
   *
   * When present it is authoritative: exactly these columns are written, which
   * is how a reviewer keeps the stored value for some fields and takes the
   * file's for others. Absent means "take the file for every differing field".
   */
  values?: Record<string, Record<string, unknown>>
}

/**
 * Resolve staged conflicts.
 *
 * `apply` writes the chosen values over the live row; `discard` keeps what's in
 * the database and closes the conflict. Either way the staged row stays in the
 * table with its new state, so what was decided is still legible afterwards.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, username } = await requireAdmin(request)
    const body = (await request.json()) as ResolveBody

    if (body.action !== 'apply' && body.action !== 'discard') {
      return NextResponse.json({ error: 'action must be "apply" or "discard"' }, { status: 400 })
    }
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'No conflicts selected' }, { status: 400 })
    }

    const { data: staged, error: loadError } = await supabaseAdmin
      .from('import_staging')
      .select('*')
      .in('id', body.ids)
      .eq('state', 'pending')

    if (loadError) throw loadError
    if (!staged || staged.length === 0) {
      return NextResponse.json({ error: 'Those conflicts are already resolved.' }, { status: 409 })
    }

    const now = new Date().toISOString()
    let applied = 0
    const failures: { id: string; eac_no: string; reg_no: string; message: string }[] = []

    if (body.action === 'apply') {
      for (const row of staged as any[]) {
        const spec = IMPORT_SPECS[row.entity as ImportEntity]
        if (!spec) {
          failures.push({ id: row.id, eac_no: row.eac_no, reg_no: row.reg_no, message: 'Unknown entity' })
          continue
        }

        // Only ever write columns this entity's spec maps, never whatever the
        // client happened to send — the payload reaches a live child record.
        const writable = new Set(
          spec.fields.map((f) => f.to).filter((c) => c !== 'eac_no' && c !== 'reg_no')
        )

        const overrides = body.values?.[row.id]
        const source = { ...(row.incoming || {}), ...(overrides ?? {}) }
        const chosen = overrides ? Object.keys(overrides) : (row.diff_fields || [])

        const patch: Record<string, unknown> = {}
        for (const column of chosen) {
          if (writable.has(column)) patch[column] = source[column] ?? null
        }

        if (Object.keys(patch).length === 0) {
          // Every field was left as the stored value, which is a decision in
          // itself — close the conflict without touching the record.
          const { error: closeError } = await supabaseAdmin
            .from('import_staging')
            .update({ state: 'discarded', resolved_at: now, resolved_by: user.id })
            .eq('id', row.id)
          if (closeError) {
            failures.push({ id: row.id, eac_no: row.eac_no, reg_no: row.reg_no, message: closeError.message })
          } else {
            applied += 1
          }
          continue
        }

        // eac_no is bigint on Child_Data and varchar on the child tables.
        const eacValue: any = spec.eacType === 'int' ? Number(row.eac_no) : String(row.eac_no)
        const regValue: any = spec.regType === 'int' ? Number(row.reg_no) : String(row.reg_no)

        const { error: updateError } = await supabaseAdmin
          .from(spec.table)
          .update(patch)
          .eq('eac_no', eacValue)
          .eq('reg_no', regValue)

        if (updateError) {
          failures.push({ id: row.id, eac_no: row.eac_no, reg_no: row.reg_no, message: updateError.message })
          continue
        }

        const { error: markError } = await supabaseAdmin
          .from('import_staging')
          .update({
            state: 'applied',
            resolved_at: now,
            resolved_by: user.id,
            // Record what was actually written, not just what the file said.
            incoming: source,
            diff_fields: Object.keys(patch),
          })
          .eq('id', row.id)

        if (markError) {
          failures.push({ id: row.id, eac_no: row.eac_no, reg_no: row.reg_no, message: markError.message })
          continue
        }
        applied += 1
      }
    } else {
      const { error: discardError } = await supabaseAdmin
        .from('import_staging')
        .update({ state: 'discarded', resolved_at: now, resolved_by: user.id })
        .in('id', staged.map((r: any) => r.id))

      if (discardError) throw discardError
      applied = staged.length
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'import',
      entity_type: 'import_staging',
      entity_id: `resolve:${body.action}`,
      changes: null,
      metadata: {
        resolved_by_username: username,
        action: body.action,
        count: applied,
        failed: failures.length,
      },
    })

    return NextResponse.json({
      success: true,
      action: body.action,
      resolved: applied,
      failures,
    })
  } catch (err) {
    return fail(err)
  }
}
