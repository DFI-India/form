import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { PlaceKind, PlaceTree } from '../../../lib/places'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * The place hierarchy.
 *
 * Deliberately NOT under /api/admin: every signed-in role needs to READ places
 * to fill a dropdown — the volunteer form as much as the admin screens. Only
 * admins may add one, which is what stops a volunteer inventing a taluk by
 * typing it. That split mirrors the RLS policies in 002_place_hierarchy.sql.
 */

async function requireUser(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null
  if (!token) throw new Error('Unauthorized')

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  return { user: data.user, role: (profile as { role?: string } | null)?.role ?? null }
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 })
  if (message === 'Forbidden') return NextResponse.json({ error: message }, { status: 403 })
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function GET(req: Request) {
  try {
    await requireUser(req)

    const [districts, taluks, panchayats, villages] = await Promise.all([
      supabase.from('districts').select('id, name, state').order('name'),
      supabase.from('taluks').select('id, district_id, name').order('name'),
      supabase.from('panchayats').select('id, taluk_id, name').order('name'),
      supabase.from('villages').select('id, taluk_id, panchayat_id, name').order('name'),
    ])

    const firstError = [districts, taluks, panchayats, villages].find((r) => r.error)?.error
    if (firstError) {
      // The tables are missing until sql/002_place_hierarchy.sql has been run.
      const missing = /schema cache|does not exist/i.test(firstError.message)
      return NextResponse.json(
        {
          error: missing
            ? 'The place tables do not exist yet — run sql/002_place_hierarchy.sql, then sql/003_place_seed.sql.'
            : firstError.message,
          setupRequired: missing,
        },
        { status: missing ? 503 : 500 }
      )
    }

    const tree: PlaceTree = {
      districts: districts.data ?? [],
      taluks: taluks.data ?? [],
      panchayats: panchayats.data ?? [],
      villages: villages.data ?? [],
    }
    // `?usage=1` adds how many centres and children each village is used by,
    // so the places screen can say what is safe to rename or remove.
    if (new URL(req.url).searchParams.get('usage') === '1') {
      const [centres, children] = await Promise.all([
        supabase.from('centre_data').select('village_id').not('village_id', 'is', null),
        supabase.from('Child_Data').select('village_id').not('village_id', 'is', null),
      ])
      const usage: Record<string, { centres: number; children: number }> = {}
      const bump = (id: string | null, key: 'centres' | 'children') => {
        if (!id) return
        usage[id] = usage[id] ?? { centres: 0, children: 0 }
        usage[id][key] += 1
      }
      for (const row of centres.data ?? []) bump((row as { village_id: string | null }).village_id, 'centres')
      for (const row of children.data ?? []) bump((row as { village_id: string | null }).village_id, 'children')
      return NextResponse.json({ ...tree, usage })
    }

    return NextResponse.json(tree)
  } catch (err) {
    return fail(err)
  }
}

const TABLE: Record<PlaceKind, string> = {
  district: 'districts',
  taluk: 'taluks',
  panchayat: 'panchayats',
  village: 'villages',
}

/** Which column ties each level to the one above it. */
const PARENT: Record<PlaceKind, string | null> = {
  district: null,
  taluk: 'district_id',
  panchayat: 'taluk_id',
  village: 'taluk_id',
}

