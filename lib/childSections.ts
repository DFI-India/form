/**
 * Field definitions for the four sections linked to a child.
 *
 * Shared by the admin editor (to draw the form) and the create-section API (to
 * whitelist and coerce what it inserts), so the two can't drift apart. Identity
 * columns — eac_no, reg_no, village_name — are deliberately absent: they tie a
 * section to its child and are set by the server, never typed.
 */

export type ChildSectionKey = 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving'

export type FieldKind = 'text' | 'number' | 'date' | 'textarea' | 'select'

export interface SectionField {
  key: string
  label: string
  kind: FieldKind
  options?: string[]
  /** Spans the full row of its group. */
  wide?: boolean
  /** Integer column — reject decimals rather than let Postgres reject the row. */
  integer?: boolean
}

export interface SectionGroup {
  title?: string
  /** Four-up for sibling rows; two-up everywhere else. */
  columns?: 2 | 4
  fields: SectionField[]
}

export interface SectionSchema {
  label: string
  /** Lower-case noun for sentences: "Save family details". */
  noun: string
  /** Whether the table has a village_name column to copy from the child. */
  hasVillageName: boolean
  groups: SectionGroup[]
}

// Same lists the volunteer form offers, so admin entries look like field entries.
const GENDERS = ['Male', 'Female', 'Other']
const PASS_STATUSES = ['Pass', 'Drop Out']

const siblingGroup = (n: number): SectionGroup => ({
  title: `Sibling ${n}`,
  columns: 4,
  fields: [
    { key: `names_${n}`, label: 'Name', kind: 'text' },
    { key: `ages_${n}`, label: 'Age', kind: 'number', integer: true },
    { key: `genders_${n}`, label: 'Gender', kind: 'select', options: GENDERS },
    { key: `class_occup_${n}`, label: 'Class or occupation', kind: 'text' },
  ],
})

export const SECTION_SCHEMA: Record<ChildSectionKey, SectionSchema> = {
  childfmly: {
    label: 'Family',
    noun: 'family details',
    hasVillageName: true,
    groups: [
      {
        title: 'Father',
        fields: [
          { key: 'f_name', label: 'Name', kind: 'text' },
          { key: 'f_occup', label: 'Occupation', kind: 'text' },
          { key: 'f_inc', label: 'Monthly income', kind: 'number' },
          { key: 'f_mobile', label: 'Mobile', kind: 'text' },
          { key: 'f_aadhar', label: 'Aadhaar No', kind: 'text' },
        ],
      },
      {
        title: 'Mother',
        fields: [
          { key: 'm_name', label: 'Name', kind: 'text' },
          { key: 'm_occup', label: 'Occupation', kind: 'text' },
          { key: 'm_inc', label: 'Monthly income', kind: 'number' },
          { key: 'm_mobile', label: 'Mobile', kind: 'text' },
          { key: 'm_aadhar', label: 'Aadhaar No', kind: 'text' },
        ],
      },
      {
        title: 'Address',
        fields: [
          { key: 'fmly_addr1', label: 'Line 1', kind: 'text', wide: true },
          { key: 'fmly_addr2', label: 'Line 2', kind: 'text', wide: true },
          { key: 'fmly_addr3', label: 'Line 3', kind: 'text', wide: true },
          { key: 'fmly_pincode', label: 'Pincode', kind: 'text' },
        ],
      },
      { fields: [{ key: 'fmly_remarks', label: 'Remarks', kind: 'textarea', wide: true }] },
    ],
  },
  childsibling: {
    label: 'Siblings',
    noun: 'sibling details',
    hasVillageName: true,
    groups: [
      siblingGroup(1),
      siblingGroup(2),
      siblingGroup(3),
      siblingGroup(4),
      siblingGroup(5),
      { fields: [{ key: 'sibling_remarks', label: 'Remarks', kind: 'textarea', wide: true }] },
    ],
  },
  childuniform: {
    label: 'Uniform',
    noun: 'uniform sizes',
    hasVillageName: true,
    groups: [
      {
        fields: [
          { key: 'shirtsize', label: 'Shirt', kind: 'text' },
          { key: 'knickersize', label: 'Knicker', kind: 'text' },
          { key: 'pant_skirtsize', label: 'Pant or skirt', kind: 'text' },
          { key: 'chudidharsize', label: 'Chudidhar', kind: 'text' },
          { key: 'top_pantsize', label: 'Top and pant', kind: 'text' },
          { key: 'footwearsize', label: 'Footwear', kind: 'text' },
          { key: 'uniform_updated', label: 'Sizes taken on', kind: 'date' },
        ],
      },
    ],
  },
  childleaving: {
    label: 'Leaving',
    noun: 'leaving details',
    hasVillageName: false,
    groups: [
      {
        fields: [
          { key: 'leav_date', label: 'Date left', kind: 'date' },
          { key: 'leav_class', label: 'Class when leaving', kind: 'text' },
          { key: 'pass_status', label: 'Pass status', kind: 'select', options: PASS_STATUSES },
          { key: 'reason', label: 'Reason', kind: 'textarea', wide: true },
        ],
      },
      {
        title: 'Address after leaving',
        fields: [
          { key: 'leav_addr1', label: 'Line 1', kind: 'text', wide: true },
          { key: 'leav_addr2', label: 'Line 2', kind: 'text', wide: true },
          { key: 'leav_addr3', label: 'Line 3', kind: 'text', wide: true },
          { key: 'leav_pincode', label: 'Pincode', kind: 'text' },
        ],
      },
      { fields: [{ key: 'leav_remarks', label: 'Remarks', kind: 'textarea', wide: true }] },
    ],
  },
}

