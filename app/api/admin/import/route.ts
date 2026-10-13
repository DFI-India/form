import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { IMPORT_SPECS, type ImportEntity } from '../../../../lib/importSpecs'
import { diffRow } from '../../../../lib/importDiff'

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

const VALID_STATUSES = ['Pending', 'Verified', 'Approved']
const BATCH_SIZE = 500

interface ImportBody {
  entity: ImportEntity
  rows: Record<string, any>[]
  dryRun?: boolean
  /**
   * skip   - drop colliding rows silently (the old behaviour)
   * abort  - refuse the whole import if anything collides
   * stage  - insert what's new, hold what collides *and differs* in
   *          import_staging for review
   */
  conflictStrategy?: 'skip' | 'abort' | 'stage'
  status?: string
  createMissingCentres?: boolean
  /** Shared by every chunk and file of one "Run import" click. */
  batchId?: string
}

/** Key used to detect an existing record: a child is identified by centre + registration number. */
const pairKey = (eac: unknown, reg: unknown) => `${String(eac)}::${String(reg)}`

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

    // Bulk import writes across every centre — admin only, deliberately not dfi_staff.
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - only admins can bulk import' }, { status: 403 })
    }

    const body = (await request.json()) as ImportBody
    const {
      entity,
      rows,
      dryRun = true,
      conflictStrategy = 'skip',
      status = 'Approved',
      createMissingCentres = false,
      batchId,
    } = body

    if (!entity || !IMPORT_SPECS[entity]) {
      return NextResponse.json({ error: 'Unknown import entity' }, { status: 400 })
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    }

    const spec = IMPORT_SPECS[entity]

    // --- Centre pre-check -------------------------------------------------
    // Child_Data.eac_no has a FK to centre_data(eac_no), so children can't be
    // loaded for a centre that doesn't exist yet.
    const eacNos = Array.from(new Set(rows.map((r) => Number(r.eac_no)).filter((n) => Number.isFinite(n))))

    const { data: existingCentres, error: centreError } = await supabaseAdmin
      .from('centre_data')
      .select('eac_no')
      .in('eac_no', eacNos)

    if (centreError) {
      return NextResponse.json({ error: `Centre lookup failed: ${centreError.message}` }, { status: 500 })
    }

    const knownCentres = new Set((existingCentres || []).map((c: any) => Number(c.eac_no)))
    const missingCentres = eacNos.filter((n) => !knownCentres.has(n))

    // --- Conflict detection ----------------------------------------------
    // Staging needs both sides of the comparison, so the whole row is pulled
    // when we're going to diff it. Otherwise the keys alone are enough.
    const staging = conflictStrategy === 'stage'
    const columns = staging ? '*' : 'eac_no, reg_no'

    const existingPairs = new Set<string>()
    const existingByKey = new Map<string, Record<string, any>>()

    for (let i = 0; i < eacNos.length; i += 50) {
      const slice = eacNos.slice(i, i + 50)
      const query = spec.eacType === 'int' ? slice : slice.map(String)

      // PostgREST caps a response at 1000 rows by default. A slice of 50
      // centres holds far more children than that, so page until a short
      // page comes back — otherwise conflicts past the cap read as "new"
      // and the insert fails on the unique constraint instead.
      const PAGE = 1000
      for (let from = 0; ; from += PAGE) {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from(spec.table)
          .select(columns)
          .in('eac_no', query as any)
          .range(from, from + PAGE - 1)

        if (existingError) {
          return NextResponse.json({ error: `Conflict check failed: ${existingError.message}` }, { status: 500 })
        }

        const page = (existing || []) as unknown as Record<string, any>[]
        for (const row of page) {
          const key = pairKey(row.eac_no, row.reg_no)
          existingPairs.add(key)
          if (staging) existingByKey.set(key, row)
        }

        if (page.length < PAGE) break
      }
    }

    const conflicting = rows.filter((r) => existingPairs.has(pairKey(r.eac_no, r.reg_no)))
    const insertable = rows.filter((r) => !existingPairs.has(pairKey(r.eac_no, r.reg_no)))

    // Split the collisions: a row that matches what's stored needs no decision.
    const changed: { row: Record<string, any>; existing: Record<string, any>; fields: string[] }[] = []
    let identical = 0

    if (staging) {
      for (const row of conflicting) {
        const existing = existingByKey.get(pairKey(row.eac_no, row.reg_no))
        if (!existing) continue
        const fields = diffRow(entity, row, existing).map((d) => d.field)
        if (fields.length === 0) identical += 1
        else changed.push({ row, existing, fields })
      }
    }

    const summary = {
      entity,
      table: spec.table,
      totalRows: rows.length,
      alreadyPresent: conflicting.length,
      toInsert: insertable.length,
      missingCentres,
      conflictSample: conflicting.slice(0, 10).map((r) => ({ eac_no: r.eac_no, reg_no: r.reg_no })),
      ...(staging ? { identical, conflicts: changed.length } : {}),
    }

    if (conflictStrategy === 'abort' && conflicting.length > 0) {
      return NextResponse.json(
        { error: `${conflicting.length} row(s) already exist and conflict strategy is "abort".`, summary },
        { status: 409 }
      )
    }

    if (entity === 'child_data' && missingCentres.length > 0 && !createMissingCentres) {
      return NextResponse.json(
        {
          error: `${missingCentres.length} centre(s) in this file don't exist yet: ${missingCentres.join(', ')}. ` +
            'Enable "create missing centres" or add them in Centre Management first.',
          summary,
        },
        { status: 409 }
      )
    }

    if (dryRun) {
      return NextResponse.json({ success: true, dryRun: true, summary })
    }

    // --- Create missing centres (child_data only, derived from the rows) ---
    let centresCreated = 0
    if (entity === 'child_data' && missingCentres.length > 0 && createMissingCentres) {
      /**
       * Pick the most common value across a centre's child rows.
       *
       * The Access columns behind district/taluk/panchayat/village are the
       * CHILD's location (Ch_District etc.), not the centre's, and they disagree
       * within a centre — sometimes only by casing, sometimes genuinely
       * (EAC 104 spans three districts). Taking the modal value is the least
       * arbitrary option; admins should still confirm these in Centre Management.
       */
      const modal = (values: unknown[]): string | null => {
        const counts = new Map<string, number>()
        for (const v of values) {
          if (v === null || v === undefined) continue
          const s = String(v).trim()
          if (!s) continue
          counts.set(s, (counts.get(s) ?? 0) + 1)
        }
        let best: string | null = null
        let bestCount = 0
        for (const [value, count] of Array.from(counts.entries())) {
          if (count > bestCount) {
            best = value
            bestCount = count
          }
        }
        return best
      }

      const centreRows = missingCentres.map((eac) => {
        const forCentre = rows.filter((r) => Number(r.eac_no) === eac)
        return {
          eac_no: eac,
          // centre_id and village_name are NOT NULL on centre_data. The Access
          // export carries Centre_Number (mapped to centre_id on the child row),
          // which is the same identifier — fall back to the EAC number itself.
          centre_id: modal(forCentre.map((r) => r.centre_id)) ?? String(eac),
          village_name: modal(forCentre.map((r) => r.village_name)) ?? modal(forCentre.map((r) => r.village)) ?? `EAC ${eac}`,
          district: modal(forCentre.map((r) => r.district)),
          taluk: modal(forCentre.map((r) => r.taluk)),
          panchayat: modal(forCentre.map((r) => r.panchayat)),
          village: modal(forCentre.map((r) => r.village)),
        }
      })

      const { error: createError } = await supabaseAdmin.from('centre_data').insert(centreRows)
      if (createError) {
        return NextResponse.json({ error: `Failed to create centres: ${createError.message}` }, { status: 500 })
      }
      centresCreated = centreRows.length
    }

    // --- Stage conflicts --------------------------------------------------
    // Written before the inserts: if the insert later fails, the held-back
    // rows are still on record rather than lost with the request.
    let staged = 0
    if (staging && changed.length > 0) {
      // The client sends one id per run; the fallback only covers a direct
      // API call, where each request stands as its own batch.
      const batch = batchId || globalThis.crypto?.randomUUID?.() || `batch-${Date.now()}`
      const stagedRows = changed.map((c) => ({
        batch_id: batch,
        entity,
        table_name: spec.table,
        eac_no: String(c.row.eac_no),
        reg_no: String(c.row.reg_no),
        incoming: c.row,
        existing: c.existing,
        diff_fields: c.fields,
        created_by: user.id,
      }))

      for (let i = 0; i < stagedRows.length; i += BATCH_SIZE) {
        const { error: stageError } = await supabaseAdmin
          .from('import_staging')
          // A file listed twice, or a retried chunk, must not stack duplicates
          // of the same conflict — the batch/entity/key unique index absorbs it.
          .upsert(stagedRows.slice(i, i + BATCH_SIZE), {
            onConflict: 'batch_id,entity,eac_no,reg_no',
          })

        if (stageError) {
          return NextResponse.json(
            {
              error:
                `Could not hold ${changed.length} conflicting row(s) for review: ${stageError.message}. ` +
                'If the import_staging table is missing, run sql/001_import_staging.sql in the Supabase SQL editor.',
              summary,
            },
            { status: 500 }
          )
        }
      }
      staged = stagedRows.length
    }

    // --- Insert -----------------------------------------------------------
    const stamped = insertable.map((r) => ({ ...r, status }))
    let inserted = 0

    for (let i = 0; i < stamped.length; i += BATCH_SIZE) {
      const batch = stamped.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await supabaseAdmin.from(spec.table).insert(batch)

      if (insertError) {
        // Report how far we got — earlier batches are already committed.
        return NextResponse.json(
          {
            error: `Insert failed after ${inserted} row(s): ${insertError.message}`,
            summary: { ...summary, inserted, centresCreated },
          },
          { status: 500 }
        )
      }
      inserted += batch.length
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'import',
      entity_type: entity,
      entity_id: `bulk:${spec.table}`,
      changes: null,
      metadata: {
        imported_by_username: profile.username,
        rows_inserted: inserted,
        rows_skipped_existing: conflicting.length,
        rows_staged_for_review: staged,
        batch_id: batchId ?? null,
        centres_created: centresCreated,
        status_applied: status,
        eac_nos: eacNos,
      },
    })

    return NextResponse.json({
      success: true,
      dryRun: false,
      summary: { ...summary, inserted, centresCreated, staged, statusApplied: status },
    })
  } catch (error: any) {
    console.error('Bulk import error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