export async function POST(req: Request) {
  try {
    const { role } = await requireUser(req)
    if (role !== 'admin') throw new Error('Forbidden')

    const body = await req.json()
    const kind = body.kind as PlaceKind
    const name = String(body.name ?? '').trim()
    const parentId = body.parentId ? String(body.parentId) : null
    const panchayatId = body.panchayatId ? String(body.panchayatId) : null

    if (!TABLE[kind]) return NextResponse.json({ error: 'Unknown place type.' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'A name is required.' }, { status: 400 })

    const parentColumn = PARENT[kind]
    if (parentColumn && !parentId) {
      const above = kind === 'taluk' ? 'district' : 'taluk'
      return NextResponse.json({ error: `Pick a ${above} first.` }, { status: 400 })
    }

    const row: Record<string, unknown> = { name }
    if (parentColumn && parentId) row[parentColumn] = parentId
    if (kind === 'village' && panchayatId) row.panchayat_id = panchayatId
    if (kind === 'district' && body.state) row.state = String(body.state).trim()

    const { data, error } = await supabase.from(TABLE[kind]).insert(row).select().single()

    if (error) {
      // 23505 = the unique constraint on (parent, name). Not an error worth
      // shouting about: the place is already there, hand back the existing row.
      if (error.code === '23505') {
        const query = supabase.from(TABLE[kind]).select().eq('name', name)
        const { data: existing } = parentColumn && parentId
          ? await query.eq(parentColumn, parentId).maybeSingle()
          : await query.maybeSingle()
        if (existing) return NextResponse.json({ place: existing, alreadyExisted: true })
      }
      // 23503 = the composite key that keeps a village's panchayat inside the
      // village's own taluk.
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'That panchayat belongs to a different taluk.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Remember the spelling so an import never has to ask about it again.
    const aliasColumn = `${kind}_id`
    await supabase.from('place_aliases').insert({
      kind,
      raw: name.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(),
      [aliasColumn]: (data as { id: string }).id,
    })

    return NextResponse.json({ place: data })
  } catch (err) {
    return fail(err)
  }
}

/** Rename a place, or move a village to a different panchayat. */
export async function PATCH(req: Request) {
  try {
    const { role } = await requireUser(req)
    if (role !== 'admin') throw new Error('Forbidden')

    const body = await req.json()
    const kind = body.kind as PlaceKind
    const id = String(body.id ?? '')

    if (!TABLE[kind]) return NextResponse.json({ error: 'Unknown place type.' }, { status: 400 })
    if (!id) return NextResponse.json({ error: 'Which place?' }, { status: 400 })

    const patch: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: 'A name is required.' }, { status: 400 })
      patch.name = name
    }
    if (kind === 'district' && body.state !== undefined) patch.state = String(body.state).trim() || null
    // null is meaningful here: it clears a village's panchayat.
    if (kind === 'village' && body.panchayatId !== undefined) {
      patch.panchayat_id = body.panchayatId ? String(body.panchayatId) : null
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
    }

    const { data, error } = await supabase.from(TABLE[kind]).update(patch).eq('id', id).select().single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Another ${kind} here already has that name.` }, { status: 409 })
      }
      if (error.code === '23503') {
        return NextResponse.json({ error: 'That panchayat belongs to a different taluk.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // A renamed place keeps answering to its old spelling on import.
    if (patch.name) {
      await supabase.from('place_aliases').insert({
        kind,
        raw: String(patch.name).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(),
        [`${kind}_id`]: id,
      })
    }

    return NextResponse.json({ place: data })
  } catch (err) {
    return fail(err)
  }
}

/**
 * Remove a place that nothing points at.
 *
 * The foreign keys are ON DELETE RESTRICT, so Postgres refuses while anything
 * below still exists; this turns that into a sentence a person can act on.
 */
export async function DELETE(req: Request) {
  try {
    const { role } = await requireUser(req)
    if (role !== 'admin') throw new Error('Forbidden')

    const body = await req.json()
    const kind = body.kind as PlaceKind
    const id = String(body.id ?? '')

    if (!TABLE[kind]) return NextResponse.json({ error: 'Unknown place type.' }, { status: 400 })
    if (!id) return NextResponse.json({ error: 'Which place?' }, { status: 400 })

    if (kind === 'village') {
      const [centres, children] = await Promise.all([
        supabase.from('centre_data').select('eac_no').eq('village_id', id).limit(1),
        supabase.from('Child_Data').select('record_id').eq('village_id', id).limit(1),
      ])
      if ((centres.data?.length ?? 0) > 0 || (children.data?.length ?? 0) > 0) {
        return NextResponse.json(
          { error: 'That village is still used by a centre or a child. Move them first.' },
          { status: 409 }
        )
      }
    }

    const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id)

    if (error) {
      if (error.code === '23503') {
        const below = kind === 'district' ? 'taluks' : kind === 'taluk' ? 'panchayats or villages' : 'villages'
        return NextResponse.json(
          { error: `That ${kind} still has ${below} under it. Remove those first.` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Only once the place is really gone — a failed delete above must not take
    // the spellings with it.
    await supabase.from('place_aliases').delete().eq(`${kind}_id`, id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return fail(err)
  }
}
