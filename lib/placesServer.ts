import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Turn a village_id into the district/taluk/panchayat/village_name text that
 * the older screens, exports and the volunteer form still read.
 *
 * Those columns are kept as a denormalised copy on purpose: half the app reads
 * them and rewriting all of it at once would be reckless. The rule is that they
 * are only ever *derived* — nothing writes them by hand any more, so they
 * cannot drift away from the master the way they used to.
 */
export interface PlaceColumns {
  village_id: string | null
  village_name: string | null
  district: string | null
  taluk: string | null
  panchayat: string | null
}

export async function placeColumnsFor(
  supabase: SupabaseClient,
  villageId: string | null | undefined
): Promise<PlaceColumns | null> {
  if (!villageId) return null

  const { data, error } = await supabase
    .from('villages')
    .select('id, name, panchayat_id, taluk_id, taluks ( name, districts ( name ) ), panchayats ( name )')
    .eq('id', villageId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as {
    id: string
    name: string
    taluks: { name: string; districts: { name: string } | null } | null
    panchayats: { name: string } | null
  }

  return {
    village_id: row.id,
    village_name: row.name,
    taluk: row.taluks?.name ?? null,
    district: row.taluks?.districts?.name ?? null,
    panchayat: row.panchayats?.name ?? null,
  }
}

/**
 * Resolve a free-text place name to a village id via place_aliases.
 *
 * Returns null when the spelling has never been seen. Callers must treat that
 * as "ask a human", never as "create it" — an unrecognised village is exactly
 * how a typo used to become a permanent new place.
 */
export async function resolveVillageAlias(
  supabase: SupabaseClient,
  rawName: string,
  talukId?: string | null
): Promise<string | null> {
  const raw = String(rawName ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
  if (!raw) return null

  const { data } = await supabase
    .from('place_aliases')
    .select('village_id')
    .eq('kind', 'village')
    .eq('raw', raw)
    .maybeSingle()

  const villageId = (data as { village_id?: string } | null)?.village_id ?? null
  if (!villageId || !talukId) return villageId

  // A village alias is unique on the spelling alone, so confirm it really is in
  // the taluk the caller expects before handing it back.
  const { data: village } = await supabase
    .from('villages')
    .select('taluk_id')
    .eq('id', villageId)
    .maybeSingle()

  return (village as { taluk_id?: string } | null)?.taluk_id === talukId ? villageId : null
}