export const isChildSectionKey = (value: unknown): value is ChildSectionKey =>
  typeof value === 'string' && value in SECTION_SCHEMA

export const sectionFields = (section: ChildSectionKey): SectionField[] =>
  SECTION_SCHEMA[section].groups.flatMap((g) => g.fields)

/** Blank form values for a section that has never been recorded. */
export const emptySectionValues = (section: ChildSectionKey): Record<string, string> =>
  Object.fromEntries(sectionFields(section).map((f) => [f.key, '']))

/** Row from the database → strings the inputs can hold. */
export const sectionValuesFromRow = (
  section: ChildSectionKey,
  row: Record<string, unknown>
): Record<string, string> =>
  Object.fromEntries(
    sectionFields(section).map((f) => {
      const raw = row[f.key]
      if (raw === null || raw === undefined) return [f.key, '']
      // Dates come back as full timestamps from some imports; inputs want YYYY-MM-DD.
      if (f.kind === 'date') return [f.key, String(raw).slice(0, 10)]
      return [f.key, String(raw)]
    })
  )

/**
 * Form strings → column values. Blank becomes null rather than '' so an
 * untouched field doesn't count as "filled in" anywhere downstream.
 *
 * Rejects unknown keys and malformed numbers/dates instead of guessing.
 */
export function coerceSectionValues(
  section: ChildSectionKey,
  input: Record<string, unknown>
): { value: Record<string, string | number | null> } | { error: string } {
  const fields = sectionFields(section)
  const byKey = new Map(fields.map((f) => [f.key, f]))

  const unknown = Object.keys(input).filter((k) => !byKey.has(k))
  if (unknown.length > 0) return { error: `Unexpected field(s): ${unknown.join(', ')}` }

  const out: Record<string, string | number | null> = {}
  for (const field of fields) {
    if (!(field.key in input)) continue
    const raw = input[field.key]
    const text = raw === null || raw === undefined ? '' : String(raw).trim()

    if (text === '') {
      out[field.key] = null
      continue
    }

    if (field.kind === 'number') {
      const n = Number(text)
      if (!Number.isFinite(n) || n < 0) return { error: `${field.label} must be a number.` }
      if (field.integer && !Number.isInteger(n)) return { error: `${field.label} must be a whole number.` }
      out[field.key] = n
    } else if (field.kind === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(text).getTime())) {
        return { error: `${field.label} must be a valid date.` }
      }
      out[field.key] = text
    } else {
      out[field.key] = text
    }
  }
  return { value: out }
}
