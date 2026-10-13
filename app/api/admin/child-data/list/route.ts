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

/**
 * List endpoint for the Child data screen.
 *
 * Kept separate from `records/list` (which serves seven entity types and two
 * other pages) so this view's filters can be designed for children specifically
 * without risking those callers.
 */

const SECTION_TABLES = [
  { key: 'childfmly', table: 'childfmly' },
  { key: 'childsibling', table: 'childsibling' },
  { key: 'childuniform', table: 'childuniform' },
  { key: 'childleaving', table: 'childleaving' },
] as const

type SectionKey = (typeof SECTION_TABLES)[number]['key']

/** Filters/sorts that need every matching row in memory rather than a DB page. */
const MISSING_VALUES = ['family', 'siblings', 'uniform', 'dob', 'any'] as const
type MissingFilter = (typeof MISSING_VALUES)[number]

const MISSING_TO_SECTION: Record<string, SectionKey> = {
  family: 'childfmly',
  siblings: 'childsibling',
  uniform: 'childuniform',
}

/** Guard for the in-memory path so a runaway table can't exhaust the request. */
const FULL_SCAN_CAP = 5000

const pairKey = (eac: unknown, reg: unknown) => `${String(eac)}::${String(reg)}`

const LIST_COLUMNS =
  'record_id, eac_no, reg_no, first_name, last_name, gender, dateofbirth, class_std_text, ' +
  'village, village_name, district, taluk, photo_link, status, child_left, created_at'

/**
 * Approval states the Child data screen can filter by.
 *
 * `unapproved` and `approved_pending` are screen-level ideas rather than column
 * values: the first is "anything still in the queue", the second is "signed off
 * but the linked sections were never filled in", which needs the completeness
 * lookup and therefore the in-memory path.
 */
const APPROVAL_STATUSES = ['Pending', 'Verified', 'Approved', 'Rejected']

/** Leaving is only expected for children who left, so it doesn't count here. */
const REQUIRED_SECTIONS: SectionKey[] = ['childfmly', 'childsibling', 'childuniform']

const isComplete = (c?: Record<SectionKey, boolean>) =>
  Boolean(c) && REQUIRED_SECTIONS.every((k) => c![k])

/** Order for the "Needs attention first" sort, worst first. */
function reviewRank(row: any, c?: Record<SectionKey, boolean>): number {
  const status = row.status || 'Pending'
  if (status === 'Rejected') return 0
  if (status === 'Verified') return 1
  if (status !== 'Approved') return 2
  return isComplete(c) ? 4 : 3
}

/** Which of the four linked sections each of these children already has. */
async function loadCompleteness(
  keys: { eac_no: unknown; reg_no: unknown }[]
): Promise<Record<string, Record<SectionKey, boolean>>> {
  const out: Record<string, Record<SectionKey, boolean>> = {}
  for (const k of keys) {
    out[pairKey(k.eac_no, k.reg_no)] = {
      childfmly: false,
      childsibling: false,
      childuniform: false,
      childleaving: false,
    }
  }

  const eacNos = Array.from(
    new Set(keys.map((k) => Number(k.eac_no)).filter((n) => Number.isFinite(n)))
  ).map(String)

  if (eacNos.length === 0) return out

  await Promise.all(
    SECTION_TABLES.map(async ({ key, table }) => {
      // These tables all store eac_no as varchar, unlike Child_Data.
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('eac_no, reg_no')
        .in('eac_no', eacNos)

      if (error) {
        console.error(`child-data/list: ${table} lookup failed`, error)
        return
      }
      for (const row of data || []) {
        const entry = out[pairKey(row.eac_no, row.reg_no)]
        if (entry) entry[key] = true
      }
    })
  )

  return out
}

