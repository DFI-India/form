/**
 * Comparing an incoming import row against the row already in the database.
 *
 * The point of this module is the distinction between "this record already
 * exists" and "this record already exists AND says something different". A
 * re-run of the same Access export collides on every key but changes nothing,
 * and asking an admin to review 5,000 no-op collisions is worse than useless.
 * Only rows with a real difference become conflicts.
 */

import { IMPORT_SPECS, type ImportEntity } from './importSpecs'

/**
 * Reduce a value to the form worth comparing.
 *
 * The two sides arrive by different routes — one parsed from Access, one out of
 * PostgREST — so the same fact shows up in different shapes: `42` vs `"42"`,
 * `"2019-06-01"` vs `"2019-06-01T00:00:00+00:00"`, `null` vs `""`. None of
 * those are edits, and flagging them would bury the handful that are.
 */
export function normalize(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'boolean') return value ? 'true' : 'false'

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null
  }

  const s = String(value).trim()
  if (!s) return null

  // Timestamps compare by calendar day: the import only ever carries a date.
  const isoDate = /^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/.exec(s)
  if (isoDate) return isoDate[1]

  // Postgres renders booleans as t/f in some client paths.
  if (s === 't' || s === 'true' || s === 'TRUE') return 'true'
  if (s === 'f' || s === 'false' || s === 'FALSE') return 'false'

  // "42" and "42.0" are the same registration number.
  if (/^-?\d+(\.0+)?$/.test(s)) return String(Number(s))

  return s.toLowerCase()
}

export interface FieldDiff {
  field: string
  existing: unknown
  incoming: unknown
}

/**
 * Fields where the incoming row disagrees with what's stored.
 *
 * A field the file doesn't carry at all is not a difference — partial exports
 * (ChildLeaving covers a few hundred children) must not read as "clear these
 * columns on everyone else". Only fields present in the incoming row and
 * mapped by the entity's spec are considered.
 */
export function diffRow(
  entity: ImportEntity,
  incoming: Record<string, any>,
  existing: Record<string, any>
): FieldDiff[] {
  const spec = IMPORT_SPECS[entity]
  const out: FieldDiff[] = []

  for (const field of spec.fields) {
    const column = field.to

    // Identity columns aren't editable — they're what matched the two rows.
    if (column === 'eac_no' || column === 'reg_no') continue
    if (!(column in incoming)) continue

    const a = normalize(incoming[column])
    const b = normalize(existing[column])
    if (a === b) continue

    // The file being blank where the database has a value is almost always a
    // gap in the export, not an instruction to erase. Treated as no change;
    // clearing a field stays a manual edit.
    if (a === null) continue

    out.push({ field: column, existing: existing[column] ?? null, incoming: incoming[column] })
  }

  return out
}

/** Human label for a column, for the review table. */
export function fieldLabel(column: string): string {
  return column
    .replace(/_/g, ' ')
    .replace(/\bno\b/g, 'no.')
    .replace(/^./, (c) => c.toUpperCase())
}
