/**
 * What the report builder can show, filter and group by.
 *
 * One entry per column of the reporting views in sql/005_report_views.sql. The
 * server checks names against the view itself, so this list decides what people
 * are offered, not what they are allowed — a field missing here simply never
 * appears in the picker.
 */

export type ReportSource = 'children' | 'vocational' | 'computer'
export type FieldType = 'text' | 'number' | 'date' | 'boolean'

export interface ReportField {
  key: string
  label: string
  group: string
  type: FieldType
  /** Offered as a grouping column. Free-text and identifiers are not. */
  groupable?: boolean
  /** Offered for sum and average. */
  summable?: boolean
  /** Shown in a new report before anything is chosen. */
  defaultColumn?: boolean
}

export interface SourceDefinition {
  key: ReportSource
  view: string
  label: string
  /** Plural noun for counts: "1,247 children". */
  noun: string
  fields: ReportField[]
}

const f = (
  key: string,
  label: string,
  group: string,
  type: FieldType,
  extra: Partial<ReportField> = {}
): ReportField => ({ key, label, group, type, ...extra })

const CHILD_FIELDS: ReportField[] = [
  // Identity
  f('child_name', 'Name', 'Child', 'text', { defaultColumn: true }),
  f('first_name', 'First name', 'Child', 'text'),
  f('last_name', 'Last name', 'Child', 'text'),
  f('gender', 'Gender', 'Child', 'text', { groupable: true, defaultColumn: true }),
  f('date_of_birth', 'Date of birth', 'Child', 'date'),
  f('age', 'Age', 'Child', 'number', { groupable: true, summable: true, defaultColumn: true }),
  f('aadhar_no', 'Aadhaar number', 'Child', 'text'),
  f('blood_group', 'Blood group', 'Child', 'text', { groupable: true }),
  f('health', 'Health notes', 'Child', 'text'),
  f('caste', 'Caste', 'Child', 'text', { groupable: true }),
  f('religion', 'Religion', 'Child', 'text', { groupable: true }),
  f('mother_tongue', 'Mother tongue', 'Child', 'text', { groupable: true }),
  f('birth_place', 'Place of birth', 'Child', 'text'),
  f('height', 'Height', 'Child', 'number', { summable: true }),
  f('weight', 'Weight', 'Child', 'number', { summable: true }),

  // School
  f('class_standard', 'Class', 'School', 'text', { groupable: true, defaultColumn: true }),
  f('school_name', 'School', 'School', 'text', { groupable: true }),
  f('school_category', 'School type', 'School', 'text', { groupable: true }),
  f('medium_of_study', 'Medium of study', 'School', 'text', { groupable: true }),
  f('sats_no', 'SATS number', 'School', 'number'),
  f('pen_no', 'PEN number', 'School', 'number'),
  f('life_ambition', 'Ambition', 'School', 'text', { groupable: true }),
  f('fav_subject', 'Favourite subject', 'School', 'text', { groupable: true }),
  f('admission_date', 'Admitted on', 'School', 'date'),

  // Place
  f('district', 'District', 'Place', 'text', { groupable: true, defaultColumn: true }),
  f('taluk', 'Taluk', 'Place', 'text', { groupable: true, defaultColumn: true }),
  f('panchayat', 'Panchayat', 'Place', 'text', { groupable: true }),
  f('village', 'Village', 'Place', 'text', { groupable: true, defaultColumn: true }),
  f('centre_village', 'Centre village', 'Place', 'text', { groupable: true }),
  f('place_from_master', 'Place is mapped', 'Place', 'boolean', { groupable: true }),

  // Centre
  f('eac_no', 'EAC number', 'Centre', 'number', { groupable: true, defaultColumn: true }),
  f('reg_no', 'Reg number', 'Centre', 'number', { defaultColumn: true }),
  f('cbv_name', 'CBV', 'Centre', 'text', { groupable: true }),
  f('in_charge', 'In charge', 'Centre', 'text', { groupable: true }),
  f('centre_started', 'Centre started', 'Centre', 'date'),
  f('centre_ended', 'Centre ended', 'Centre', 'date'),
  f('centre_closed', 'Centre closed', 'Centre', 'boolean', { groupable: true }),

  // Status
  f('enrolment', 'Enrolment', 'Status', 'text', { groupable: true, defaultColumn: true }),
  f('has_left', 'Has left', 'Status', 'boolean', { groupable: true }),
  f('approval_status', 'Approval', 'Status', 'text', { groupable: true, defaultColumn: true }),
  f('recorded_on', 'Recorded on', 'Status', 'date'),
  f('approved_at', 'Approved on', 'Status', 'date'),
  f('has_family', 'Family recorded', 'Status', 'boolean', { groupable: true }),
  f('has_siblings', 'Siblings recorded', 'Status', 'boolean', { groupable: true }),
  f('has_uniform', 'Uniform recorded', 'Status', 'boolean', { groupable: true }),
  f('has_leaving_record', 'Leaving recorded', 'Status', 'boolean', { groupable: true }),
  f('sections_complete', 'All sections filled', 'Status', 'boolean', { groupable: true }),

  // Family
  f('father_name', "Father's name", 'Family', 'text'),
  f('father_occupation', "Father's occupation", 'Family', 'text', { groupable: true }),
  f('father_income', "Father's income", 'Family', 'number', { summable: true }),
  f('father_mobile', "Father's mobile", 'Family', 'text'),
  f('mother_name', "Mother's name", 'Family', 'text'),
  f('mother_occupation', "Mother's occupation", 'Family', 'text', { groupable: true }),
  f('mother_income', "Mother's income", 'Family', 'number', { summable: true }),
  f('mother_mobile', "Mother's mobile", 'Family', 'text'),
  f('household_income', 'Household income', 'Family', 'number', { summable: true }),
  f('family_address', 'Address', 'Family', 'text'),
  f('family_pincode', 'Pincode', 'Family', 'text', { groupable: true }),
  f('sibling_count', 'Number of siblings', 'Family', 'number', { groupable: true, summable: true }),

  // Uniform
  f('shirt_size', 'Shirt size', 'Uniform', 'text', { groupable: true }),
  f('knicker_size', 'Knicker size', 'Uniform', 'text', { groupable: true }),
  f('pant_skirt_size', 'Pant or skirt size', 'Uniform', 'text', { groupable: true }),
  f('chudidhar_size', 'Chudidhar size', 'Uniform', 'text', { groupable: true }),
  f('top_pant_size', 'Top and pant size', 'Uniform', 'text', { groupable: true }),
  f('footwear_size', 'Footwear size', 'Uniform', 'text', { groupable: true }),
  f('uniform_measured_on', 'Sizes taken on', 'Uniform', 'date'),

  // Leaving
  f('leaving_date', 'Left on', 'Leaving', 'date'),
  f('leaving_reason', 'Reason for leaving', 'Leaving', 'text', { groupable: true }),
  f('class_when_leaving', 'Class when leaving', 'Leaving', 'text', { groupable: true }),
  f('pass_status', 'Pass or drop out', 'Leaving', 'text', { groupable: true }),
]

