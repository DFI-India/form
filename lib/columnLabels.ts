const COLUMN_LABEL_OVERRIDES: Record<string, string> = {
  eac_no: 'EAC Number',
  reg_no: 'Registration Number',
  village_name: 'Village Name',
  centre_id: 'Centre ID',
  adm_date: 'Admission Date',
  first_name: 'First Name',
  last_name: 'Last Name',
  gender: 'Gender',
  aadhar_no: 'Aadhaar Number',
  birth_place: 'Birth Place',
  blood_group: 'Blood Group',
  mother_tongue: 'Mother Tongue',
  class_std_text: 'Class Standard',
  school_name: 'School Name',
  school_category: 'School Category',
  sats_no: 'SATS Number',
  pen_no: 'PEN Number',
  medium_of_study: 'Medium of Study',
  life_ambition: 'Life Ambition',
  fav_subject: 'Favorite Subject',
  child_other_info: 'Child Other Info',
  photo_link: 'Photo',

  f_name: 'Father Name',
  f_occup: 'Father Occupation',
  f_aadhar: 'Father Aadhaar',
  f_mobile: 'Father Mobile',
  f_inc: 'Father Income',
  m_name: 'Mother Name',
  m_occup: 'Mother Occupation',
  m_aadhar: 'Mother Aadhaar',
  m_mobile: 'Mother Mobile',
  m_inc: 'Mother Income',
  fmly_addr1: 'Family Address Line 1',
  fmly_addr2: 'Family Address Line 2',
  fmly_addr3: 'Family Address Line 3',
  fmly_pincode: 'Family Pincode',
  fmly_remarks: 'Family Remarks',

  leav_class: 'Leaving Class',
  leav_date: 'Leaving Date',
  leav_addr1: 'Leaving Address Line 1',
  leav_addr2: 'Leaving Address Line 2',
  leav_addr3: 'Leaving Address Line 3',
  leav_pincode: 'Leaving Pincode',
  leav_remarks: 'Leaving Remarks',
  pass_status: 'Pass Status',

  shirtsize: 'Shirt Size',
  knickersize: 'Knicker Size',
  pant_skirtsize: 'Pant/Skirt Size',
  chudidharsize: 'Chudidhar Size',
  top_pantsize: 'Top/Pant Size',
  footwearsize: 'Footwear Size',
  uniform_updated: 'Uniform Updated On',

  trainee_name: 'Trainee Name',
  child_name: 'Child Name',
  date_of_birth: 'Date of Birth',
  dateofbirth: 'Date of Birth',
  class_standard: 'Class Standard',
  class_standard_studied: 'Class Standard Studied',
  father_occupation: 'Father Occupation',
  father_income: 'Father Income',
  father_phone: 'Father Phone',
  mother_occupation: 'Mother Occupation',
  mother_income: 'Mother Income',
  mother_phone: 'Mother Phone',
  parent_guardian_address: 'Parent/Guardian Address',
  enrolled_course: 'Enrolled Course',
  verification_done_by: 'Verification Done By',
  verified_date: 'Verified Date',
  overall_performance: 'Overall Performance',
  instructor_name: 'Instructor Name',
  social_worker_signature: 'Social Worker Signature',
  dfi_staff_signature: 'DFI Staff Signature',

  created_at: 'Created At',
  updated_at: 'Updated At',
  approved_at: 'Approved At',
  verified_at: 'Verified At',
  submitted_by: 'Submitted By',
  approved_by: 'Approved By',
  verified_by: 'Verified By',
  status: 'Status'
}

const BACKUP_SUFFIX_REGEX = /_(string|str|int|integer|bigint|smallint|numeric|float|double|decimal|bool|boolean|text)$/i

const SIBLING_COLUMN_REGEX = /^(names|ages|genders|class_occup)_(\d+)$/i

function titleCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function normalizeBackupSuffix(columnName: string): string {
  return columnName.replace(BACKUP_SUFFIX_REGEX, '')
}

function getSiblingLabel(columnName: string): string | null {
  const match = columnName.match(SIBLING_COLUMN_REGEX)
  if (!match) return null

  const [, group, index] = match
  const number = Number(index)

  if (group === 'names') return `Sibling ${number} Name`
  if (group === 'ages') return `Sibling ${number} Age`
  if (group === 'genders') return `Sibling ${number} Gender`
  if (group === 'class_occup') return `Sibling ${number} Class/Occupation`

  return null
}

export function getStandardColumnLabel(rawColumnName: string): string {
  const normalized = rawColumnName.trim().toLowerCase()

  const siblingLabel = getSiblingLabel(normalized)
  if (siblingLabel) return siblingLabel

  if (COLUMN_LABEL_OVERRIDES[normalized]) {
    return COLUMN_LABEL_OVERRIDES[normalized]
  }

  const withoutBackupSuffix = normalizeBackupSuffix(normalized)
  if (COLUMN_LABEL_OVERRIDES[withoutBackupSuffix]) {
    return COLUMN_LABEL_OVERRIDES[withoutBackupSuffix]
  }

  return titleCase(withoutBackupSuffix)
}
