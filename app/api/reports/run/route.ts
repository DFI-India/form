import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { REPORT_SOURCES, fieldMap, isReportSource } from '../../../../lib/reportFields'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Runs one report.
 *
 * Two shapes come out of here. A "list" is one row per child, with the chosen
 * columns. A "summary" groups by one or two fields and counts or totals, which
 * runs inside Postgres through report_group() — the REST API has aggregates
 * disabled, and pulling every row back to count it here is what the old
 * reports did.
 */

const MAX_ROWS = 20000

type Filter = { field: string; op: string; value?: unknown; value2?: unknown }

const missingSetup = (message: string) =>
  NextResponse.json(
    {
      error: 'The report views are not installed yet. Run sql/005_report_views.sql, then sql/006_report_functions.sql.',
      setupRequired: true,
      detail: message,
    },
    { status: 503 }
  )

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
      .select('role, centre_eac_no')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'dfi_staff', 'tech_support'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const source = body?.source
    if (!isReportSource(source)) {
      return NextResponse.json({ error: 'Unknown report source' }, { status: 400 })
    }

    const definition = REPORT_SOURCES[source]
    const known = fieldMap(source)
    const mode: 'list' | 'summary' = body?.mode === 'summary' ? 'summary' : 'list'

    const columns: string[] = Array.isArray(body?.columns) ? body.columns.filter((c: string) => known.has(c)) : []
    const groupBy: string[] = Array.isArray(body?.groupBy)
      ? body.groupBy.filter((c: string) => known.get(c)?.groupable).slice(0, 2)
      : []
    const filters: Filter[] = Array.isArray(body?.filters)
      ? body.filters.filter((x: Filter) => x && known.has(x.field))
      : []
    const sort = Array.isArray(body?.sort) ? body.sort : []
    const limit = Math.min(Math.max(Number(body?.limit) || 500, 1), MAX_ROWS)

    // A measure is only meaningful over a number; anything else is a count.
    const measures = (Array.isArray(body?.measures) ? body.measures : [])
      .filter((m: { fn: string; field?: string }) =>
        m && (m.fn === 'count' ? true : known.get(m.field ?? '')?.summable)
      )
      .slice(0, 6)

    if (mode === 'summary') {
      const payload = measures.length > 0 ? measures : [{ fn: 'count', alias: 'count' }]
      const { data, error } = await supabaseAdmin.rpc('report_group', {
        p_view: definition.view,
        p_dimensions: groupBy,
        p_measures: payload,
        p_filters: filters,
        p_order: sort,
        p_limit: limit,
      })

      if (error) {
        // 42883 = the function isn't there; 42P01 = the views aren't there.
        if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01') {
          return missingSetup(error.message)
        }
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      const rows = (data as Record<string, unknown>[]) ?? []
      const measureKeys = payload.map((m: { alias?: string; fn: string; field?: string }) =>
        m.alias ?? `${m.fn}_${m.field ?? ''}`
      )

      // Column totals, so the footer doesn't need a second round trip.
      const totals: Record<string, number> = {}
      for (const key of measureKeys) {
        if (rows.some((r) => typeof r[key] === 'number')) {
          totals[key] = rows.reduce((sum, r) => sum + (Number(r[key]) || 0), 0)
        }
      }

      return NextResponse.json({ mode, rows, columns: [...groupBy, ...measureKeys], totals, source })
    }

    // ------------------------------------------------------------- list ----
    const selected = columns.length > 0 ? columns : definition.fields.filter((x) => x.defaultColumn).map((x) => x.key)

    let query = supabaseAdmin
      .from(definition.view)
      .select(selected.join(', '), { count: 'exact' })
      .limit(limit)

    for (const filter of filters) {
      const value = filter.value === undefined || filter.value === null ? '' : String(filter.value)
      switch (filter.op) {
        case 'eq': query = query.eq(filter.field, value); break
        case 'neq': query = query.neq(filter.field, value); break
        case 'gt': query = query.gt(filter.field, value); break
        case 'gte': query = query.gte(filter.field, value); break
        case 'lt': query = query.lt(filter.field, value); break
        case 'lte': query = query.lte(filter.field, value); break
        case 'contains': query = query.ilike(filter.field, `%${value}%`); break
        case 'between':
          query = query.gte(filter.field, value).lte(filter.field, String(filter.value2 ?? ''))
          break
        case 'is_null': query = query.is(filter.field, null); break
        case 'not_null': query = query.not(filter.field, 'is', null); break
        default: break
      }
    }

    for (const s of sort.slice(0, 3)) {
      if (known.has(s?.field)) {
        query = query.order(s.field, { ascending: s.dir !== 'desc', nullsFirst: false })
      }
    }

    const { data, error, count } = await query

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return missingSetup(error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      mode,
      rows: data ?? [],
      columns: selected,
      total: count ?? (data?.length ?? 0),
      truncated: (count ?? 0) > limit,
      source,
    })
  } catch (error: any) {
    console.error('Report run error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