export async function GET(request: NextRequest) {
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'dfi_staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const eacNo = (searchParams.get('eacNo') || '').trim()
    // Two different places: `village_name` is the centre's village, `village`
    // is where the child actually lives. They were previously the same filter.
    const village = (searchParams.get('village') || '').trim()
    const childVillage = (searchParams.get('childVillage') || '').trim()
    const enrollment = searchParams.get('enrollment') || 'all'
    // `approval` supersedes `status`; `status` is kept for older links.
    const approval = searchParams.get('approval') || searchParams.get('status') || 'all'
    const gender = searchParams.get('gender') || 'all'
    const classStd = (searchParams.get('classStd') || '').trim()
    const missingParam = searchParams.get('missing') || 'none'
    const sort = searchParams.get('sort') || 'register'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const includeFacets = searchParams.get('includeFacets') === '1'

    const missing: MissingFilter | null = MISSING_VALUES.includes(missingParam as MissingFilter)
      ? (missingParam as MissingFilter)
      : null

    /** Applies every filter that Postgres can evaluate directly. */
    const applyFilters = (q: any) => {
      let query = q
      if (eacNo) query = query.eq('eac_no', Number(eacNo))
      if (village) query = query.eq('village_name', village)
      if (childVillage) query = query.eq('village', childVillage)
      if (gender !== 'all') query = query.eq('gender', gender)
      if (classStd) query = query.eq('class_std_text', classStd)
      if (approval === 'Pending') query = query.or('status.is.null,status.eq.Pending')
      else if (approval === 'unapproved') query = query.or('status.is.null,status.neq.Approved')
      else if (approval === 'approved_pending') query = query.eq('status', 'Approved')
      else if (APPROVAL_STATUSES.includes(approval)) query = query.eq('status', approval)
      if (enrollment === 'left') query = query.eq('child_left', true)
      if (enrollment === 'enrolled') query = query.or('child_left.is.null,child_left.eq.false')
      if (missing === 'dob') query = query.is('dateofbirth', null)

      if (search) {
        const digits = /^\d+$/.test(search)
        const clauses = [`first_name.ilike.%${search}%`, `last_name.ilike.%${search}%`]
        if (digits) {
          clauses.push(`reg_no.eq.${search}`)
          clauses.push(`aadhar_no.eq.${search}`)
        }
        query = query.or(clauses.join(','))
      }
      return query
    }

    /** Sorts Postgres can do; `least_complete` is handled in memory. */
    const applySort = (q: any) => {
      switch (sort) {
        case 'name':
          return q.order('first_name', { ascending: true, nullsFirst: false })
        case 'age_desc': // oldest first
          return q.order('dateofbirth', { ascending: true, nullsFirst: false })
        case 'age_asc': // youngest first
          return q.order('dateofbirth', { ascending: false, nullsFirst: false })
        case 'recent':
          return q.order('created_at', { ascending: false, nullsFirst: false })
        default:
          return q.order('eac_no', { ascending: true }).order('reg_no', { ascending: true, nullsFirst: false })
      }
    }

    // A missing-section filter or a completeness sort needs the linked tables,
    // which Postgres can't anti-join through PostgREST — so those run in memory.
    const needsFullScan =
      sort === 'least_complete' ||
      sort === 'review' ||
      approval === 'approved_pending' ||
      (missing !== null && missing !== 'dob')

    let rows: any[] = []
    let total = 0

    if (!needsFullScan) {
      const countQuery = applyFilters(supabaseAdmin.from('Child_Data').select('*', { count: 'exact', head: true }))
      const { count, error: countError } = await countQuery
      if (countError) throw countError
      total = count || 0

      const offset = (page - 1) * limit
      const { data, error } = await applySort(
        applyFilters(supabaseAdmin.from('Child_Data').select(LIST_COLUMNS))
      ).range(offset, offset + limit - 1)

      if (error) throw error
      rows = data || []
    } else {
      const { data, error } = await applySort(
        applyFilters(supabaseAdmin.from('Child_Data').select(LIST_COLUMNS))
      ).limit(FULL_SCAN_CAP)

      if (error) throw error
      let all = data || []

      const allCompleteness = await loadCompleteness(
        all.map((r: any) => ({ eac_no: r.eac_no, reg_no: r.reg_no }))
      )

      if (missing && missing !== 'dob') {
        all = all.filter((r: any) => {
          const c = allCompleteness[pairKey(r.eac_no, r.reg_no)]
          if (!c) return true
          if (missing === 'any') {
            return !c.childfmly || !c.childsibling || !c.childuniform
          }
          const section = MISSING_TO_SECTION[missing]
          return section ? !c[section] : true
        })
      }

      if (approval === 'approved_pending') {
        all = all.filter((r: any) => !isComplete(allCompleteness[pairKey(r.eac_no, r.reg_no)]))
      }

      if (sort === 'review') {
        // Stable, so rows inside a bucket keep the centre/reg-no order above.
        all.sort(
          (a: any, b: any) =>
            reviewRank(a, allCompleteness[pairKey(a.eac_no, a.reg_no)]) -
            reviewRank(b, allCompleteness[pairKey(b.eac_no, b.reg_no)])
        )
      }

      if (sort === 'least_complete') {
        const filledCount = (r: any) => {
          const c = allCompleteness[pairKey(r.eac_no, r.reg_no)]
          if (!c) return 0
          return [c.childfmly, c.childsibling, c.childuniform].filter(Boolean).length
        }
        all.sort((a: any, b: any) => filledCount(a) - filledCount(b))
      }

      total = all.length
      const offset = (page - 1) * limit
      rows = all.slice(offset, offset + limit)
    }

    const completeness = await loadCompleteness(
      rows.map((r: any) => ({ eac_no: r.eac_no, reg_no: r.reg_no }))
    )

    // Values for the filter dropdowns, from the whole table rather than the page.
    let facets:
      | { eacNos: string[]; villages: string[]; childVillages: string[]; classes: string[] }
      | undefined
    if (includeFacets) {
      const { data: facetRows } = await supabaseAdmin
        .from('Child_Data')
        .select('eac_no, village, village_name, class_std_text')
        .limit(FULL_SCAN_CAP)

      const eacSet = new Set<string>()
      const villageSet = new Set<string>()
      const childVillageSet = new Set<string>()
      const classSet = new Set<string>()
      for (const row of facetRows || []) {
        if (row.eac_no !== null && row.eac_no !== undefined) eacSet.add(String(row.eac_no))
        if (row.village_name) villageSet.add(String(row.village_name))
        if (row.village) childVillageSet.add(String(row.village))
        if (row.class_std_text) classSet.add(String(row.class_std_text))
      }
      const byName = (a: string, b: string) => a.localeCompare(b)
      facets = {
        eacNos: Array.from(eacSet).sort((a, b) => Number(a) - Number(b)),
        villages: Array.from(villageSet).sort(byName),
        childVillages: Array.from(childVillageSet).sort(byName),
        classes: Array.from(classSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      }
    }

    return NextResponse.json({
      success: true,
      data: rows,
      total,
      page,
      limit,
      completeness,
      facets,
      // Tells the client the count is exact rather than page-local.
      exactTotal: true,
    })
  } catch (error: any) {
    console.error('Child data list error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
