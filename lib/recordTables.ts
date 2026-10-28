/**
 * Which tables the generic record routes may touch, and which columns of them
 * a person may write.
 *
 * These routes take the table from the request body and run with the service
 * key, which bypasses row-level security entirely. Without an allowlist, a
 * caller could name any table in the database — `profiles` included — and the
 * only thing standing between a DFI staff account and `role: 'admin'` would be
 * the fact that nobody had tried.
 */

export const RECORD_TABLES = {
  child_data: 'Child_Data',
  childfmly: 'childfmly',
  childsibling: 'childsibling',
  childuniform: 'childuniform',
  childleaving: 'childleaving',
  vocational_course: 'vocational_course',
  computer_course: 'computer_course',
} as const

export type RecordEntity = keyof typeof RECORD_TABLES

export const isRecordEntity = (v: unknown): v is RecordEntity =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(RECORD_TABLES, v)

export const tableFor = (entity: RecordEntity) => RECORD_TABLES[entity]

/** Only these may be used to find a row, so a caller cannot probe by any column. */
export const PRIMARY_KEYS: Record<RecordEntity, string[]> = {
  child_data: ['record_id', 'id'],
  childfmly: ['record_id', 'id'],
  childsibling: ['record_id', 'id'],
  childuniform: ['record_id', 'id'],
  childleaving: ['record_id', 'id'],
  vocational_course: ['record_id', 'vocational_id', 'id'],
  computer_course: ['record_id', 'computer_id', 'id'],
}

/**
 * Columns an edit may never set.
 *
 * Approval state belongs to the approval endpoints, which enforce who may move
 * a record between stages. Letting a general edit write `status` would let
 * anyone with edit rights approve their own work by sending one extra field,
 * and letting it write `submitted_by` would let them reassign authorship.
 */
export const PROTECTED_COLUMNS = new Set([
  'id',
  'record_id',
  'vocational_id',
  'computer_id',
  'status',
  'submitted_by',
  'verified_by',
  'verified_at',
  'approved_by',
  'approved_at',
  'created_at',
  'updated_at',
  // The pair that ties every linked section to its child. Changing either here
  // would silently detach a child's family, siblings and uniform records.
  'eac_no',
  'reg_no',
])

export function sanitiseUpdates(updates: Record<string, unknown>): {
  clean: Record<string, unknown>
  rejected: string[]
} {
  const clean: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [key, value] of Object.entries(updates || {})) {
    if (PROTECTED_COLUMNS.has(key)) rejected.push(key)
    else clean[key] = value
  }
  return { clean, rejected }
}
