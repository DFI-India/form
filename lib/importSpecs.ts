/**
 * Bulk import mapping: legacy Microsoft Access exports -> Supabase tables.
 *
 * The Access column names differ in case and spelling from our columns
 * (e.g. `DateofBirth` -> `dateofbirth`, `Ch_District` -> `district`), and
 * Access/Excel exports dates as serial numbers rather than dates, so every
 * incoming file goes through a per-entity spec before it touches the database.
 */

export type ImportEntity = 'child_data' | 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving'

type FieldType = 'text' | 'int' | 'date' | 'bool'

interface FieldSpec {
  /** Column name(s) as they appear in the Access export, matched case-insensitively. */
  from: string[]
  /** Column name in our table. */
  to: string
  type: FieldType
}

export interface EntitySpec {
  entity: ImportEntity
  label: string
  table: string
  /** Type of eac_no/reg_no in this table — they differ across tables. */
  eacType: FieldType
  regType: FieldType
  fields: FieldSpec[]
}

const f = (from: string | string[], to: string, type: FieldType = 'text'): FieldSpec => ({
  from: Array.isArray(from) ? from : [from],
  to,
  type,
})

/** Sibling columns are flattened 1..5 in both systems. */
const siblingFields = (): FieldSpec[] => {
  const out: FieldSpec[] = []
  for (let i = 1; i <= 5; i += 1) {
    out.push(f(`Names_${i}`, `names_${i}`))
    out.push(f(`Ages_${i}`, `ages_${i}`, 'int'))
    out.push(f(`Genders_${i}`, `genders_${i}`))
    out.push(f(`Class_Occup_${i}`, `class_occup_${i}`))
  }
  return out
}

export const IMPORT_SPECS: Record<ImportEntity, EntitySpec> = {
  child_data: {
    entity: 'child_data',
    label: 'Child (ChildInfo)',
    table: 'Child_Data',
    eacType: 'int',
    regType: 'int',
    fields: [
      f('Adm_Date', 'adm_date', 'date'),
      f(['ChildInfo_Village_name', 'Village_Name', 'Village_name'], 'village_name'),
      f('Centre_Number', 'centre_id'),
      f('Ch_District', 'district'),
      f('Ch_Taluk', 'taluk'),
      f('Ch_Panchayat', 'panchayat'),
      f('Ch_Village', 'village'),
      f('First_Name', 'first_name'),
      f('Last_Name', 'last_name'),
      f('Gender', 'gender'),
      f('DateofBirth', 'dateofbirth', 'date'),
      f(['Aadhar_number', 'Aadhar_No'], 'aadhar_no', 'int'),
      f('BirthPlace', 'birth_place'),
      f('Height', 'height', 'int'),
      f('Weight', 'weight', 'int'),
      f('BloodGroup', 'blood_group'),
      f('Ch_Health', 'health'),
      f('Religion', 'religion'),
      f('Caste', 'caste'),
      f('Mother_Tongue', 'mother_tongue'),
      f('Class_Std', 'class_std_text'),
      f('School', 'school_name'),
      f('Govt_Private', 'school_category'),
      f('SATS_No', 'sats_no', 'int'),
      f('PEN_No', 'pen_no', 'int'),
      f('Med_Study', 'medium_of_study'),
      f('Life_Ambi', 'life_ambition'),
      f('Fav_Subj', 'fav_subject'),
      f('Chld_oth_info', 'child_other_info'),
      // Access column is named "Onroll" but is set true exactly when the child
      // HAS LEFT (verified against ChildLeaving: 395/395 match, 852/852 inverse).
      // So it maps to child_left with the same polarity, not inverted.
      f('Onroll', 'child_left', 'bool'),
    ],
  },

  childfmly: {
    entity: 'childfmly',
    label: 'Family (ChildFmly)',
    table: 'childfmly',
    eacType: 'text',
    regType: 'int',
    fields: [
      f(['Village_Name', 'Village_name'], 'village_name'),
      f('F_Name', 'f_name'),
      f('F_Occup', 'f_occup'),
      f('F_Inc', 'f_inc'),
      f('F_Aadhar', 'f_aadhar'),
      f('F_Mobile', 'f_mobile'),
      f('M_Name', 'm_name'),
      f('M_Occup', 'm_occup'),
      f('M_Inc', 'm_inc'),
      f('M_Aadhar', 'm_aadhar'),
      f('M_Mobile', 'm_mobile'),
      f('Fmly_Addr1', 'fmly_addr1'),
      f('Fmly_Addr2', 'fmly_addr2'),
      f('Fmly_Addr3', 'fmly_addr3'),
      f('Fmly_Pincode', 'fmly_pincode'),
      f('Fmly_Remarks', 'fmly_remarks'),
    ],
  },

  childsibling: {
    entity: 'childsibling',
    label: 'Siblings (ChildSibling)',
    table: 'childsibling',
    eacType: 'text',
    regType: 'int',
    fields: [
      f(['Village_name', 'Village_Name'], 'village_name'),
      ...siblingFields(),
      f('Sibling_Remarks', 'sibling_remarks'),
    ],
  },

  childuniform: {
    entity: 'childuniform',
    label: 'Uniform (ChildUniform)',
    table: 'childuniform',
    eacType: 'text',
    regType: 'int',
    fields: [
      f(['Village_name', 'Village_Name'], 'village_name'),
      f('ShirtSize', 'shirtsize'),
      f('KnickerSize', 'knickersize'),
      f('Pant_SkirtSize', 'pant_skirtsize'),
      f('ChudidharSize', 'chudidharsize'),
      f('Top_PantSize', 'top_pantsize'),
      f('FootwearSize', 'footwearsize'),
      f('Uniform_Updated', 'uniform_updated', 'date'),
    ],
  },

  childleaving: {
    entity: 'childleaving',
    label: 'Leaving (ChildLeaving)',
    table: 'childleaving',
    eacType: 'text',
    // childleaving.reg_no is varchar in our schema, unlike the other tables
    regType: 'text',
    fields: [
      f('Reason', 'reason'),
      f('Pass_Status', 'pass_status'),
      f('Leav_Class', 'leav_class'),
      f('Leav_Date', 'leav_date', 'date'),
      f('Leav_Addr1', 'leav_addr1'),
      f('Leav_Addr2', 'leav_addr2'),
      f('Leav_Addr3', 'leav_addr3'),
      f('Leav_Pincode', 'leav_pincode'),
      f('Leav_Remarks', 'leav_remarks'),
    ],
  },
}