const VOCATIONAL_FIELDS: ReportField[] = [
  f('trainee_name', 'Name', 'Trainee', 'text', { defaultColumn: true }),
  f('gender', 'Gender', 'Trainee', 'text', { groupable: true, defaultColumn: true }),
  f('date_of_birth', 'Date of birth', 'Trainee', 'date'),
  f('age', 'Age', 'Trainee', 'number', { groupable: true, summable: true, defaultColumn: true }),
  f('religion', 'Religion', 'Trainee', 'text', { groupable: true }),
  f('caste', 'Caste', 'Trainee', 'text', { groupable: true }),
  f('mother_tongue', 'Mother tongue', 'Trainee', 'text', { groupable: true }),
  f('class_standard', 'Class studied', 'Trainee', 'text', { groupable: true }),
  f('school_name', 'School', 'Trainee', 'text', { groupable: true }),
  f('medium_of_study', 'Medium of study', 'Trainee', 'text', { groupable: true }),
  f('course', 'Course', 'Course', 'text', { groupable: true, defaultColumn: true }),
  f('batch_no', 'Batch', 'Course', 'text', { groupable: true }),
  f('admission_date', 'Admitted on', 'Course', 'date', { defaultColumn: true }),
  f('present_status', 'Present status', 'Course', 'text', { groupable: true, defaultColumn: true }),
  f('plan_after_course', 'Plan after course', 'Course', 'text', { groupable: true }),
  f('outcome', 'Education or employment', 'Course', 'text', { groupable: true }),
  f('reason_for_leaving', 'Reason for leaving', 'Course', 'text', { groupable: true }),
  f('leaving_date', 'Left on', 'Course', 'date'),
  f('father_name', "Father's name", 'Family', 'text'),
  f('father_occupation', "Father's occupation", 'Family', 'text', { groupable: true }),
  f('father_income', "Father's income", 'Family', 'number', { summable: true }),
  f('mother_name', "Mother's name", 'Family', 'text'),
  f('mother_occupation', "Mother's occupation", 'Family', 'text', { groupable: true }),
  f('mother_income', "Mother's income", 'Family', 'number', { summable: true }),
  f('household_income', 'Household income', 'Family', 'number', { summable: true }),
  f('district', 'District', 'Place', 'text', { groupable: true, defaultColumn: true }),
  f('taluk', 'Taluk', 'Place', 'text', { groupable: true }),
  f('panchayat', 'Panchayat', 'Place', 'text', { groupable: true }),
  f('village', 'Village', 'Place', 'text', { groupable: true }),
  f('eac_no', 'EAC number', 'Centre', 'number', { groupable: true, defaultColumn: true }),
  f('reg_no', 'Reg number', 'Centre', 'text'),
  f('approval_status', 'Approval', 'Status', 'text', { groupable: true }),
  f('recorded_on', 'Recorded on', 'Status', 'date'),
]

