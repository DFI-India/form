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

// eac_no/reg_no column types are inconsistent across these tables (see
// lib/errors.ts-adjacent schema notes) — Child_Data uses bigint for both,
// childleaving uses varchar for reg_no, the rest use varchar eac_no + bigint reg_no.
const SECTION_TABLES = {
  child_data: { table: 'Child_Data', eacType: 'number', regType: 'number' },
  childfmly: { table: 'childfmly', eacType: 'string', regType: 'number' },
  childsibling: { table: 'childsibling', eacType: 'string', regType: 'number' },
  childuniform: { table: 'childuniform', eacType: 'string', regType: 'number' },
  childleaving: { table: 'childleaving', eacType: 'string', regType: 'string' },
} as const

type SectionKey = keyof typeof SECTION_TABLES

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
    const eacNoParam = searchParams.get('eacNo')
    const regNoParam = searchParams.get('regNo')

    if (!eacNoParam || !regNoParam) {
      return NextResponse.json({ error: 'eacNo and regNo are required' }, { status: 400 })
    }

    if (Number.isNaN(Number(eacNoParam)) || Number.isNaN(Number(regNoParam))) {
      return NextResponse.json({ error: 'eacNo and regNo must be numeric' }, { status: 400 })
    }

    const sectionEntries = Object.entries(SECTION_TABLES) as [SectionKey, typeof SECTION_TABLES[SectionKey]][]

    const results = await Promise.all(
      sectionEntries.map(async ([key, config]) => {
        const eacValue = config.eacType === 'number' ? Number(eacNoParam) : String(eacNoParam)
        const regValue = config.regType === 'number' ? Number(regNoParam) : String(regNoParam)

        // Not maybeSingle(): a few children have two rows in a section, and
        // maybeSingle() errors on that, which used to show as "nothing recorded"
        // and invite a third copy. Take the newest and report the extra.
        const { data, error } = await supabaseAdmin
          .from(config.table)
          .select('*')
          .eq('eac_no', eacValue)
          .eq('reg_no', regValue)
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(5)

        if (error) {
          console.error(`child-profile: error fetching ${config.table}`, error)
          return [key, null, 0] as const
        }

        return [key, data?.[0] ?? null, data?.length ?? 0] as const
      })
    )

    const profileData = Object.fromEntries(results.map(([key, row]) => [key, row]))
    const duplicates = Object.fromEntries(
      results.filter(([, , count]) => count > 1).map(([key, , count]) => [key, count])
    )

    if (!profileData.child_data) {
      return NextResponse.json({ error: 'No child found for that EAC No / Reg No' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: profileData, duplicates })
  } catch (error: any) {
    console.error('Child profile fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