/**
 * Excel/Access serialise dates as "days since 1899-12-30". A value that's
 * already an ISO-ish date string is passed through instead.
 */
export function coerceDate(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value)
    // Guard against a plain number that clearly isn't a date serial.
    if (serial < 1 || serial > 80000) return null
    const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000
    return new Date(ms).toISOString().slice(0, 10)
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10)
}

export function coerceInt(raw: string): number | null {
  const value = raw.trim()
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

function coerce(raw: string, type: FieldType): string | number | null {
  if (type === 'date') return coerceDate(raw)
  if (type === 'int') return coerceInt(raw)
  const value = raw.trim()
  return value === '' ? null : value
}

/**
 * Coerce a value that arrives already typed — i.e. straight out of the Access
 * file, where dates are Date objects, numbers are numbers and Yes/No columns
 * are booleans — rather than as a CSV string.
 */
export function coerceNative(raw: unknown, type: FieldType): string | number | boolean | null {
  if (raw === null || raw === undefined) return null

  if (type === 'bool') {
    if (typeof raw === 'boolean') return raw
    const s = String(raw).trim().toLowerCase()
    if (['true', '1', 'yes', 'y'].includes(s)) return true
    if (['false', '0', 'no', 'n'].includes(s)) return false
    return null
  }

  if (type === 'date') {
    if (raw instanceof Date) {
      return Number.isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10)
    }
    return coerceDate(String(raw))
  }

  if (type === 'int') {
    if (typeof raw === 'number') return Number.isFinite(raw) ? Math.trunc(raw) : null
    return coerceInt(String(raw))
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed === '' ? null : trimmed
  }
  if (raw instanceof Date) return raw.toISOString().slice(0, 10)
  return String(raw)
}

export interface TransformResult {
  rows: Record<string, any>[]
  /** Row-level problems that block those specific rows. */
  errors: { row: number; message: string }[]
  /** Header columns in the file that we don't map anywhere. */
  unmappedHeaders: string[]
  /** Distinct eac_no values seen, for the centre pre-check. */
  eacNos: number[]
}

/**
 * Turn parsed CSV (headers + rows of strings) into rows shaped for the table.
 * `eac_no` and `reg_no` are required on every row — together they're what
 * links a child across all five tables.
 */
export function transformRows(entity: ImportEntity, headers: string[], rows: string[][]): TransformResult {
  const spec = IMPORT_SPECS[entity]
  const norm = (s: string) => s.trim().toLowerCase()
  const index = new Map<string, number>()
  headers.forEach((h, i) => index.set(norm(h), i))

  const findCol = (names: string[]): number | undefined => {
    for (const n of names) {
      const i = index.get(norm(n))
      if (i !== undefined) return i
    }
    return undefined
  }

  const eacCol = findCol(['EAC_NO', 'EAC_No', 'eac_no'])
  const regCol = findCol(['Reg_No', 'REG_NO', 'reg_no'])

  const out: Record<string, any>[] = []
  const errors: { row: number; message: string }[] = []
  const eacSet = new Set<number>()

  const usedCols = new Set<number>()
  if (eacCol !== undefined) usedCols.add(eacCol)
  if (regCol !== undefined) usedCols.add(regCol)

  if (eacCol === undefined || regCol === undefined) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'File must contain both an EAC_No and a Reg_No column.' }],
      unmappedHeaders: [],
      eacNos: [],
    }
  }

  rows.forEach((cells, i) => {
    const rowNo = i + 2 // 1-based, +1 for the header line
    const rawEac = (cells[eacCol] ?? '').trim()
    const rawReg = (cells[regCol] ?? '').trim()

    if (!rawEac && !rawReg && cells.every((c) => !c || !c.trim())) return // skip blank line

    if (!rawEac || !rawReg) {
      errors.push({ row: rowNo, message: 'Missing EAC No or Reg No' })
      return
    }

    const eacNum = coerceInt(rawEac)
    if (eacNum === null) {
      errors.push({ row: rowNo, message: `EAC No "${rawEac}" is not a number` })
      return
    }
    eacSet.add(eacNum)

    const record: Record<string, any> = {
      eac_no: spec.eacType === 'int' ? eacNum : String(eacNum),
      reg_no: spec.regType === 'int' ? coerceInt(rawReg) : rawReg,
    }

    if (spec.regType === 'int' && record.reg_no === null) {
      errors.push({ row: rowNo, message: `Reg No "${rawReg}" is not a number` })
      return
    }

    for (const field of spec.fields) {
      const col = findCol(field.from)
      if (col === undefined) continue
      usedCols.add(col)
      const value = coerce(cells[col] ?? '', field.type)
      if (value !== null) record[field.to] = value
    }

    out.push(record)
  })

  const unmappedHeaders = headers.filter((h, i) => !usedCols.has(i) && h.trim() !== '')

  return { rows: out, errors, unmappedHeaders, eacNos: Array.from(eacSet).sort((a, b) => a - b) }
}

