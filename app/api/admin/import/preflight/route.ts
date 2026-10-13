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

interface PreflightBody {
  /** Only the identifying keys — the full rows stay in the browser. */
  entities: { entity: ImportEntity; keys: { eac_no: string | number; reg_no: string | number }[] }[]
}

const pairKey = (eac: unknown, reg: unknown) => `${String(eac)}::${String(reg)}`

/**
 * Read-only: reports which incoming records already exist and which centres are
 * missing, so the client can render a full diff before anything is written.
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - only admins can import' }, { status: 403 })
    }

    const body = (await request.json()) as PreflightBody
    if (!Array.isArray(body.entities) || body.entities.length === 0) {
      return NextResponse.json({ error: 'Nothing to check' }, { status: 400 })
    }

    // --- Centres ----------------------------------------------------------
    const allEacs = Array.from(
      new Set(
        body.entities.flatMap((e) => e.keys.map((k) => Number(k.eac_no))).filter((n) => Number.isFinite(n))
      )
    )

    const { data: centreRows, error: centreError } = await supabaseAdmin
      .from('centre_data')
      .select('eac_no, village_name')
      .in('eac_no', allEacs)

    if (centreError) {
      return NextResponse.json({ error: `Centre lookup failed: ${centreError.message}` }, { status: 500 })
    }

    const existingCentres = (centreRows || []).map((c: any) => ({
      eac_no: Number(c.eac_no),
      village_name: c.village_name,
    }))
    const knownCentreNos = new Set(existingCentres.map((c) => c.eac_no))

    // --- Existing records per entity --------------------------------------
    const perEntity: Record<string, { existingKeys: string[]; total: number }> = {}

    for (const group of body.entities) {
      const spec = IMPORT_SPECS[group.entity]
      if (!spec) continue

      const eacs = Array.from(new Set(group.keys.map((k) => Number(k.eac_no)).filter(Number.isFinite)))
      const incoming = new Set(group.keys.map((k) => pairKey(k.eac_no, k.reg_no)))
      const existingKeys: string[] = []

      for (let i = 0; i < eacs.length; i += 50) {
        const slice = eacs.slice(i, i + 50)
        const query = spec.eacType === 'int' ? slice : slice.map(String)

        const { data, error } = await supabaseAdmin
          .from(spec.table)
          .select('eac_no, reg_no')
          .in('eac_no', query as any)

        if (error) {
          return NextResponse.json(
            { error: `Lookup failed for ${spec.table}: ${error.message}` },
            { status: 500 }
          )
        }

        for (const row of data || []) {
          const key = pairKey(row.eac_no, row.reg_no)
          // Only report collisions with rows we're actually importing.
          if (incoming.has(key)) existingKeys.push(key)
        }
      }

      perEntity[group.entity] = {
        existingKeys: Array.from(new Set(existingKeys)),
        total: group.keys.length,
      }
    }

    return NextResponse.json({
      success: true,
      centres: {
        existing: existingCentres,
        missing: allEacs.filter((n) => !knownCentreNos.has(n)).sort((a, b) => a - b),
      },
      perEntity,
    })
  } catch (error: any) {
    console.error('Import preflight error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
