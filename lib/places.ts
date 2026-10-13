/**
 * The place hierarchy: district > taluk > panchayat > village.
 *
 * Geography used to be free text on every row, so a typo silently became a new
 * taluk. It now lives in its own tables with foreign keys between the levels —
 * see sql/002_place_hierarchy.sql. This module is the shared vocabulary for the
 * screens and the importer.
 */

export interface District {
  id: string
  name: string
  state: string | null
}

export interface Taluk {
  id: string
  district_id: string
  name: string
}

export interface Panchayat {
  id: string
  taluk_id: string
  name: string
}

export interface Village {
  id: string
  taluk_id: string
  panchayat_id: string | null
  name: string
}

export interface PlaceTree {
  districts: District[]
  taluks: Taluk[]
  panchayats: Panchayat[]
  villages: Village[]
}

export const emptyTree = (): PlaceTree => ({ districts: [], taluks: [], panchayats: [], villages: [] })

export type PlaceKind = 'district' | 'taluk' | 'panchayat' | 'village'

/**
 * The lookup key for `place_aliases.raw`.
 *
 * Must stay byte-identical to the normalisation used when the aliases were
 * seeded, or "DODDABALLAPPUR" stops resolving. Upper-cased, every run of
 * non-alphanumerics collapsed to one space, trimmed.
 */
export const placeKey = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()

/**
 * Squash the transliteration noise that Kannada place names pick up in English:
 * aspirated consonants (th/t), doubled letters, and vowels, which are where
 * almost every variant spelling differs — Voddarahalli / Voddorhalli /
 * Vaddarahalli all fold to the same key.
 *
 * Only ever used to *suggest* a match for a human to confirm. Folding is lossy
 * enough that two genuinely different villages can collide (Gundumgere-1 and
 * Gundamgere-2 are separate centres), so nothing merges on this alone.
 */
export const foldPlaceName = (value: unknown): string =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/TH/g, 'T')
    .replace(/DD/g, 'D')
    .replace(/LL/g, 'L')
    .replace(/TT/g, 'T')
    .replace(/PP/g, 'P')
    .replace(/NN/g, 'N')
    .replace(/SS/g, 'S')
    .replace(/GH/g, 'G')
    .replace(/BH/g, 'B')
    .replace(/[AEIOU]/g, '')

/** Taluks of one district, sorted. */
export const taluksIn = (tree: PlaceTree, districtId: string | null) =>
  districtId
    ? tree.taluks.filter((t) => t.district_id === districtId).sort((a, b) => a.name.localeCompare(b.name))
    : []

/** Villages of one taluk, sorted. */
export const villagesIn = (tree: PlaceTree, talukId: string | null) =>
  talukId
    ? tree.villages.filter((v) => v.taluk_id === talukId).sort((a, b) => a.name.localeCompare(b.name))
    : []

/** Panchayats of one taluk, sorted. */
export const panchayatsIn = (tree: PlaceTree, talukId: string | null) =>
  talukId
    ? tree.panchayats.filter((p) => p.taluk_id === talukId).sort((a, b) => a.name.localeCompare(b.name))
    : []

/**
 * Villages of one taluk, bucketed under their panchayat.
 *
 * A panchayat covers several villages, so a taluk's village list reads as a
 * flat run of unfamiliar names. Grouping restores the level the click path
 * skips. Villages with no panchayat recorded come last, under their own label.
 */
export function villagesByPanchayat(
  tree: PlaceTree,
  talukId: string | null
): { panchayat: Panchayat | null; villages: Village[] }[] {
  const villages = villagesIn(tree, talukId)
  if (villages.length === 0) return []

  const byId = new Map(tree.panchayats.map((p) => [p.id, p]))
  const buckets = new Map<string, { panchayat: Panchayat | null; villages: Village[] }>()

  for (const village of villages) {
    const key = village.panchayat_id ?? ''
    if (!buckets.has(key)) {
      buckets.set(key, { panchayat: village.panchayat_id ? byId.get(village.panchayat_id) ?? null : null, villages: [] })
    }
    buckets.get(key)!.villages.push(village)
  }

  return Array.from(buckets.values()).sort((a, b) => {
    if (!a.panchayat) return 1
    if (!b.panchayat) return -1
    return a.panchayat.name.localeCompare(b.panchayat.name)
  })
}

/** Walk a village back up to its taluk and district — the labels a row shows. */
export interface ResolvedPlace {
  village: Village | null
  panchayat: Panchayat | null
  taluk: Taluk | null
  district: District | null
}

export function resolveVillage(tree: PlaceTree, villageId: string | null | undefined): ResolvedPlace {
  const village = villageId ? tree.villages.find((v) => v.id === villageId) ?? null : null
  const taluk = village ? tree.taluks.find((t) => t.id === village.taluk_id) ?? null : null
  const district = taluk ? tree.districts.find((d) => d.id === taluk.district_id) ?? null : null
  const panchayat = village?.panchayat_id
    ? tree.panchayats.find((p) => p.id === village.panchayat_id) ?? null
    : null
  return { village, panchayat, taluk, district }
}

/** "Koluru, Doddaballapur, Bangalore Rural" */
export const placeLabel = (tree: PlaceTree, villageId: string | null | undefined): string => {
  const { village, taluk, district } = resolveVillage(tree, villageId)
  return [village?.name, taluk?.name, district?.name].filter(Boolean).join(', ')
}
