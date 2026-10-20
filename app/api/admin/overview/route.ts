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

const SCAN_CAP = 5000

const pairKey = (eac: unknown, reg: unknown) => `${String(eac)}::${String(reg)}`

/**
 * Everything the admin home page shows, in one request.
 *
 * The "missing family" figure can't be a COUNT: it's an anti-join against
 * childfmly, which PostgREST can't express, so the keys are diffed here. At
 * roughly a thousand children that is a couple of cheap key-only queries.
 */
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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const countOf = async (build: (q: any) => any) => {
      const { count, error } = await build(
        supabaseAdmin.from('Child_Data').select('*', { count: 'exact', head: true })
      )
      if (error) throw error
      return count || 0
    }

    const [
      totalChildren,
      leftChildren,
      pending,
      verified,
      approved,
      returned,
      noDob,
      centreCount,
      pendingConflicts,
    ] = await Promise.all([
      countOf((q: any) => q),
      countOf((q: any) => q.eq('child_left', true)),
      countOf((q: any) => q.eq('status', 'Pending')),
      countOf((q: any) => q.eq('status', 'Verified')),
      countOf((q: any) => q.eq('status', 'Approved')),
      countOf((q: any) => q.eq('status', 'Rejected')),
      countOf((q: any) => q.is('dateofbirth', null)),
      (async () => {
        const { count, error } = await supabaseAdmin
          .from('centre_data')
          .select('*', { count: 'exact', head: true })
        if (error) throw error
        return count || 0
      })(),
      // Import conflicts waiting on a decision. The table is created by a
      // migration the admin runs by hand, so its absence is not an error here.
      (async () => {
        const { count, error } = await supabaseAdmin
          .from('import_staging')
          .select('*', { count: 'exact', head: true })
          .eq('state', 'pending')
        if (error) return 0
        return count || 0
      })(),
    ])

    // Children with no family row, and per-centre completeness.
    // A child is "missing details" when any section they should have is absent.
    // Leaving only counts once they are marked as left.
    const [{ data: childKeys }, ...sectionRows] = await Promise.all([
      supabaseAdmin.from('Child_Data').select('eac_no, reg_no, village_name, child_left').limit(SCAN_CAP),
      supabaseAdmin.from('childfmly').select('eac_no, reg_no').limit(SCAN_CAP),
      supabaseAdmin.from('childsibling').select('eac_no, reg_no').limit(SCAN_CAP),
      supabaseAdmin.from('childuniform').select('eac_no, reg_no').limit(SCAN_CAP),
      supabaseAdmin.from('childleaving').select('eac_no, reg_no').limit(SCAN_CAP),
    ])

    const setOf = (i: number) =>
      new Set((sectionRows[i]?.data || []).map((r: any) => pairKey(r.eac_no, r.reg_no)))
    const familySet = setOf(0)
    const siblingSet = setOf(1)
    const uniformSet = setOf(2)
    const leavingSet = setOf(3)

    const isMissingDetails = (row: any) => {
      const key = pairKey(row.eac_no, row.reg_no)
      if (!familySet.has(key) || !siblingSet.has(key) || !uniformSet.has(key)) return true
      return Boolean(row.child_left) && !leavingSet.has(key)
    }

    let missingDetails = 0
    const perCentre = new Map<string, { eacNo: string; village: string; total: number; withFamily: number }>()

    for (const row of childKeys || []) {
      const hasFamily = !isMissingDetails(row)
      if (!hasFamily) missingDetails += 1

      const eacNo = String(row.eac_no ?? '')
      if (!eacNo) continue
      if (!perCentre.has(eacNo)) {
        perCentre.set(eacNo, { eacNo, village: row.village_name || '', total: 0, withFamily: 0 })
      }
      const centre = perCentre.get(eacNo)!
      centre.total += 1
      if (hasFamily) centre.withFamily += 1
      if (!centre.village && row.village_name) centre.village = row.village_name
    }

    const centres = Array.from(perCentre.values())
      .map((c) => ({
        ...c,
        percent: c.total > 0 ? Math.round((c.withFamily / c.total) * 100) : 0,
      }))
      .sort((a, b) => a.percent - b.percent)

    return NextResponse.json({
      success: true,
      totals: {
        children: totalChildren,
        enrolled: totalChildren - leftChildren,
        left: leftChildren,
        centres: centreCount,
      },
      byStatus: { pending, verified, approved, returned },
      gaps: {
        missingDetails,
        noDob,
      },
      pendingConflicts,
      /** Weakest centres first — that's the list worth acting on. */
      centres: centres.slice(0, 8),
    })
  } catch (error: any) {
    console.error('Admin overview error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