const COMPUTER_FIELDS: ReportField[] = [
  f('child_name', 'Name', 'Student', 'text', { defaultColumn: true }),
  f('gender', 'Gender', 'Student', 'text', { groupable: true, defaultColumn: true }),
  f('date_of_birth', 'Date of birth', 'Student', 'date'),
  f('age', 'Age', 'Student', 'number', { groupable: true, summable: true, defaultColumn: true }),
  f('class_standard', 'Class', 'Student', 'text', { groupable: true }),
  f('school_name', 'School', 'Student', 'text', { groupable: true }),
  f('school_type', 'School type', 'Student', 'text', { groupable: true }),
  f('prior_computer_knowledge', 'Knew computers before', 'Student', 'boolean', { groupable: true }),
  f('course', 'Course', 'Course', 'text', { groupable: true, defaultColumn: true }),
  f('batch_no', 'Batch', 'Course', 'text', { groupable: true }),
  f('admission_date', 'Admitted on', 'Course', 'date', { defaultColumn: true }),
  f('completion_date', 'Completed on', 'Course', 'date'),
  f('attendance_percentage', 'Attendance %', 'Course', 'number', { summable: true, defaultColumn: true }),
  f('final_assessment_score', 'Final score', 'Course', 'number', { summable: true, defaultColumn: true }),
  f('overall_performance', 'Performance', 'Course', 'text', { groupable: true }),
  f('certificate_issued_on', 'Certificate issued', 'Course', 'date'),
  f('instructor_name', 'Instructor', 'Course', 'text', { groupable: true }),
  f('father_occupation', "Father's occupation", 'Family', 'text', { groupable: true }),
  f('father_income', "Father's income", 'Family', 'number', { summable: true }),
  f('mother_occupation', "Mother's occupation", 'Family', 'text', { groupable: true }),
  f('mother_income', "Mother's income", 'Family', 'number', { summable: true }),
  f('household_income', 'Household income', 'Family', 'number', { summable: true }),
  f('district', 'District', 'Place', 'text', { groupable: true }),
  f('taluk', 'Taluk', 'Place', 'text', { groupable: true }),
  f('panchayat', 'Panchayat', 'Place', 'text', { groupable: true }),
  f('village', 'Village', 'Place', 'text', { groupable: true }),
  f('eac_no', 'EAC number', 'Centre', 'text', { groupable: true, defaultColumn: true }),
  f('reg_no', 'Reg number', 'Centre', 'text'),
  f('approval_status', 'Approval', 'Status', 'text', { groupable: true }),
  f('recorded_on', 'Recorded on', 'Status', 'date'),
]

export const REPORT_SOURCES: Record<ReportSource, SourceDefinition> = {
  children: { key: 'children', view: 'v_child_report', label: 'Children', noun: 'children', fields: CHILD_FIELDS },
  vocational: {
    key: 'vocational',
    view: 'v_vocational_report',
    label: 'Vocational course',
    noun: 'trainees',
    fields: VOCATIONAL_FIELDS,
  },
  computer: {
    key: 'computer',
    view: 'v_computer_report',
    label: 'Computer course',
    noun: 'students',
    fields: COMPUTER_FIELDS,
  },
}

export const isReportSource = (v: unknown): v is ReportSource =>
  typeof v === 'string' && v in REPORT_SOURCES

export const fieldsOf = (source: ReportSource) => REPORT_SOURCES[source].fields

export const fieldMap = (source: ReportSource) =>
  new Map(fieldsOf(source).map((field) => [field.key, field]))

/** Filter comparisons offered per field type. */
export const OPERATORS: Record<FieldType, { value: string; label: string; args: 0 | 1 | 2 }[]> = {
  text: [
    { value: 'eq', label: 'is', args: 1 },
    { value: 'neq', label: 'is not', args: 1 },
    { value: 'contains', label: 'contains', args: 1 },
    { value: 'is_null', label: 'is blank', args: 0 },
    { value: 'not_null', label: 'is not blank', args: 0 },
  ],
  number: [
    { value: 'eq', label: 'is', args: 1 },
    { value: 'gte', label: 'is at least', args: 1 },
    { value: 'lte', label: 'is at most', args: 1 },
    { value: 'between', label: 'is between', args: 2 },
    { value: 'is_null', label: 'is blank', args: 0 },
    { value: 'not_null', label: 'is not blank', args: 0 },
  ],
  date: [
    { value: 'gte', label: 'on or after', args: 1 },
    { value: 'lte', label: 'on or before', args: 1 },
    { value: 'between', label: 'between', args: 2 },
    { value: 'is_null', label: 'is blank', args: 0 },
    { value: 'not_null', label: 'is not blank', args: 0 },
  ],
  boolean: [
    { value: 'eq', label: 'is', args: 1 },
  ],
}