/**
 * Transform rows that arrive as objects with native types (from an .accdb
 * file) rather than as arrays of CSV strings.
 */
export function transformRecords(entity: ImportEntity, records: Record<string, unknown>[]): TransformResult {
  const spec = IMPORT_SPECS[entity]
  const errors: { row: number; message: string }[] = []
  const out: Record<string, any>[] = []
  const eacSet = new Set<number>()
  const usedKeys = new Set<string>()

  const norm = (s: string) => s.trim().toLowerCase()

  const pick = (record: Record<string, unknown>, names: string[]): unknown => {
    for (const n of names) {
      for (const key of Object.keys(record)) {
        if (norm(key) === norm(n)) {
          usedKeys.add(key)
          return record[key]
        }
      }
    }
    return undefined
  }

  records.forEach((record, i) => {
    const rowNo = i + 1
    const rawEac = pick(record, ['EAC_NO', 'EAC_No', 'eac_no'])
    const rawReg = pick(record, ['Reg_No', 'REG_NO', 'reg_no'])

    if (rawEac === null || rawEac === undefined || rawReg === null || rawReg === undefined) {
      errors.push({ row: rowNo, message: 'Missing EAC No or Reg No' })
      return
    }

    const eacNum = coerceNative(rawEac, 'int') as number | null
    if (eacNum === null) {
      errors.push({ row: rowNo, message: `EAC No "${String(rawEac)}" is not a number` })
      return
    }
    eacSet.add(eacNum)

    const regValue =
      spec.regType === 'int' ? (coerceNative(rawReg, 'int') as number | null) : String(rawReg).trim()

    if (spec.regType === 'int' && regValue === null) {
      errors.push({ row: rowNo, message: `Reg No "${String(rawReg)}" is not a number` })
      return
    }

    const mapped: Record<string, any> = {
      eac_no: spec.eacType === 'int' ? eacNum : String(eacNum),
      reg_no: regValue,
    }

    for (const field of spec.fields) {
      const value = coerceNative(pick(record, field.from), field.type)
      if (value !== null) mapped[field.to] = value
    }

    out.push(mapped)
  })

  const allKeys = new Set<string>()
  records.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)))
  const unmappedHeaders = Array.from(allKeys).filter(
    (k) => !usedKeys.has(k) && !['eac_no', 'reg_no'].includes(norm(k))
  )

  return { rows: out, errors, unmappedHeaders, eacNos: Array.from(eacSet).sort((a, b) => a - b) }
}

/** Map an Access table name to the entity it corresponds to. */
export function entityFromTableName(name: string): ImportEntity | null {
  const n = name.trim().toLowerCase()
  if (n === 'childinfo') return 'child_data'
  if (n === 'childfmly') return 'childfmly'
  if (n === 'childsibling') return 'childsibling'
  if (n === 'childuniform') return 'childuniform'
  if (n === 'childleaving') return 'childleaving'
  return null
}

/** Guess which table a file is for, from its headers. */
export function detectEntity(headers: string[]): ImportEntity | null {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()))
  if (set.has('leav_date') || set.has('pass_status') || set.has('leav_class')) return 'childleaving'
  if (set.has('shirtsize') || set.has('knickersize') || set.has('uniform_updated')) return 'childuniform'
  if (set.has('names_1') || set.has('class_occup_1')) return 'childsibling'
  if (set.has('f_name') || set.has('m_name') || set.has('fmly_addr1')) return 'childfmly'
  if (set.has('first_name') || set.has('dateofbirth') || set.has('adm_date')) return 'child_data'
  return null
}

/** Minimal RFC4180-ish CSV parser (handles quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // strip BOM
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < stripped.length; i += 1) {
    const ch = stripped[i]

    if (inQuotes) {
      if (ch === '"') {
        if (stripped[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const headers = rows.shift() ?? []
  return { headers, rows }
}
