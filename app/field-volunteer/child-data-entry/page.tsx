'use client'

import {
  useState,
  useEffect,
  useRef,
  type ChangeEvent,
  type ChangeEventHandler,
  type HTMLInputTypeAttribute,
} from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../../lib/supabase'
import { useRequireRole } from '../../../lib/hooks'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { LoadingSpinner } from '../../components/UI'
import { User, Users, Shirt, LogOut, BookOpen, Laptop, AlertCircle, History, ChevronRight, Check, X } from 'lucide-react'
import { ROLE_CONFIG } from '../../../lib/types'

type TabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving' | 'vocational' | 'computer' | 'rejected'
type RejectedSubTabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving' | 'vocational' | 'computer'
type WizardStepType = 'child' | 'family' | 'sibling' | 'uniform'

type CentreOption = {
  eac_no: string | number
  village_name?: string | null
  centre_id?: string | null
  district?: string | null
  taluk?: string | null
  panchayat?: string | null
  village?: string | null
}

type RejectedChildRecord = {
  record_id: number
  approval_id: string
  eac_no: number
  reg_no: number
  first_name: string
  last_name: string
  gender: string
  aadhar_no: number
  birth_place: string
  height: number
  weight: number
  blood_group: string
  health: string
  caste: string
  mother_tongue: string
  class_std_text: string
  school_name: string
  school_category: string
  sats_no: number
  pen_no: number
  medium_of_study: string
  life_ambition: string
  fav_subject: string
  child_other_info: string
  photo_link: string
  rejection_reason?: string
  rejected_at?: string
}

type RejectedFamilyRecord = {
  record_id: number
  approval_id: string
  eac_no: string
  reg_no: string
  f_name: string
  f_occup: string
  f_inc: number | null
  f_aadhar: string
  f_mobile: string
  m_name: string
  m_occup: string
  m_inc: number | null
  m_aadhar: string
  m_mobile: string
  fmly_addr1: string
  fmly_addr2: string
  fmly_addr3: string
  fmly_pincode: string
  fmly_remarks: string
  rejection_reason?: string
  rejected_at?: string
}

type RejectedSiblingRecord = {
  record_id: number
  approval_id: string
  eac_no: string
  reg_no: string
  names_1: string
  ages_1: number | null
  genders_1: string
  class_occup_1: string
  names_2: string
  ages_2: number | null
  genders_2: string
  class_occup_2: string
  names_3: string
  ages_3: number | null
  genders_3: string
  class_occup_3: string
  names_4: string
  ages_4: number | null
  genders_4: string
  class_occup_4: string
  names_5: string
  ages_5: number | null
  genders_5: string
  class_occup_5: string
  sibling_remarks: string
  rejection_reason?: string
  rejected_at?: string
}

type RejectedUniformRecord = {
  record_id: number
  approval_id: string
  eac_no: string
  reg_no: string
  shirtsize: string
  knickersize: string
  pant_skirtsize: string
  chudidharsize: string
  top_pantsize: string
  footwearsize: string
  uniform_updated: string | null
  rejection_reason?: string
  rejected_at?: string
}

type RejectedLeavingRecord = {
  record_id: number
  approval_id: string
  eac_no: string
  reg_no: string
  reason: string
  pass_status: string
  leav_class: string
  leav_date: string | null
  leav_addr1: string
  leav_addr2: string
  leav_addr3: string
  leav_pincode: string
  leav_remarks: string
  rejection_reason?: string
  rejected_at?: string
}

type RejectedVocationalRecord = {
  record_id: number | string
  approval_id: number | string | null
  eac_no: string
  reg_no: string
  trainee_name?: string
  reason: string
  rejection_reason?: string
  rejected_at?: string
}

// computer course rejection records are very similar to vocational but
// include the trainee/child name so it can be shown in the table.
type RejectedComputerRecord = {
  record_id: number
  approval_id: string
  eac_no: string
  reg_no: string
  child_name: string
  rejection_reason?: string
  rejected_at?: string
}

type FormState = {
  eac_no: string
  village_name: string
  centre_id: string
  district: string
  taluk: string
  panchayat: string
  village: string
  adm_date: string
  dateofbirth: string
  reg_no: string
  first_name: string
  last_name: string
  gender: string
  religion: string
  aadhar_no: string
  birth_place: string
  height: string
  weight: string
  blood_group: string
  health: string
  caste: string
  mother_tongue: string
  class_std_text: string
  school_name: string
  school_category: string
  sats_no: string
  pen_no: string
  medium_of_study: string
  life_ambition: string
  fav_subject: string
  child_other_info: string
  photo_link: string
}

type HistoryRow = FormState & { record_id?: number }

type ChildFamilyState = {
  village_name: string
  eac_no: string
  reg_no: string
  f_name: string
  f_occup: string
  f_inc: string
  f_aadhar: string
  f_mobile: string
  m_name: string
  m_occup: string
  m_inc: string
  m_aadhar: string
  m_mobile: string
  fmly_addr1: string
  fmly_addr2: string
  fmly_addr3: string
  fmly_pincode: string
  fmly_remarks: string
}

type ChildSiblingState = {
  village_name: string
  eac_no: string
  reg_no: string
  names_1: string
  ages_1: string
  genders_1: string
  class_occup_1: string
  names_2: string
  ages_2: string
  genders_2: string
  class_occup_2: string
  names_3: string
  ages_3: string
  genders_3: string
  class_occup_3: string
  names_4: string
  ages_4: string
  genders_4: string
  class_occup_4: string
  names_5: string
  ages_5: string
  genders_5: string
  class_occup_5: string
  sibling_remarks: string
}

type ChildUniformState = {
  village_name: string
  eac_no: string
  reg_no: string
  shirtsize: string
  knickersize: string
  pant_skirtsize: string
  chudidharsize: string
  top_pantsize: string
  footwearsize: string
  uniform_updated: string
}

type ChildLeavingState = {
  eac_no: string
  reg_no: string
  reason: string
  pass_status: string
  leav_class: string
  leav_date: string
  leav_addr1: string
  leav_addr2: string
  leav_addr3: string
  leav_pincode: string
  leav_remarks: string
}

type VocationalCourseState = {
  date_of_admission: string
  eac_no: string
  reg_no: string
  batch_no: string
  batch_timings: string
  centre_no: string
  district: string
  taluk: string
  panchayat: string
  village: string
  trainee_name: string
  gender: string
  aadhar_no: string
  date_of_birth: string
  place_of_birth: string
  blood_group: string
  marital_status: string
  mother_tongue: string
  religion: string
  caste: string
  class_standard_studied: string
  school_name: string
  medium_of_study: string
  ambition_in_life: string
  favourite_subject: string
  other_information: string
  father_or_husband_name: string
  father_occupation: string
  father_income: string
  father_aadhar_no: string
  father_mobile: string
  mother_name: string
  mother_occupation: string
  mother_income: string
  mother_aadhar_no: string
  mother_mobile: string
  parent_guardian_address: string
  enrolled_course: string
  attended_other_training: string
  previous_training_details: string
  plan_after_course: string
  present_status: string
  education_training_employment: string
  reason_for_leaving: string
  leaving_date: string
  present_address: string
  recommended_by: string
  recommended_date: string
  trainee_signature_date: string
  parent_guardian_name: string
  parent_guardian_signature_date: string
  verified_by_social_worker: string
  verified_by_dfi_staff: string
  photo_link: string
}

type ComputerCourseState = {
  batch_no: string
  batch_timings: string
  date_of_admission: string
  reg_no: string
  eac_no: string
  child_name: string
  gender: string
  aadhar_no: string
  date_of_birth: string
  class_standard: string
  school_name: string
  school_type: string
  prior_computer_knowledge: string
  father_occupation: string
  father_income: string
  father_phone: string
  mother_occupation: string
  mother_income: string
  mother_phone: string
  guardian_address: string
  consent_details_confirmed: string
  consent_course_participation: string
  consent_pickup_drop: string
  consent_date: string
  guardian_signature_name: string
  verified_by: string
  verified_date: string
  course_name: string
  completion_date: string
  attendance_percentage: string
  final_assessment_score: string
  overall_performance: string
  instructor_name: string
  certificate_issued_on: string
  social_worker_signature: string
  dfi_staff_signature: string
  photo_link: string
}

type MessageState = { type: 'success' | 'error'; text: string } | null

const createEmptyForm = (): FormState => ({
  eac_no: '',
  village_name: '',
  centre_id: '',
  district: '',
  taluk: '',
  panchayat: '',
  village: '',
  adm_date: '',
  dateofbirth: '',
  reg_no: '',
  first_name: '',
  last_name: '',
  gender: '',
  religion: '',
  aadhar_no: '',
  birth_place: '',
  height: '',
  weight: '',
  blood_group: '',
  health: '',
  caste: '',
  mother_tongue: '',
  class_std_text: '',
  school_name: '',
  school_category: '',
  sats_no: '',
  pen_no: '',
  medium_of_study: '',
  life_ambition: '',
  fav_subject: '',
  child_other_info: '',
  photo_link: ''
})

const createEmptyFamilyForm = (): ChildFamilyState => ({
  village_name: '',
  eac_no: '',
  reg_no: '',
  f_name: '',
  f_occup: '',
  f_inc: '',
  f_aadhar: '',
  f_mobile: '',
  m_name: '',
  m_occup: '',
  m_inc: '',
  m_aadhar: '',
  m_mobile: '',
  fmly_addr1: '',
  fmly_addr2: '',
  fmly_addr3: '',
  fmly_pincode: '',
  fmly_remarks: ''
})

const createEmptySiblingForm = (): ChildSiblingState => ({
  village_name: '',
  eac_no: '',
  reg_no: '',
  names_1: '',
  ages_1: '',
  genders_1: '',
  class_occup_1: '',
  names_2: '',
  ages_2: '',
  genders_2: '',
  class_occup_2: '',
  names_3: '',
  ages_3: '',
  genders_3: '',
  class_occup_3: '',
  names_4: '',
  ages_4: '',
  genders_4: '',
  class_occup_4: '',
  names_5: '',
  ages_5: '',
  genders_5: '',
  class_occup_5: '',
  sibling_remarks: ''
})

const createEmptyUniformForm = (): ChildUniformState => ({
  village_name: '',
  eac_no: '',
  reg_no: '',
  shirtsize: '',
  knickersize: '',
  pant_skirtsize: '',
  chudidharsize: '',
  top_pantsize: '',
  footwearsize: '',
  uniform_updated: ''
})

const createEmptyLeavingForm = (): ChildLeavingState => ({
  eac_no: '',
  reg_no: '',
  reason: '',
  pass_status: '',
  leav_class: '',
  leav_date: '',
  leav_addr1: '',
  leav_addr2: '',
  leav_addr3: '',
  leav_pincode: '',
  leav_remarks: ''
})

const createEmptyVocationalCourseForm = (): VocationalCourseState => ({
  date_of_admission: '',
  eac_no: '',
  reg_no: '',
  batch_no: '',
  batch_timings: '',
  centre_no: '',
  district: '',
  taluk: '',
  panchayat: '',
  village: '',
  trainee_name: '',
  gender: '',
  aadhar_no: '',
  date_of_birth: '',
  place_of_birth: '',
  blood_group: '',
  marital_status: '',
  mother_tongue: '',
  religion: '',
  caste: '',
  class_standard_studied: '',
  school_name: '',
  medium_of_study: '',
  ambition_in_life: '',
  favourite_subject: '',
  other_information: '',
  father_or_husband_name: '',
  father_occupation: '',
  father_income: '',
  father_aadhar_no: '',
  father_mobile: '',
  mother_name: '',
  mother_occupation: '',
  mother_income: '',
  mother_aadhar_no: '',
  mother_mobile: '',
  parent_guardian_address: '',
  enrolled_course: '',
  attended_other_training: '',
  previous_training_details: '',
  plan_after_course: '',
  present_status: '',
  education_training_employment: '',
  reason_for_leaving: '',
  leaving_date: '',
  present_address: '',
  recommended_by: '',
  recommended_date: '',
  trainee_signature_date: '',
  parent_guardian_name: '',
  parent_guardian_signature_date: '',
  verified_by_social_worker: '',
  verified_by_dfi_staff: '',
  photo_link: ''
})

const createEmptyComputerCourseForm = (): ComputerCourseState => ({
  batch_no: '',
  batch_timings: '',
  date_of_admission: '',
  reg_no: '',
  eac_no: '',
  child_name: '',
  gender: '',
  aadhar_no: '',
  date_of_birth: '',
  class_standard: '',
  school_name: '',
  school_type: '',
  prior_computer_knowledge: '',
  father_occupation: '',
  father_income: '',
  father_phone: '',
  mother_occupation: '',
  mother_income: '',
  mother_phone: '',
  guardian_address: '',
  consent_details_confirmed: '',
  consent_course_participation: '',
  consent_pickup_drop: '',
  consent_date: '',
  guardian_signature_name: '',
  verified_by: '',
  verified_date: '',
  course_name: '',
  completion_date: '',
  attendance_percentage: '',
  final_assessment_score: '',
  overall_performance: '',
  instructor_name: '',
  certificate_issued_on: '',
  social_worker_signature: '',
  dfi_staff_signature: '',
  photo_link: ''
})

const genderOptions = ['Male', 'Female', 'Other']
const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const religionOptions = ['Hindu', 'Muslim', 'Christian', 'Jain', 'Buddhist', 'Other']
const passStatusOptions = ['Pass', 'Drop Out']
const classStandardOptions = [
  '1st Class',
  '2nd Class',
  '3rd Class',
  '4th Class',
  '5th Class',
  '6th Class',
  '7th Class',
  '8th Class',
  '9th Class',
  '10th Class',
  '11th Class',
  '12th Class',
  'Other',
]
const vocationalCourseOptions = ['Tailoring', 'Beautician', 'Kuchi/Embroidery', 'Driving']

const uniqueTextValues = (rows: any[], key: string): string[] => {
  const values = (rows || [])
    .map((row) => row?.[key])
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim())

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}

const todayIsoDate = new Date().toISOString().split('T')[0]

const CHILD_DRAFT_STORAGE_PREFIX = 'fv-child-entry-draft-v1'
const CHILD_DRAFT_LATEST_REG_KEY = 'fv-child-entry-draft-latest-reg'

type ChildEntryDraft = {
  savedAt: string
  wizardStep: number
  formData: FormState
  familyData: ChildFamilyState
  siblingData: ChildSiblingState
  uniformData: ChildUniformState
}

type ChildDraftSummary = {
  regNo: string
  savedAt: string
}

export default function ChildForm() {
  const router = useRouter()
  const finalSubmitArmedRef = useRef(false)
  const [activeTab, setActiveTab] = useState<TabType | null>(null)
  const [entryGate, setEntryGate] = useState<'idle' | 'chooser' | 'form'>('idle')
  const [wizardStep, setWizardStep] = useState(0)
  const [eacOptions, setEacOptions] = useState<CentreOption[]>([])

  // Child form state
  const [formData, setFormData] = useState<FormState>(() => createEmptyForm())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [photoInputKey, setPhotoInputKey] = useState(() => Date.now())

  // Family form state
  const [familyData, setFamilyData] = useState<ChildFamilyState>(() => createEmptyFamilyForm())
  const [familyLoading, setFamilyLoading] = useState(false)
  const [familyMessage, setFamilyMessage] = useState<MessageState>(null)

  // Sibling form state
  const [siblingData, setSiblingData] = useState<ChildSiblingState>(() => createEmptySiblingForm())
  const [siblingLoading, setSiblingLoading] = useState(false)
  const [siblingMessage, setSiblingMessage] = useState<MessageState>(null)

  // Uniform form state
  const [uniformData, setUniformData] = useState<ChildUniformState>(() => createEmptyUniformForm())
  const [uniformLoading, setUniformLoading] = useState(false)
  const [uniformMessage, setUniformMessage] = useState<MessageState>(null)

  // Leaving form state
  const [leavingData, setLeavingData] = useState<ChildLeavingState>(() => createEmptyLeavingForm())
  const [leavingLoading, setLeavingLoading] = useState(false)
  const [leavingMessage, setLeavingMessage] = useState<MessageState>(null)

  // Vocational Course form state
  const [vocationalData, setVocationalData] = useState<VocationalCourseState>(() => createEmptyVocationalCourseForm())
  const [vocationalLoading, setVocationalLoading] = useState(false)
  const [vocationalMessage, setVocationalMessage] = useState<MessageState>(null)
  const [vocationalPhotoFile, setVocationalPhotoFile] = useState<File | null>(null)
  const [vocationalPhotoPreview, setVocationalPhotoPreview] = useState<string>('')
  const [vocationalPhotoUploading, setVocationalPhotoUploading] = useState(false)

  // Computer Course form state
  const [computerData, setComputerData] = useState<ComputerCourseState>(() => createEmptyComputerCourseForm())
  const [computerLoading, setComputerLoading] = useState(false)
  const [computerMessage, setComputerMessage] = useState<MessageState>(null)
  const [computerPhotoFile, setComputerPhotoFile] = useState<File | null>(null)
  const [computerPhotoPreview, setComputerPhotoPreview] = useState<string>('')
  const [computerPhotoUploading, setComputerPhotoUploading] = useState(false)

  // Submission guard states for new forms
  const [isSubmittingVocational, setIsSubmittingVocational] = useState(false)
  const [isSubmittingComputer, setIsSubmittingComputer] = useState(false)

  // Rejected data state
  const [activeRejectedSubTab, setActiveRejectedSubTab] = useState<RejectedSubTabType>('child')
  const [rejectedChildData, setRejectedChildData] = useState<RejectedChildRecord[]>([])
  const [rejectedFamilyData, setRejectedFamilyData] = useState<RejectedFamilyRecord[]>([])
  const [rejectedSiblingData, setRejectedSiblingData] = useState<RejectedSiblingRecord[]>([])
  const [rejectedUniformData, setRejectedUniformData] = useState<RejectedUniformRecord[]>([])
  const [rejectedLeavingData, setRejectedLeavingData] = useState<RejectedLeavingRecord[]>([])
  const [rejectedVocationalData, setRejectedVocationalData] = useState<RejectedVocationalRecord[]>([])
  const [rejectedComputerData, setRejectedComputerData] = useState<RejectedComputerRecord[]>([])
  const [rejectedLoading, setRejectedLoading] = useState(false)
  const [rejectedMessage, setRejectedMessage] = useState<MessageState>(null)

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editModalType, setEditModalType] = useState<RejectedSubTabType>('child')
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [editFormData, setEditFormData] = useState<any>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string>('')
  const [editPhotoInputKey, setEditPhotoInputKey] = useState(() => Date.now())

  // Personal history state
  const [historyData, setHistoryData] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyMessage, setHistoryMessage] = useState<MessageState>(null)

  // Personal history subtabs state
  type HistorySubTabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving'
  const [activeHistorySubTab, setActiveHistorySubTab] = useState<HistorySubTabType>('child')

  // History data for each type
  const [historyChildData, setHistoryChildData] = useState<any[]>([])
  const [historyFamilyData, setHistoryFamilyData] = useState<any[]>([])
  const [historySiblingData, setHistorySiblingData] = useState<any[]>([])
  const [historyUniformData, setHistoryUniformData] = useState<any[]>([])
  const [historyLeavingData, setHistoryLeavingData] = useState<any[]>([])

  // Date range filters for each type
  const [historyChildDateRange, setHistoryChildDateRange] = useState({ start: '', end: '' })
  const [historyFamilyDateRange, setHistoryFamilyDateRange] = useState({ start: '', end: '' })
  const [historySiblingDateRange, setHistorySiblingDateRange] = useState({ start: '', end: '' })
  const [historyUniformDateRange, setHistoryUniformDateRange] = useState({ start: '', end: '' })
  const [historyLeavingDateRange, setHistoryLeavingDateRange] = useState({ start: '', end: '' })

  // Loading states for history subtabs
  const [historyChildLoading, setHistoryChildLoading] = useState(false)
  const [historyFamilyLoading, setHistoryFamilyLoading] = useState(false)
  const [historySiblingLoading, setHistorySiblingLoading] = useState(false)
  const [historyUniformLoading, setHistoryUniformLoading] = useState(false)
  const [historyLeavingLoading, setHistoryLeavingLoading] = useState(false)

  // Submission guard states (prevent duplicate submissions)
  const [isSubmittingChild, setIsSubmittingChild] = useState(false)
  const [isSubmittingFamily, setIsSubmittingFamily] = useState(false)
  const [isSubmittingSibling, setIsSubmittingSibling] = useState(false)
  const [isSubmittingUniform, setIsSubmittingUniform] = useState(false)
  const [isSubmittingLeaving, setIsSubmittingLeaving] = useState(false)
  const [isSubmittingUnified, setIsSubmittingUnified] = useState(false)
  const [draftExistsForRegNo, setDraftExistsForRegNo] = useState(false)
  const [childDraftSummaries, setChildDraftSummaries] = useState<ChildDraftSummary[]>([])

  const [checkedAuth, setCheckedAuth] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [mediumOfStudyOptions, setMediumOfStudyOptions] = useState<string[]>([])
  const [lifeAmbitionOptions, setLifeAmbitionOptions] = useState<string[]>([])
  const [favSubjectOptions, setFavSubjectOptions] = useState<string[]>([])
  const [fatherOccupationOptions, setFatherOccupationOptions] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true

    const verifySession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!isMounted) return

      const hasSession = Boolean(data.session)
      setAuthorized(hasSession)
      setCheckedAuth(true)

      if (!hasSession) {
        router.replace('/sign-in')
      }
    }

    verifySession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return

      const hasSession = Boolean(session)
      setAuthorized(hasSession)
      if (!hasSession) {
        router.replace('/sign-in')
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    if (!authorized) return
    fetchEacData()
    fetchChildFormOptions()
  }, [authorized])

  const fetchEacData = async () => {
    try {
      // Pull centre metadata once so dependent fields can auto-fill.
      const { data, error } = await supabase
        .from('centre_data')
        .select('*')

      if (error) throw error
      setEacOptions((data as CentreOption[]) ?? [])
    } catch (error) {
      console.error('Error fetching EAC data:', error)
      setMessage({ type: 'error', text: 'Unable to load centre details. Please refresh.' })
    }
  }

  const fetchChildFormOptions = async () => {
    try {
      const [{ data: childData, error: childError }, { data: familyDataRows, error: familyError }] = await Promise.all([
        supabase
          .from('Child_Data')
          .select('medium_of_study, life_ambition, fav_subject'),
        supabase
          .from('childfmly')
          .select('f_occup')
      ])

      if (childError) throw childError
      if (familyError) throw familyError

      setMediumOfStudyOptions(uniqueTextValues(childData || [], 'medium_of_study'))
      setLifeAmbitionOptions(uniqueTextValues(childData || [], 'life_ambition'))
      setFavSubjectOptions(uniqueTextValues(childData || [], 'fav_subject'))
      setFatherOccupationOptions(uniqueTextValues(familyDataRows || [], 'f_occup'))
    } catch (error) {
      console.error('Error fetching child form dropdown options:', error)
    }
  }

  const fetchRejectedData = async (subTabType: RejectedSubTabType) => {
    setRejectedLoading(true)
    setRejectedMessage(null)

    try {
      let viewName = ''
      let setter: any = null
      let entityType = ''

      switch (subTabType) {
        case 'child':
          viewName = 'childdata_rejected_for_volunteer'
          setter = setRejectedChildData
          entityType = 'Child_Data'
          break
        case 'family':
          viewName = 'childfmly_rejected_for_volunteer'
          setter = setRejectedFamilyData
          entityType = 'childfmly'
          break
        case 'sibling':
          viewName = 'childsibling_rejected_for_volunteer'
          setter = setRejectedSiblingData
          entityType = 'childsibling'
          break
        case 'uniform':
          viewName = 'childuniform_rejected_for_volunteer'
          setter = setRejectedUniformData
          entityType = 'childuniform'
          break
        case 'leaving':
          viewName = 'childleaving_rejected_for_volunteer'
          setter = setRejectedLeavingData
          entityType = 'childleaving'
          break
        case 'vocational':
          viewName = 'vocational_course_rejected_for_volunteers'
          setter = setRejectedVocationalData
          entityType = 'vocational_course'
          break
        case 'computer':
          viewName = 'computer_course_rejected_for_volunteers'
          setter = setRejectedComputerData
          entityType = 'computer_course'
          break
      }

      const { data, error } = await supabase
        .from(viewName)
        .select('*')

      if (error) throw error

      // Fetch approval IDs for these records
      // Handle both record_id (for child/family/sibling/uniform/leaving) and id (for vocational/computer)
      const recordIds = (data ?? []).map((r: any) => r.record_id ?? r.id).filter((id: any) => id !== undefined && id !== null)
      if (recordIds.length === 0) {
        setter([])
        return
      }

      // Use different approval tables based on entity type
      const approvalTableName = ['vocational_course', 'computer_course'].includes(entityType)
        ? 'vocational_training_approvals'
        : 'child_approvals'

      const { data: approvals, error: approvalsError } = await supabase
        .from(approvalTableName)
        .select('id, entity_id')
        .eq('entity_type', entityType)
        .in('entity_id', recordIds)

      if (approvalsError) throw approvalsError

      // Create a map of entity_id -> approval id
      const approvalMap = new Map(
        (approvals ?? []).map((a: any) => [a.entity_id, a.id])
      )

      // Add approval_id to each record and ensure record_id field exists
      const enrichedData = (data ?? []).map((record: any) => ({
        ...record,
        record_id: record.record_id ?? record.id,
        approval_id: approvalMap.get(record.record_id ?? record.id)
      }))

      setter(enrichedData as any[])
    } catch (error) {
      console.error(`Error fetching rejected data for ${subTabType}:`, error)
      setRejectedMessage({ type: 'error', text: `Unable to load rejected ${subTabType} data.` })
    } finally {
      setRejectedLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rejected' && authorized) {
      fetchRejectedData(activeRejectedSubTab)
    }
  }, [activeTab, activeRejectedSubTab, authorized])

  const fetchPersonalHistory = async () => {
    setHistoryLoading(true)
    setHistoryMessage(null)

    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('No user session found.')

      const { data: approvals, error: approvalsError } = await supabase
        .from('child_approvals')
        .select('entity_id')
        .eq('submitted_by', userId)
        .eq('entity_type', 'Child_Data')

      if (approvalsError) throw approvalsError

      const ids: number[] = (approvals ?? [])
        .map((r: any) => (typeof r.entity_id === 'string' ? Number(r.entity_id) : r.entity_id))
        .filter(Boolean)

      if (ids.length === 0) {
        setHistoryData([])
        return
      }

      const { data: rows, error: rowsError } = await supabase
        .from('Child_Data')
        .select('*')
        .in('record_id', ids)

      if (rowsError) throw rowsError

      // Sort descending by record_id for most recent first
      const sorted = (rows ?? []).slice().sort((a: any, b: any) => (b.record_id ?? 0) - (a.record_id ?? 0))
      setHistoryData(sorted as HistoryRow[])
    } catch (error) {
      console.error('Error fetching personal history:', error)
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setHistoryMessage({ type: 'error', text: `Unable to load history: ${fallback}` })
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchHistoryData = async (
    tableName: string,
    entityType: string,
    setData: (data: any[]) => void,
    setLoading: (loading: boolean) => void,
    dateRange: { start: string; end: string }
  ) => {
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('No user session found.')

      // First, get entity IDs from child_approvals for this user and entity type
      const { data: approvals, error: approvalsError } = await supabase
        .from('child_approvals')
        .select('entity_id')
        .eq('submitted_by', userId)
        .eq('entity_type', entityType)

      if (approvalsError) throw approvalsError

      const ids: number[] = (approvals ?? [])
        .map((r: any) => (typeof r.entity_id === 'string' ? Number(r.entity_id) : r.entity_id))
        .filter(Boolean)

      if (ids.length === 0) {
        setData([])
        return
      }

      // Then fetch records from the table using those IDs
      let query = supabase
        .from(tableName)
        .select('*')
        .in('record_id', ids)

      // Apply date range filter if dates are provided
      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start)
      }
      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end)
      }

      const { data: rows, error: rowsError } = await query

      if (rowsError) throw rowsError

      const sorted = (rows ?? []).slice().sort((a: any, b: any) => {
        const aDate = new Date(a.created_at || 0).getTime()
        const bDate = new Date(b.created_at || 0).getTime()
        return bDate - aDate
      })

      setData(sorted)
    } catch (error) {
      console.error(`Error fetching ${tableName} history:`, error)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const handleHistorySubTabChange = (subTab: HistorySubTabType) => {
    setActiveHistorySubTab(subTab)

    // Fetch data for the selected subtab
    switch (subTab) {
      case 'child':
        fetchHistoryData('Child_Data', 'Child_Data', setHistoryChildData, setHistoryChildLoading, historyChildDateRange)
        break
      case 'family':
        fetchHistoryData('childfmly', 'childfmly', setHistoryFamilyData, setHistoryFamilyLoading, historyFamilyDateRange)
        break
      case 'sibling':
        fetchHistoryData('childsibling', 'childsibling', setHistorySiblingData, setHistorySiblingLoading, historySiblingDateRange)
        break
      case 'uniform':
        fetchHistoryData('childuniform', 'childuniform', setHistoryUniformData, setHistoryUniformLoading, historyUniformDateRange)
        break
      case 'leaving':
        fetchHistoryData('childleaving', 'childleaving', setHistoryLeavingData, setHistoryLeavingLoading, historyLeavingDateRange)
        break
    }
  }

  const handleHistoryDateRangeChange = (
    subTab: HistorySubTabType,
    type: 'start' | 'end',
    value: string
  ) => {
    switch (subTab) {
      case 'child':
        setHistoryChildDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'family':
        setHistoryFamilyDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'sibling':
        setHistorySiblingDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'uniform':
        setHistoryUniformDateRange(prev => ({ ...prev, [type]: value }))
        break
      case 'leaving':
        setHistoryLeavingDateRange(prev => ({ ...prev, [type]: value }))
        break
    }
  }

  const handleEacChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedEac = e.target.value
    const eacData = eacOptions.find((item) => item.eac_no?.toString() === selectedEac)

    if (!eacData) {
      setFormData((prev) => ({ ...prev, eac_no: selectedEac }))
      return
    }

    setFormData((prev) => ({
      ...prev,
      eac_no: selectedEac,
      village_name: eacData.village_name ?? '',
      district: eacData.district ?? '',
      taluk: eacData.taluk ?? '',
      panchayat: eacData.panchayat ?? '',
      village: eacData.village ?? ''
    }))
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const childGenderNormalized = formData.gender.trim().toUpperCase()
  const showPantSkirtSize = childGenderNormalized !== 'MALE'
  const showChudidharSize = childGenderNormalized !== 'MALE'
  const showTopPantSize = childGenderNormalized !== 'FEMALE'

  const getDraftStorageKey = (registrationNo: string) => `${CHILD_DRAFT_STORAGE_PREFIX}:${registrationNo.trim()}`

  const getAllChildDraftSummaries = (): ChildDraftSummary[] => {
    if (typeof window === 'undefined') return []

    const summaries: ChildDraftSummary[] = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key || !key.startsWith(`${CHILD_DRAFT_STORAGE_PREFIX}:`)) continue

      const regNo = key.slice(`${CHILD_DRAFT_STORAGE_PREFIX}:`.length)
      if (!regNo) continue

      const raw = window.localStorage.getItem(key)
      let savedAt = ''
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ChildEntryDraft
          savedAt = parsed.savedAt || ''
        } catch {
          savedAt = ''
        }
      }

      summaries.push({ regNo, savedAt })
    }

    return summaries.sort((a, b) => {
      const aTime = a.savedAt ? new Date(a.savedAt).getTime() : 0
      const bTime = b.savedAt ? new Date(b.savedAt).getTime() : 0
      return bTime - aTime
    })
  }

  const refreshChildDraftSummaries = () => {
    const summaries = getAllChildDraftSummaries()
    setChildDraftSummaries(summaries)
    return summaries
  }

  const hasDraftForRegistrationNo = (registrationNo: string) => {
    if (typeof window === 'undefined') return false
    const regNo = registrationNo.trim()
    if (!regNo) return false
    return Boolean(window.localStorage.getItem(getDraftStorageKey(regNo)))
  }

  const saveChildDraft = () => {
    const regNo = formData.reg_no.trim()
    if (!regNo) {
      setMessage({ type: 'error', text: 'Please enter Registration Number before saving draft.' })
      return
    }

    if (typeof window === 'undefined') return

    const draftPayload: ChildEntryDraft = {
      savedAt: new Date().toISOString(),
      wizardStep,
      formData,
      familyData,
      siblingData,
      uniformData,
    }

    window.localStorage.setItem(getDraftStorageKey(regNo), JSON.stringify(draftPayload))
    window.localStorage.setItem(CHILD_DRAFT_LATEST_REG_KEY, regNo)
    setDraftExistsForRegNo(true)
    refreshChildDraftSummaries()
    setMessage({ type: 'success', text: `Draft saved for Registration No ${regNo}.` })
  }

  const loadChildDraftByRegistrationNo = (registrationNo: string) => {
    const regNo = registrationNo.trim()
    if (!regNo) {
      setMessage({ type: 'error', text: 'Enter Registration Number to continue draft entry.' })
      return
    }

    if (typeof window === 'undefined') return

    const raw = window.localStorage.getItem(getDraftStorageKey(regNo))
    if (!raw) {
      setMessage({ type: 'error', text: `No draft found for Registration No ${regNo}.` })
      return
    }

    try {
      const parsed = JSON.parse(raw) as ChildEntryDraft
      setFormData(parsed.formData)
      setFamilyData(parsed.familyData)
      setSiblingData(parsed.siblingData)
      setUniformData(parsed.uniformData)
      setWizardStep(Math.max(0, Math.min(parsed.wizardStep, wizardSteps.length - 1)))
      setDraftExistsForRegNo(true)
      setEntryGate('form')
      setMessage({ type: 'success', text: `Draft loaded for Registration No ${regNo}. Please re-upload photo if needed.` })
    } catch {
      setMessage({ type: 'error', text: 'Saved draft is corrupted. Please start a new entry.' })
    }
  }

  const loadChildDraft = () => {
    loadChildDraftByRegistrationNo(formData.reg_no)
  }

  const clearChildDraft = (registrationNo?: string) => {
    const regNo = (registrationNo ?? formData.reg_no).trim()
    if (!regNo || typeof window === 'undefined') return

    window.localStorage.removeItem(getDraftStorageKey(regNo))
    const latestRegNo = window.localStorage.getItem(CHILD_DRAFT_LATEST_REG_KEY)?.trim() || ''
    if (latestRegNo === regNo) {
      window.localStorage.removeItem(CHILD_DRAFT_LATEST_REG_KEY)
    }
    refreshChildDraftSummaries()
    setDraftExistsForRegNo(false)
    setMessage({ type: 'success', text: `Draft removed for Registration No ${regNo}.` })
  }

  const startNewChildEntry = () => {
    setFormData(createEmptyForm())
    setFamilyData(createEmptyFamilyForm())
    setSiblingData(createEmptySiblingForm())
    setUniformData(createEmptyUniformForm())
    setPhotoFile(null)
    setPhotoPreview('')
    setPhotoInputKey(Date.now())
    setWizardStep(0)
    setDraftExistsForRegNo(false)
    setEntryGate('form')
    setMessage(null)
  }

  const handleTabSelection = (tab: TabType) => {
    setActiveTab(tab)

    if (tab === 'rejected') {
      setEntryGate('form')
      return
    }

    if (tab === 'child') {
      const drafts = refreshChildDraftSummaries()
      if (drafts.length > 0) {
        setEntryGate('chooser')
        return
      }
    }

    setEntryGate('form')
  }

  const hasFamilyIncomeColumnError = (error: any) => {
    const message = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`.toLowerCase()
    const hasMissingColumnSignal = message.includes('column') && (message.includes('does not exist') || message.includes('not found') || message.includes('schema cache'))
    return hasMissingColumnSignal && (message.includes('f_inc') || message.includes('m_inc'))
  }

  const hasRegNoIdentityUpdateError = (error: any) => {
    const code = String(error?.code ?? '')
    const message = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`.toLowerCase()
    return (
      code === '428c9' &&
      message.includes('reg_no') &&
      message.includes('identity')
    )
  }

  const insertSiblingRecord = async (payload: Record<string, unknown>) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      return { data: null, error: sessionError }
    }

    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      return { data: null, error: new Error('User session not found. Please sign in again.') }
    }

    const response = await fetch('/api/field-volunteer/childsibling/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ payload }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        data: null,
        error: new Error(result?.error || 'Sibling insert failed via API endpoint.'),
      }
    }

    return { data: result?.data ?? null, error: null as any }
  }

  const wizardSteps: { id: WizardStepType; label: string }[] = [
    { id: 'child', label: 'Child Data' },
    { id: 'family', label: 'Child Family' },
    { id: 'sibling', label: 'Child Sibling' },
    { id: 'uniform', label: 'Child Uniform' },
  ]

  const syncSharedFormValues = () => {
    setFamilyData((prev) => ({
      ...prev,
      village_name: formData.village_name,
      eac_no: formData.eac_no,
      reg_no: formData.reg_no,
    }))
    setSiblingData((prev) => ({
      ...prev,
      village_name: formData.village_name,
      eac_no: formData.eac_no,
      reg_no: formData.reg_no,
    }))
    setUniformData((prev) => ({
      ...prev,
      village_name: formData.village_name,
      eac_no: formData.eac_no,
      reg_no: formData.reg_no,
    }))
  }

  const validateWizardStep = (step: number): string | null => {
    if (step === 0) {
      if (!formData.eac_no.trim()) return 'EAC number is required.'
      if (!formData.reg_no.trim()) return 'Registration number is required.'
      if (!formData.first_name.trim()) return 'First name is required.'
      if (!formData.gender.trim()) return 'Gender is required.'
      if (!formData.birth_place.trim()) return 'Birth place is required.'
      if (!formData.blood_group.trim()) return 'Blood group is required.'
      if (!formData.health.trim()) return 'Health status is required.'
      if (!formData.caste.trim()) return 'Caste is required.'
      if (!formData.school_name.trim()) return 'School name is required.'
      if (!formData.school_category.trim()) return 'School category is required.'

      if (formData.dateofbirth) {
        const birthDate = new Date(formData.dateofbirth)
        const today = new Date(todayIsoDate)
        if (birthDate > today) return 'Date of birth cannot be in the future.'
      }

      return null
    }

    if (step === 1) {
      if (familyData.f_name.trim() && !familyData.f_occup.trim()) {
        return "Father's occupation is required when father's name is entered."
      }

      return null
    }

    if (step === 3) {
      if (!uniformData.shirtsize.trim()) return 'Shirt size is required.'
      if (!uniformData.knickersize.trim()) return 'Knicker size is required.'
      if (!uniformData.footwearsize.trim()) return 'Footwear size is required.'

      if (showPantSkirtSize && !uniformData.pant_skirtsize.trim()) {
        return 'Pant/Skirt size is required.'
      }

      if (showChudidharSize && !uniformData.chudidharsize.trim()) {
        return 'Chudidhar size is required.'
      }

      if (showTopPantSize && !uniformData.top_pantsize.trim()) {
        return 'Top/Pant size is required.'
      }

      return null
    }

    return null
  }

  const handleWizardNext = () => {
    finalSubmitArmedRef.current = false
    syncSharedFormValues()
    const stepError = validateWizardStep(wizardStep)
    if (stepError) {
      setMessage({ type: 'error', text: stepError })
      return
    }

    setMessage(null)
    setWizardStep((prev) => Math.min(prev + 1, wizardSteps.length - 1))
  }

  const handleWizardBack = () => {
    finalSubmitArmedRef.current = false
    setMessage(null)
    setWizardStep((prev) => Math.max(prev - 1, 0))
  }

  const handleUnifiedSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (wizardStep < wizardSteps.length - 1 || !finalSubmitArmedRef.current) {
      return
    }
    finalSubmitArmedRef.current = false

    if (isSubmittingUnified) return

    syncSharedFormValues()
    for (let step = 0; step < wizardSteps.length; step += 1) {
      const stepError = validateWizardStep(step)
      if (stepError) {
        setWizardStep(step)
        setMessage({ type: 'error', text: stepError })
        return
      }
    }

    setIsSubmittingUnified(true)
    setLoading(true)
    setMessage(null)

    try {
      const toNullableString = (value: string) => (value.trim() === '' ? null : value)
      const toNullableNumber = (value: string) => {
        if (value.trim() === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      if (!userId) {
        throw new Error('User session not found. Please sign in again.')
      }

      const eacNumber = Number(formData.eac_no)
      if (Number.isNaN(eacNumber)) {
        throw new Error('EAC number must be a valid number.')
      }

      let photoUrl: string | null = photoFile ? null : (formData.photo_link ? formData.photo_link : null)

      const childPayload = {
        eac_no: eacNumber,
        village_name: toNullableString(formData.village_name),
        district: toNullableString(formData.district),
        taluk: toNullableString(formData.taluk),
        panchayat: toNullableString(formData.panchayat),
        village: toNullableString(formData.village),
        adm_date: toNullableString(formData.adm_date),
        dateofbirth: toNullableString(formData.dateofbirth),
        first_name: toNullableString(formData.first_name),
        last_name: toNullableString(formData.last_name),
        gender: toNullableString(formData.gender),
        religion: toNullableString(formData.religion),
        aadhar_no: toNullableNumber(formData.aadhar_no),
        birth_place: toNullableString(formData.birth_place),
        height: toNullableNumber(formData.height),
        weight: toNullableNumber(formData.weight),
        blood_group: toNullableString(formData.blood_group),
        health: toNullableString(formData.health),
        caste: toNullableString(formData.caste),
        mother_tongue: toNullableString(formData.mother_tongue),
        class_std_text: toNullableString(formData.class_std_text),
        school_name: toNullableString(formData.school_name),
        school_category: toNullableString(formData.school_category),
        sats_no: toNullableNumber(formData.sats_no),
        pen_no: toNullableNumber(formData.pen_no),
        medium_of_study: toNullableString(formData.medium_of_study),
        life_ambition: toNullableString(formData.life_ambition),
        fav_subject: toNullableString(formData.fav_subject),
        child_other_info: toNullableString(formData.child_other_info),
        photo_link: photoUrl,
      }

      const { data: childRow, error: childError } = await supabase
        .from('Child_Data')
        .insert([childPayload])
        .select()
        .single()

      if (childError) throw childError

      if (photoFile) {
        const extension = (photoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const uploadIdentifier = `${childRow.eac_no}-${childRow.reg_no}`
        const sanitizedIdentifier = uploadIdentifier.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()
        const uniqueFallback =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Date.now().toString(36)
        const safeIdentifier = sanitizedIdentifier || uniqueFallback
        const filePath = `${safeIdentifier}.${extension}`

        const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, photoFile, {
          cacheControl: '3600',
          upsert: true,
        })

        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage.from('profiles').getPublicUrl(filePath)
        photoUrl =
          publicData.publicUrl ??
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile/${filePath}`

        const { error: childPhotoUpdateError } = await supabase
          .from('Child_Data')
          .update({ photo_link: photoUrl })
          .eq('record_id', childRow.record_id)

        if (childPhotoUpdateError) throw childPhotoUpdateError
      }

      const { error: childApprovalError } = await supabase
        .from('child_approvals')
        .insert([{
          entity_type: 'Child_Data',
          entity_id: childRow.record_id,
          submitted_by: userId,
        }])

      if (childApprovalError) throw childApprovalError

      const familyPayload = {
        village_name: toNullableString(formData.village_name),
        eac_no: toNullableString(formData.eac_no),
        reg_no: childRow.reg_no ?? null,
        f_name: toNullableString(familyData.f_name),
        f_occup: toNullableString(familyData.f_occup),
        f_inc: toNullableNumber(familyData.f_inc),
        f_aadhar: toNullableString(familyData.f_aadhar),
        f_mobile: toNullableString(familyData.f_mobile),
        m_name: toNullableString(familyData.m_name),
        m_occup: toNullableString(familyData.m_occup),
        m_inc: toNullableNumber(familyData.m_inc),
        m_aadhar: toNullableString(familyData.m_aadhar),
        m_mobile: toNullableString(familyData.m_mobile),
        fmly_addr1: toNullableString(familyData.fmly_addr1),
        fmly_addr2: toNullableString(familyData.fmly_addr2),
        fmly_addr3: toNullableString(familyData.fmly_addr3),
        fmly_pincode: toNullableString(familyData.fmly_pincode),
        fmly_remarks: toNullableString(familyData.fmly_remarks),
      }

      let familyInsertResult = await supabase
        .from('childfmly')
        .insert([familyPayload])
        .select()
        .single()

      if (familyInsertResult.error && hasFamilyIncomeColumnError(familyInsertResult.error)) {
        const { f_inc, m_inc, ...restPayload } = familyPayload
        familyInsertResult = await supabase
          .from('childfmly')
          .insert([{ ...restPayload, f_inc_int: f_inc, m_inc_int: m_inc }])
          .select()
          .single()
      }

      if (familyInsertResult.error) throw familyInsertResult.error
      const familyRow = familyInsertResult.data

      const { error: familyApprovalError } = await supabase
        .from('child_approvals')
        .insert([{
          entity_type: 'childfmly',
          entity_id: familyRow.record_id,
          submitted_by: userId,
        }])

      if (familyApprovalError) throw familyApprovalError

      const siblingPayload = {
        village_name: toNullableString(formData.village_name),
        eac_no: toNullableString(formData.eac_no),
        reg_no: childRow.reg_no ?? null,
        names_1: toNullableString(siblingData.names_1),
        ages_1: toNullableNumber(siblingData.ages_1),
        genders_1: toNullableString(siblingData.genders_1),
        class_occup_1: toNullableString(siblingData.class_occup_1),
        names_2: toNullableString(siblingData.names_2),
        ages_2: toNullableNumber(siblingData.ages_2),
        genders_2: toNullableString(siblingData.genders_2),
        class_occup_2: toNullableString(siblingData.class_occup_2),
        names_3: toNullableString(siblingData.names_3),
        ages_3: toNullableNumber(siblingData.ages_3),
        genders_3: toNullableString(siblingData.genders_3),
        class_occup_3: toNullableString(siblingData.class_occup_3),
        names_4: toNullableString(siblingData.names_4),
        ages_4: toNullableNumber(siblingData.ages_4),
        genders_4: toNullableString(siblingData.genders_4),
        class_occup_4: toNullableString(siblingData.class_occup_4),
        names_5: toNullableString(siblingData.names_5),
        ages_5: toNullableNumber(siblingData.ages_5),
        genders_5: toNullableString(siblingData.genders_5),
        class_occup_5: toNullableString(siblingData.class_occup_5),
        sibling_remarks: toNullableString(siblingData.sibling_remarks),
      }

      const siblingInsertResult = await insertSiblingRecord(siblingPayload)

      if (siblingInsertResult.error) throw siblingInsertResult.error
      const siblingRow = siblingInsertResult.data

      const { error: siblingApprovalError } = await supabase
        .from('child_approvals')
        .insert([{
          entity_type: 'childsibling',
          entity_id: siblingRow.record_id,
          submitted_by: userId,
        }])

      if (siblingApprovalError) throw siblingApprovalError

      const uniformPayload = {
        village_name: toNullableString(formData.village_name),
        eac_no: toNullableString(formData.eac_no),
        reg_no: childRow.reg_no ?? null,
        shirtsize: toNullableString(uniformData.shirtsize),
        knickersize: toNullableString(uniformData.knickersize),
        pant_skirtsize: toNullableString(uniformData.pant_skirtsize),
        chudidharsize: toNullableString(uniformData.chudidharsize),
        top_pantsize: toNullableString(uniformData.top_pantsize),
        footwearsize: toNullableString(uniformData.footwearsize),
        uniform_updated: toNullableString(uniformData.uniform_updated),
      }

      const { data: uniformRow, error: uniformError } = await supabase
        .from('childuniform')
        .insert([uniformPayload])
        .select()
        .single()

      if (uniformError) throw uniformError

      const { error: uniformApprovalError } = await supabase
        .from('child_approvals')
        .insert([{
          entity_type: 'childuniform',
          entity_id: uniformRow.record_id,
          submitted_by: userId,
        }])

      if (uniformApprovalError) throw uniformApprovalError

      setMessage({ type: 'success', text: 'Child profile form submitted successfully for approval.' })

      if (typeof window !== 'undefined') {
        const submittedRegNo = formData.reg_no.trim()
        if (submittedRegNo) {
          window.localStorage.removeItem(getDraftStorageKey(submittedRegNo))
        }
      }
      refreshChildDraftSummaries()

      setFormData(createEmptyForm())
      setFamilyData(createEmptyFamilyForm())
      setSiblingData(createEmptySiblingForm())
      setUniformData(createEmptyUniformForm())
      setPhotoFile(null)
      setPhotoPreview('')
      setPhotoInputKey(Date.now())
      setWizardStep(0)
      setDraftExistsForRegNo(false)
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setMessage({ type: 'error', text: `Unable to submit complete form: ${fallback}` })
    } finally {
      setLoading(false)
      setIsSubmittingUnified(false)
    }
  }

  const handleVocationalChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setVocationalData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleComputerChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setComputerData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleVocationalPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (file && file.size > 5 * 1024 * 1024) {
      setVocationalMessage({ type: 'error', text: 'Photo must be 5MB or smaller.' })
      event.target.value = ''
      setVocationalPhotoFile(null)
      setVocationalPhotoPreview('')
    } else if (file && !file.type.startsWith('image/')) {
      setVocationalMessage({ type: 'error', text: 'Please select a valid image file.' })
      event.target.value = ''
      setVocationalPhotoFile(null)
      setVocationalPhotoPreview('')
    } else if (file) {
      setVocationalPhotoFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setVocationalPhotoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setVocationalMessage(null)
    }
  }

  const handleComputerPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (file && file.size > 5 * 1024 * 1024) {
      setComputerMessage({ type: 'error', text: 'Photo must be 5MB or smaller.' })
      event.target.value = ''
      setComputerPhotoFile(null)
      setComputerPhotoPreview('')
    } else if (file && !file.type.startsWith('image/')) {
      setComputerMessage({ type: 'error', text: 'Please select a valid image file.' })
      event.target.value = ''
      setComputerPhotoFile(null)
      setComputerPhotoPreview('')
    } else if (file) {
      setComputerPhotoFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setComputerPhotoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setComputerMessage(null)
    }
  }

  const uploadVocationalPhoto = async (): Promise<string | null> => {
    if (!vocationalPhotoFile) return null

    try {
      setVocationalPhotoUploading(true)
      const fileName = `${Date.now()}-${vocationalPhotoFile.name}`
      const filePath = `vocational_photos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, vocationalPhotoFile)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading vocational photo:', error)
      setVocationalMessage({ type: 'error', text: 'Failed to upload photo' })
      return null
    } finally {
      setVocationalPhotoUploading(false)
    }
  }

  const uploadComputerPhoto = async (): Promise<string | null> => {
    if (!computerPhotoFile) return null

    try {
      setComputerPhotoUploading(true)
      const fileName = `${Date.now()}-${computerPhotoFile.name}`
      const filePath = `profiles/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, computerPhotoFile)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading computer photo:', error)
      setComputerMessage({ type: 'error', text: 'Failed to upload photo' })
      return null
    } finally {
      setComputerPhotoUploading(false)
    }
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (file && file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be 5MB or smaller.' })
      event.target.value = ''
      setPhotoFile(null)
      setPhotoPreview('')
      setFormData((prev) => ({ ...prev, photo_link: '' }))
      setPhotoInputKey(Date.now())
      return
    }

    setPhotoFile(file)
    setFormData((prev) => ({ ...prev, photo_link: file ? file.name : '' }))

    if (!file) {
      setPhotoPreview('')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setPhotoPreview((e.target?.result as string) || '')
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmittingChild) return
    setIsSubmittingChild(true)
    setLoading(true)
    setMessage(null)

    try {
      if (!formData.eac_no) {
        throw new Error('EAC number is required.')
      }

      const eacNumber = Number(formData.eac_no)
      if (Number.isNaN(eacNumber)) {
        throw new Error('EAC number must be a valid number.')
      }

      let photoUrl: string | null = photoFile ? null : (formData.photo_link ? formData.photo_link : null)

      const toNullableString = (value: string) => (value.trim() === '' ? null : value)
      const toNullableNumber = (value: string) => {
        if (value.trim() === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const payload = {
        eac_no: eacNumber,
        village_name: toNullableString(formData.village_name),
        district: toNullableString(formData.district),
        taluk: toNullableString(formData.taluk),
        panchayat: toNullableString(formData.panchayat),
        village: toNullableString(formData.village),
        adm_date: toNullableString(formData.adm_date),
        dateofbirth: toNullableString(formData.dateofbirth),
        first_name: toNullableString(formData.first_name),
        last_name: toNullableString(formData.last_name),
        gender: toNullableString(formData.gender),
        religion: toNullableString(formData.religion),
        aadhar_no: toNullableNumber(formData.aadhar_no),
        birth_place: toNullableString(formData.birth_place),
        height: toNullableNumber(formData.height),
        weight: toNullableNumber(formData.weight),
        blood_group: toNullableString(formData.blood_group),
        health: toNullableString(formData.health),
        caste: toNullableString(formData.caste),
        mother_tongue: toNullableString(formData.mother_tongue),
        class_std_text: toNullableString(formData.class_std_text),
        school_name: toNullableString(formData.school_name),
        school_category: toNullableString(formData.school_category),
        sats_no: toNullableNumber(formData.sats_no),
        pen_no: toNullableNumber(formData.pen_no),
        medium_of_study: toNullableString(formData.medium_of_study),
        life_ambition: toNullableString(formData.life_ambition),
        fav_subject: toNullableString(formData.fav_subject),
        child_other_info: toNullableString(formData.child_other_info),
        photo_link: photoUrl,
      }

      const { data, error } = await supabase
        .from('Child_Data')
        .insert([payload])
        .select()
        .single()
      if (error) throw error

      if (photoFile) {
        const extension = (photoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const uploadIdentifier = `${data.eac_no}-${data.reg_no}`
        const sanitizedIdentifier = uploadIdentifier.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()
        const uniqueFallback =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Date.now().toString(36)
        const safeIdentifier = sanitizedIdentifier || uniqueFallback
        const filePath = `${safeIdentifier}.${extension}`

        const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, photoFile, {
          cacheControl: '3600',
          upsert: true,
        })

        if (uploadError) {
          throw uploadError
        }

        const { data: publicData } = supabase.storage.from('profiles').getPublicUrl(filePath)
        photoUrl =
          publicData.publicUrl ??
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile/${filePath}`

        const { error: childPhotoUpdateError } = await supabase
          .from('Child_Data')
          .update({ photo_link: photoUrl })
          .eq('record_id', data.record_id)

        if (childPhotoUpdateError) throw childPhotoUpdateError
      }


      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      console.log("User ID (auth.uid() equivalent):", userId);



      const { error: approvalError } = await supabase
        .from('child_approvals')
        .insert([{
          entity_type: 'Child_Data',
          entity_id: data.record_id,
          submitted_by: userId
        }])

      if (approvalError) throw approvalError

      setMessage({ type: 'success', text: 'Child data submitted for approval.' })
      setFormData(createEmptyForm())
      setPhotoFile(null)
      setPhotoPreview('')
      setPhotoInputKey(Date.now())
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setMessage({ type: 'error', text: `Unable to save the form: ${fallback}` })
    } finally {
      setLoading(false)
      setIsSubmittingChild(false)
    }
  }

  const handleFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmittingFamily) return
    setIsSubmittingFamily(true)
    setFamilyLoading(true)
    setFamilyMessage(null)

    try {
      const toNullableString = (value: string) => (value.trim() === '' ? null : value)
      const toNullableNumber = (value: string) => {
        if (value.trim() === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const payload = {
        village_name: toNullableString(familyData.village_name),
        eac_no: toNullableString(familyData.eac_no),
        reg_no: toNullableNumber(familyData.reg_no),
        f_name: toNullableString(familyData.f_name),
        f_occup: toNullableString(familyData.f_occup),
        f_inc: toNullableNumber(familyData.f_inc),
        f_aadhar: toNullableString(familyData.f_aadhar),
        f_mobile: toNullableString(familyData.f_mobile),
        m_name: toNullableString(familyData.m_name),
        m_occup: toNullableString(familyData.m_occup),
        m_inc: toNullableNumber(familyData.m_inc),
        m_aadhar: toNullableString(familyData.m_aadhar),
        m_mobile: toNullableString(familyData.m_mobile),
        fmly_addr1: toNullableString(familyData.fmly_addr1),
        fmly_addr2: toNullableString(familyData.fmly_addr2),
        fmly_addr3: toNullableString(familyData.fmly_addr3),
        fmly_pincode: toNullableString(familyData.fmly_pincode),
        fmly_remarks: toNullableString(familyData.fmly_remarks),
      }

      let familyInsertResult = await supabase
        .from('childfmly')
        .insert([payload])
        .select()
        .single()

      if (familyInsertResult.error && hasFamilyIncomeColumnError(familyInsertResult.error)) {
        const { f_inc, m_inc, ...restPayload } = payload
        familyInsertResult = await supabase
          .from('childfmly')
          .insert([{ ...restPayload, f_inc_int: f_inc, m_inc_int: m_inc }])
          .select()
          .single()
      }

      if (familyInsertResult.error) throw familyInsertResult.error
      const data = familyInsertResult.data

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      const { error: approvalError } = await supabase
        .from('child_approvals')
        .insert([{
          entity_type: 'childfmly',
          entity_id: data.record_id,
          submitted_by: userId
        }])

      if (approvalError) throw approvalError

      setFamilyMessage({ type: 'success', text: 'Family data submitted for approval.' })
      setFamilyData(createEmptyFamilyForm())
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setFamilyMessage({ type: 'error', text: `Unable to save: ${fallback}` })
    } finally {
      setFamilyLoading(false)
      setIsSubmittingFamily(false)
    }
  }

  const handleSiblingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmittingSibling) return
    setIsSubmittingSibling(true)
    setSiblingLoading(true)
    setSiblingMessage(null)

    try {
      const toNullableString = (value: string) => (value.trim() === '' ? null : value)
      const toNullableNumber = (value: string) => {
        if (value.trim() === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const payload = {
        village_name: toNullableString(siblingData.village_name),
        eac_no: toNullableString(siblingData.eac_no),
        reg_no: toNullableNumber(siblingData.reg_no),
        names_1: toNullableString(siblingData.names_1),
        ages_1: toNullableNumber(siblingData.ages_1),
        genders_1: toNullableString(siblingData.genders_1),
        class_occup_1: toNullableString(siblingData.class_occup_1),
        names_2: toNullableString(siblingData.names_2),
        ages_2: toNullableNumber(siblingData.ages_2),
        genders_2: toNullableString(siblingData.genders_2),
        class_occup_2: toNullableString(siblingData.class_occup_2),
        names_3: toNullableString(siblingData.names_3),
        ages_3: toNullableNumber(siblingData.ages_3),
        genders_3: toNullableString(siblingData.genders_3),
        class_occup_3: toNullableString(siblingData.class_occup_3),
        names_4: toNullableString(siblingData.names_4),
        ages_4: toNullableNumber(siblingData.ages_4),
        genders_4: toNullableString(siblingData.genders_4),
        class_occup_4: toNullableString(siblingData.class_occup_4),
        names_5: toNullableString(siblingData.names_5),
        ages_5: toNullableNumber(siblingData.ages_5),
        genders_5: toNullableString(siblingData.genders_5),
        class_occup_5: toNullableString(siblingData.class_occup_5),
        sibling_remarks: toNullableString(siblingData.sibling_remarks),
      }

      const siblingInsertResult = await insertSiblingRecord(payload)

      if (siblingInsertResult.error) throw siblingInsertResult.error
      const data = siblingInsertResult.data

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      const { error: approvalError } = await supabase
        .from('child_approvals')
        .insert([{
          entity_type: 'childsibling',
          entity_id: data.record_id,
          submitted_by: userId
        }])

      if (approvalError) throw approvalError

      setSiblingMessage({ type: 'success', text: 'Sibling data submitted for approval.' })
      setSiblingData(createEmptySiblingForm())
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setSiblingMessage({ type: 'error', text: `Unable to save: ${fallback}` })
    } finally {
      setSiblingLoading(false)
      setIsSubmittingSibling(false)
    }
  }

  const handleUniformSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmittingUniform) return
    setIsSubmittingUniform(true)
    setUniformLoading(true)
    setUniformMessage(null)

    try {
      const toNullableString = (value: string) => (value.trim() === '' ? null : value)
      const toNullableNumber = (value: string) => {
        if (value.trim() === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const payload = {
        village_name: toNullableString(uniformData.village_name),
        eac_no: toNullableString(uniformData.eac_no),
        reg_no: toNullableNumber(uniformData.reg_no),
        shirtsize: toNullableString(uniformData.shirtsize),
        knickersize: toNullableString(uniformData.knickersize),
        pant_skirtsize: toNullableString(uniformData.pant_skirtsize),
        chudidharsize: toNullableString(uniformData.chudidharsize),
        top_pantsize: toNullableString(uniformData.top_pantsize),
        footwearsize: toNullableString(uniformData.footwearsize),
        uniform_updated: toNullableString(uniformData.uniform_updated),
      }

      const { data, error } = await supabase
        .from('childuniform')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      const { error: approvalError } = await supabase
        .from('child_approvals')
        .insert([{
          entity_type: 'childuniform',
          entity_id: data.record_id,
          submitted_by: userId
        }])

      if (approvalError) throw approvalError

      setUniformMessage({ type: 'success', text: 'Uniform data submitted for approval.' })
      setUniformData(createEmptyUniformForm())
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setUniformMessage({ type: 'error', text: `Unable to save: ${fallback}` })
    } finally {
      setUniformLoading(false)
      setIsSubmittingUniform(false)
    }
  }

  const handleLeavingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmittingLeaving) return
    setIsSubmittingLeaving(true)
    setLeavingLoading(true)
    setLeavingMessage(null)

    try {
      if (!leavingData.reg_no) {
        throw new Error('Registration number is required.')
      }

      const toNullableString = (value: string) => (value.trim() === '' ? null : value)

      const payload = {
        eac_no: toNullableString(leavingData.eac_no),
        reg_no: toNullableString(leavingData.reg_no),
        reason: toNullableString(leavingData.reason),
        pass_status: toNullableString(leavingData.pass_status),
        leav_class: toNullableString(leavingData.leav_class),
        leav_date: toNullableString(leavingData.leav_date),
        leav_addr1: toNullableString(leavingData.leav_addr1),
        leav_addr2: toNullableString(leavingData.leav_addr2),
        leav_addr3: toNullableString(leavingData.leav_addr3),
        leav_pincode: toNullableString(leavingData.leav_pincode),
        leav_remarks: toNullableString(leavingData.leav_remarks),
      }

      const { data, error } = await supabase
        .from('childleaving')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      const { error: approvalError } = await supabase
        .from('child_approvals')
        .insert([{
          entity_type: 'childleaving',
          entity_id: data.record_id,
          submitted_by: userId
        }])

      if (approvalError) throw approvalError

      setLeavingMessage({ type: 'success', text: 'Leaving data submitted for approval.' })
      setLeavingData(createEmptyLeavingForm())
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setLeavingMessage({ type: 'error', text: `Unable to save: ${fallback}` })
    } finally {
      setLeavingLoading(false)
      setIsSubmittingLeaving(false)
    }
  }

  const handleVocationalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmittingVocational) return
    setIsSubmittingVocational(true)
    setVocationalLoading(true)
    setVocationalMessage(null)

    try {
      if (!vocationalData.trainee_name) {
        throw new Error('Trainee name is required.')
      }

      let photoLink: string | null = null
      if (vocationalPhotoFile) {
        photoLink = await uploadVocationalPhoto()
        if (!photoLink && vocationalPhotoFile) {
          throw new Error('Photo upload failed. Please try again.')
        }
      }

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      if (!userId) {
        throw new Error('User session not found. Please log in again.')
      }

      const toNullableString = (value: string) => (value.trim() === '' ? null : value)
      const toNullableNumber = (value: string) => {
        if (value.trim() === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const payload = {
        date_of_admission: toNullableString(vocationalData.date_of_admission),
        eac_no: toNullableNumber(vocationalData.eac_no),
        reg_no: toNullableString(vocationalData.reg_no),
        batch_no: toNullableString(vocationalData.batch_no),
        batch_timings: toNullableString(vocationalData.batch_timings),
        centre_no: toNullableString(vocationalData.centre_no),
        district: toNullableString(vocationalData.district),
        taluk: toNullableString(vocationalData.taluk),
        panchayat: toNullableString(vocationalData.panchayat),
        village: toNullableString(vocationalData.village),
        trainee_name: toNullableString(vocationalData.trainee_name),
        gender: toNullableString(vocationalData.gender),
        aadhar_no: toNullableString(vocationalData.aadhar_no),
        date_of_birth: toNullableString(vocationalData.date_of_birth),
        place_of_birth: toNullableString(vocationalData.place_of_birth),
        blood_group: toNullableString(vocationalData.blood_group),
        marital_status: toNullableString(vocationalData.marital_status),
        mother_tongue: toNullableString(vocationalData.mother_tongue),
        religion: toNullableString(vocationalData.religion),
        caste: toNullableString(vocationalData.caste),
        class_standard_studied: toNullableString(vocationalData.class_standard_studied),
        school_name: toNullableString(vocationalData.school_name),
        medium_of_study: toNullableString(vocationalData.medium_of_study),
        ambition_in_life: toNullableString(vocationalData.ambition_in_life),
        favourite_subject: toNullableString(vocationalData.favourite_subject),
        other_information: toNullableString(vocationalData.other_information),
        father_or_husband_name: toNullableString(vocationalData.father_or_husband_name),
        father_occupation: toNullableString(vocationalData.father_occupation),
        father_income: toNullableNumber(vocationalData.father_income),
        father_aadhar_no: toNullableString(vocationalData.father_aadhar_no),
        father_mobile: toNullableString(vocationalData.father_mobile),
        mother_name: toNullableString(vocationalData.mother_name),
        mother_occupation: toNullableString(vocationalData.mother_occupation),
        mother_income: toNullableNumber(vocationalData.mother_income),
        mother_aadhar_no: toNullableString(vocationalData.mother_aadhar_no),
        mother_mobile: toNullableString(vocationalData.mother_mobile),
        parent_guardian_address: toNullableString(vocationalData.parent_guardian_address),
        enrolled_course: toNullableString(vocationalData.enrolled_course),
        attended_other_training: vocationalData.attended_other_training === 'true' ? true : vocationalData.attended_other_training === 'false' ? false : null,
        previous_training_details: toNullableString(vocationalData.previous_training_details),
        plan_after_course: toNullableString(vocationalData.plan_after_course),
        present_status: toNullableString(vocationalData.present_status),
        education_training_employment: toNullableString(vocationalData.education_training_employment),
        reason_for_leaving: toNullableString(vocationalData.reason_for_leaving),
        leaving_date: toNullableString(vocationalData.leaving_date),
        present_address: toNullableString(vocationalData.present_address),
        recommended_by: toNullableString(vocationalData.recommended_by),
        recommended_date: toNullableString(vocationalData.recommended_date),
        trainee_signature_date: toNullableString(vocationalData.trainee_signature_date),
        parent_guardian_name: toNullableString(vocationalData.parent_guardian_name),
        parent_guardian_signature_date: toNullableString(vocationalData.parent_guardian_signature_date),
        verified_by_social_worker: toNullableString(vocationalData.verified_by_social_worker),
        verified_by_dfi_staff: toNullableString(vocationalData.verified_by_dfi_staff),
        photo_link: photoLink,
        submitted_by: userId,
      }

      const { data, error } = await supabase
        .from('vocational_course')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      const { error: approvalError } = await supabase
        .from('vocational_training_approvals')
        .insert([{
          entity_type: 'vocational_course',
          entity_id: data.id,
          submitted_by: userId,
          status: 'Pending'
        }])

      if (approvalError) throw approvalError

      setVocationalMessage({ type: 'success', text: 'Vocational course data submitted for approval.' })
      setVocationalData(createEmptyVocationalCourseForm())
      setVocationalPhotoFile(null)
      setVocationalPhotoPreview('')
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setVocationalMessage({ type: 'error', text: `Unable to save: ${fallback}` })
    } finally {
      setVocationalLoading(false)
      setIsSubmittingVocational(false)
    }
  }

  const handleComputerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmittingComputer) return
    setIsSubmittingComputer(true)
    setComputerLoading(true)
    setComputerMessage(null)

    try {
      if (!computerData.child_name) {
        throw new Error('Child name is required.')
      }

      let photoLink: string | null = null
      if (computerPhotoFile) {
        photoLink = await uploadComputerPhoto()
        if (!photoLink && computerPhotoFile) {
          throw new Error('Photo upload failed. Please try again.')
        }
      }

      const toNullableString = (value: string) => (value.trim() === '' ? null : value)
      const toNullableNumber = (value: string) => {
        if (value.trim() === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      if (!userId) {
        throw new Error('User session not found. Please log in again.')
      }

      const payload = {
        batch_no: toNullableString(computerData.batch_no),
        batch_timings: toNullableString(computerData.batch_timings),
        date_of_admission: toNullableString(computerData.date_of_admission),
        reg_no: toNullableString(computerData.reg_no),
        eac_no: toNullableString(computerData.eac_no),
        child_name: toNullableString(computerData.child_name),
        gender: toNullableString(computerData.gender),
        aadhar_no: toNullableString(computerData.aadhar_no),
        date_of_birth: toNullableString(computerData.date_of_birth),
        class_standard: toNullableString(computerData.class_standard),
        school_name: toNullableString(computerData.school_name),
        school_type: toNullableString(computerData.school_type),
        prior_computer_knowledge: computerData.prior_computer_knowledge === 'true' ? true : computerData.prior_computer_knowledge === 'false' ? false : null,
        father_occupation: toNullableString(computerData.father_occupation),
        father_income: toNullableNumber(computerData.father_income),
        father_phone: toNullableString(computerData.father_phone),
        mother_occupation: toNullableString(computerData.mother_occupation),
        mother_income: toNullableNumber(computerData.mother_income),
        mother_phone: toNullableString(computerData.mother_phone),
        guardian_address: toNullableString(computerData.guardian_address),
        consent_details_confirmed: computerData.consent_details_confirmed === 'true' ? true : computerData.consent_details_confirmed === 'false' ? false : null,
        consent_course_participation: computerData.consent_course_participation === 'true' ? true : computerData.consent_course_participation === 'false' ? false : null,
        consent_pickup_drop: computerData.consent_pickup_drop === 'true' ? true : computerData.consent_pickup_drop === 'false' ? false : null,
        consent_date: toNullableString(computerData.consent_date),
        guardian_signature_name: toNullableString(computerData.guardian_signature_name),
        verification_done_by: toNullableString(computerData.verified_by),
        verified_date: toNullableString(computerData.verified_date),
        course_name: toNullableString(computerData.course_name),
        completion_date: toNullableString(computerData.completion_date),
        attendance_percentage: toNullableNumber(computerData.attendance_percentage),
        final_assessment_score: toNullableNumber(computerData.final_assessment_score),
        overall_performance: toNullableString(computerData.overall_performance),
        instructor_name: toNullableString(computerData.instructor_name),
        certificate_issued_on: toNullableString(computerData.certificate_issued_on),
        social_worker_signature: toNullableString(computerData.social_worker_signature),
        dfi_staff_signature: toNullableString(computerData.dfi_staff_signature),
        photo_link: photoLink,
        submitted_by: userId,
      }

      const { data, error } = await supabase
        .from('computer_course')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      const { error: approvalError } = await supabase
        .from('vocational_training_approvals')
        .insert([{
          entity_type: 'computer_course',
          entity_id: data.id,
          submitted_by: userId,
          status: 'Pending',
        }])

      if (approvalError) throw approvalError

      setComputerMessage({ type: 'success', text: 'Computer course data submitted for approval.' })
      setComputerData(createEmptyComputerCourseForm())
      setComputerPhotoFile(null)
      setComputerPhotoPreview('')
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setComputerMessage({ type: 'error', text: `Unable to save: ${fallback}` })
    } finally {
      setComputerLoading(false)
      setIsSubmittingComputer(false)
    }
  }

  const openEditModal = (record: any, type: RejectedSubTabType) => {
    setEditingRecord(record)
    setEditModalType(type)
    setEditFormData({ ...record })
    setEditPhotoPreview(typeof record.photo_link === 'string' ? record.photo_link : '')
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingRecord(null)
    setEditFormData(null)
    setEditPhotoFile(null)
    setEditPhotoPreview('')
    setEditPhotoInputKey(Date.now())
  }

  const handleEditFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setEditFormData((prev: any) => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleEditPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (file && file.size > 5 * 1024 * 1024) {
      setRejectedMessage({ type: 'error', text: 'Image must be 5MB or smaller.' })
      event.target.value = ''
      setEditPhotoFile(null)
      setEditPhotoPreview('')
      setEditFormData((prev: any) => ({ ...prev, photo_link: prev.photo_link }))
      setEditPhotoInputKey(Date.now())
      return
    }

    setEditPhotoFile(file)
    setEditFormData((prev: any) => ({ ...prev, photo_link: file ? file.name : prev.photo_link }))

    if (!file) {
      setEditPhotoPreview('')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setEditPhotoPreview((e.target?.result as string) || '')
    }
    reader.readAsDataURL(file)
  }

  const handleEditSubmit = async () => {
    setEditLoading(true)
    setRejectedMessage(null)

    try {
      if (!editingRecord || !editFormData) {
        throw new Error('No record to edit.')
      }

      let tableName = ''
      const { record_id, approval_id, id } = editingRecord
      console.log("Record fields:", Object.keys(editingRecord))
      console.log("Approval ID from record:", approval_id)
      console.log("ID field:", id)

      const approvalId = approval_id || id
      if (!approvalId) {
        throw new Error('Approval ID not found in record.')
      }

      switch (editModalType) {
        case 'child':
          tableName = 'Child_Data'
          break
        case 'family':
          tableName = 'childfmly'
          break
        case 'sibling':
          tableName = 'childsibling'
          break
        case 'uniform':
          tableName = 'childuniform'
          break
        case 'leaving':
          tableName = 'childleaving'
          break
        case 'vocational':
          tableName = 'vocational_course'
          break
        case 'computer':
          tableName = 'computer_course'
          break
      }

      // Handle photo upload for child data
      let photoUrl: string | null = editFormData.photo_link
      if (editPhotoFile && editModalType === 'child') {
        const registrationNumber = editFormData.reg_no?.toString().trim() || ''
        if (registrationNumber === '') {
          throw new Error('Registration number is required to upload a photo.')
        }

        const extension = (editPhotoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const sanitizedIdentifier = registrationNumber.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()
        const uniqueFallback =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Date.now().toString(36)
        const safeIdentifier = sanitizedIdentifier || uniqueFallback
        const filePath = `${safeIdentifier}.${extension}`

        const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, editPhotoFile, {
          cacheControl: '3600',
          upsert: true,
        })

        if (uploadError) {
          throw uploadError
        }

        const { data: publicData } = supabase.storage.from('profiles').getPublicUrl(filePath)
        photoUrl =
          publicData.publicUrl ??
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile/${filePath}`
      }

      // Helper functions for type conversion
      const toNullableString = (value: any) => {
        if (value === null || value === undefined) return null
        const str = String(value).trim()
        return str === '' ? null : str
      }
      const toNullableNumber = (value: any) => {
        if (value === null || value === undefined || value === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      // Remove record_id and approval_id from update payload
      let updatePayload: any = { ...editFormData }
      delete updatePayload.record_id
      delete updatePayload.approval_id
      delete updatePayload.rejection_reason
      delete updatePayload.rejected_at

      // Convert types based on form type
      if (editModalType === 'child') {
        updatePayload = {
          eac_no: toNullableNumber(updatePayload.eac_no),
          village_name: toNullableString(updatePayload.village_name),
          centre_id: toNullableString(updatePayload.centre_id),
          district: toNullableString(updatePayload.district),
          taluk: toNullableString(updatePayload.taluk),
          panchayat: toNullableString(updatePayload.panchayat),
          village: toNullableString(updatePayload.village),
          adm_date: toNullableString(updatePayload.adm_date),
          dateofbirth: toNullableString(updatePayload.dateofbirth),
          first_name: toNullableString(updatePayload.first_name),
          last_name: toNullableString(updatePayload.last_name),
          gender: toNullableString(updatePayload.gender),
          religion: toNullableString(updatePayload.religion),
          aadhar_no: toNullableNumber(updatePayload.aadhar_no),
          birth_place: toNullableString(updatePayload.birth_place),
          height: toNullableNumber(updatePayload.height),
          weight: toNullableNumber(updatePayload.weight),
          blood_group: toNullableString(updatePayload.blood_group),
          health: toNullableString(updatePayload.health),
          caste: toNullableString(updatePayload.caste),
          mother_tongue: toNullableString(updatePayload.mother_tongue),
          class_std_text: toNullableString(updatePayload.class_std_text),
          school_name: toNullableString(updatePayload.school_name),
          school_category: toNullableString(updatePayload.school_category),
          sats_no: toNullableNumber(updatePayload.sats_no),
          pen_no: toNullableNumber(updatePayload.pen_no),
          medium_of_study: toNullableString(updatePayload.medium_of_study),
          life_ambition: toNullableString(updatePayload.life_ambition),
          fav_subject: toNullableString(updatePayload.fav_subject),
          child_other_info: toNullableString(updatePayload.child_other_info),
          photo_link: photoUrl,
        }
      } else if (editModalType === 'family') {
        updatePayload = {
          village_name: toNullableString(updatePayload.village_name),
          eac_no: toNullableString(updatePayload.eac_no),
          reg_no: toNullableNumber(updatePayload.reg_no),
          f_name: toNullableString(updatePayload.f_name),
          f_occup: toNullableString(updatePayload.f_occup),
          f_inc: toNullableNumber(updatePayload.f_inc),
          f_aadhar: toNullableString(updatePayload.f_aadhar),
          f_mobile: toNullableString(updatePayload.f_mobile),
          m_name: toNullableString(updatePayload.m_name),
          m_occup: toNullableString(updatePayload.m_occup),
          m_inc: toNullableNumber(updatePayload.m_inc),
          m_aadhar: toNullableString(updatePayload.m_aadhar),
          m_mobile: toNullableString(updatePayload.m_mobile),
          fmly_addr1: toNullableString(updatePayload.fmly_addr1),
          fmly_addr2: toNullableString(updatePayload.fmly_addr2),
          fmly_addr3: toNullableString(updatePayload.fmly_addr3),
          fmly_pincode: toNullableString(updatePayload.fmly_pincode),
          fmly_remarks: toNullableString(updatePayload.fmly_remarks),
        }
      } else if (editModalType === 'sibling') {
        updatePayload = {
          village_name: toNullableString(updatePayload.village_name),
          eac_no: toNullableString(updatePayload.eac_no),
          reg_no: toNullableNumber(updatePayload.reg_no),
          names_1: toNullableString(updatePayload.names_1),
          ages_1: toNullableNumber(updatePayload.ages_1),
          genders_1: toNullableString(updatePayload.genders_1),
          class_occup_1: toNullableString(updatePayload.class_occup_1),
          names_2: toNullableString(updatePayload.names_2),
          ages_2: toNullableNumber(updatePayload.ages_2),
          genders_2: toNullableString(updatePayload.genders_2),
          class_occup_2: toNullableString(updatePayload.class_occup_2),
          names_3: toNullableString(updatePayload.names_3),
          ages_3: toNullableNumber(updatePayload.ages_3),
          genders_3: toNullableString(updatePayload.genders_3),
          class_occup_3: toNullableString(updatePayload.class_occup_3),
          names_4: toNullableString(updatePayload.names_4),
          ages_4: toNullableNumber(updatePayload.ages_4),
          genders_4: toNullableString(updatePayload.genders_4),
          class_occup_4: toNullableString(updatePayload.class_occup_4),
          names_5: toNullableString(updatePayload.names_5),
          ages_5: toNullableNumber(updatePayload.ages_5),
          genders_5: toNullableString(updatePayload.genders_5),
          class_occup_5: toNullableString(updatePayload.class_occup_5),
          sibling_remarks: toNullableString(updatePayload.sibling_remarks),
        }
      } else if (editModalType === 'uniform') {
        updatePayload = {
          village_name: toNullableString(updatePayload.village_name),
          eac_no: toNullableString(updatePayload.eac_no),
          reg_no: toNullableNumber(updatePayload.reg_no),
          shirtsize: toNullableString(updatePayload.shirtsize),
          knickersize: toNullableString(updatePayload.knickersize),
          pant_skirtsize: toNullableString(updatePayload.pant_skirtsize),
          chudidharsize: toNullableString(updatePayload.chudidharsize),
          top_pantsize: toNullableString(updatePayload.top_pantsize),
          footwearsize: toNullableString(updatePayload.footwearsize),
          uniform_updated: toNullableString(updatePayload.uniform_updated),
        }
      } else if (editModalType === 'leaving') {
        updatePayload = {
          eac_no: toNullableString(updatePayload.eac_no),
          reg_no: toNullableString(updatePayload.reg_no),
          reason: toNullableString(updatePayload.reason),
          pass_status: toNullableString(updatePayload.pass_status),
          leav_class: toNullableString(updatePayload.leav_class),
          leav_date: toNullableString(updatePayload.leav_date),
          leav_addr1: toNullableString(updatePayload.leav_addr1),
          leav_addr2: toNullableString(updatePayload.leav_addr2),
          leav_addr3: toNullableString(updatePayload.leav_addr3),
          leav_pincode: toNullableString(updatePayload.leav_pincode),
          leav_remarks: toNullableString(updatePayload.leav_remarks),
        }
      } else if (editModalType === 'vocational') {
        updatePayload = {
          eac_no: toNullableString(updatePayload.eac_no),
          reg_no: toNullableString(updatePayload.reg_no),
          trainee_name: toNullableString(updatePayload.trainee_name),
          reason_for_leaving: toNullableString(updatePayload.reason),
        }
      } else if (editModalType === 'computer') {
        updatePayload = {
          eac_no: toNullableString(updatePayload.eac_no),
          reg_no: toNullableString(updatePayload.reg_no),
          child_name: toNullableString(updatePayload.child_name),
        }
      }

      // Update base table
      // For vocational/computer, use 'id', for others use 'record_id'
      const idField = ['vocational', 'computer'].includes(editModalType) ? 'id' : 'record_id'
      const idValue = editingRecord[idField] || editingRecord.record_id || editingRecord.id

      let updateResult = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq(idField, idValue)

      if (updateResult.error && editModalType === 'family' && hasFamilyIncomeColumnError(updateResult.error)) {
        const { f_inc, m_inc, ...restPayload } = updatePayload
        updateResult = await supabase
          .from(tableName)
          .update({ ...restPayload, f_inc_int: f_inc, m_inc_int: m_inc })
          .eq(idField, idValue)
      }

      if (updateResult.error && hasRegNoIdentityUpdateError(updateResult.error) && Object.prototype.hasOwnProperty.call(updatePayload, 'reg_no')) {
        const { reg_no, ...restPayload } = updatePayload
        updateResult = await supabase
          .from(tableName)
          .update(restPayload)
          .eq(idField, idValue)
      }

      if (updateResult.error) throw updateResult.error

      // Reset approval status to Pending
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      console.log('Current user ID for approval update:', userId)

      // Use correct approval table based on type
      const approvalTableName = ['vocational', 'computer'].includes(editModalType)
        ? 'vocational_training_approvals'
        : 'child_approvals'

      // Build update payload based on table type
      const approvalUpdatePayload = ['vocational', 'computer'].includes(editModalType)
        ? {
          status: 'Pending',
          rejection_reason: null,
        }
        : {
          status: 'Pending',
          rejection_reason: null,
          decided_by: null,
          decided_at: null,
          resubmitted_at: new Date().toISOString(),
        }

      const { error: approvalError } = await supabase
        .from(approvalTableName)
        .update(approvalUpdatePayload)
        .eq('id', approval_id)

      if (approvalError) {
        console.error('Approval update error:', approvalError)
        throw new Error(`Failed to update approval status: ${approvalError.message}`)
      }

      setRejectedMessage({ type: 'success', text: `${editModalType} data updated and resubmitted for approval.` })
      closeEditModal()
      fetchRejectedData(activeRejectedSubTab)
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setRejectedMessage({ type: 'error', text: `Unable to save: ${fallback}` })
    } finally {
      setEditLoading(false)
    }
  }

  const handleResubmit = async (record: any, type: RejectedSubTabType) => {
    if (!confirm('Are you sure you want to resubmit this entry without editing?')) {
      return
    }

    setRejectedLoading(true)
    setRejectedMessage(null)

    try {
      const { record_id, approval_id } = record
      let tableName = ''

      switch (type) {
        case 'child':
          tableName = 'Child_Data'
          break
        case 'family':
          tableName = 'childfmly'
          break
        case 'sibling':
          tableName = 'childsibling'
          break
        case 'uniform':
          tableName = 'childuniform'
          break
        case 'leaving':
          tableName = 'childleaving'
          break
        case 'vocational':
          tableName = 'vocational_course'
          break
        case 'computer':
          tableName = 'computer_course'
          break
      }

      // Reset approval status to Pending without updating data
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      console.log('Current user ID for resubmit:', userId)

      // Use correct approval table based on type
      const approvalTableName = ['vocational', 'computer'].includes(type)
        ? 'vocational_training_approvals'
        : 'child_approvals'

      // Build update payload based on table type
      const approvalUpdatePayload = ['vocational', 'computer'].includes(type)
        ? {
          status: 'Pending',
          rejection_reason: null,
        }
        : {
          status: 'Pending',
          rejection_reason: null,
          decided_by: null,
          decided_at: null,
          resubmitted_at: new Date().toISOString(),
        }

      const { error: approvalError } = await supabase
        .from(approvalTableName)
        .update(approvalUpdatePayload)
        .eq('id', approval_id)

      if (approvalError) {
        console.error('Resubmit approval error:', approvalError)
        throw new Error(`Failed to resubmit approval: ${approvalError.message}`)
      }

      setRejectedMessage({ type: 'success', text: `${type} data resubmitted for approval.` })
      fetchRejectedData(activeRejectedSubTab)
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setRejectedMessage({ type: 'error', text: `Unable to resubmit: ${fallback}` })
    } finally {
      setRejectedLoading(false)
    }
  }

  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['field_volunteer'])

  useEffect(() => {
    if (typeof window === 'undefined') return
    refreshChildDraftSummaries()
    const latestRegNo = window.localStorage.getItem(CHILD_DRAFT_LATEST_REG_KEY)?.trim() || ''
    if (!latestRegNo) return
    if (!window.localStorage.getItem(getDraftStorageKey(latestRegNo))) return

    setFormData((prev) => {
      if (prev.reg_no?.trim()) return prev
      return { ...prev, reg_no: latestRegNo }
    })
  }, [])

  useEffect(() => {
    setDraftExistsForRegNo(hasDraftForRegistrationNo(formData.reg_no))
  }, [formData.reg_no])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthorized || !profile) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You don't have permission to access this page.</p>
        </div>
      </main>
    )
  }

  const roleInfo = ROLE_CONFIG.find(r => r.value === 'field_volunteer')!
  const tabs: { id: TabType; label: string }[] = [
    { id: 'child', label: 'Child Data' },
    { id: 'leaving', label: 'Child Leaving' },
    { id: 'vocational', label: 'Vocational Course' },
    { id: 'computer', label: 'Computer Course' },
    { id: 'rejected', label: 'Rejected Data' },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar
        username={profile.username}
        role="field_volunteer"
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color}
      />
      <Sidebar role="field_volunteer" />

      <PageContainer>
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Child Data Entry</h2>
            <p className="text-slate-600 mt-2">Manage child information and course registrations</p>
          </div>

          {/* Messages */}
          {message && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm font-medium mb-6 flex items-center gap-2 ${message.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
                }`}
            >
              {message.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          {/* Data Type Selection Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-8">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabSelection(tab.id as TabType)}
                  className={`flex-1 min-w-[140px] px-4 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content - All forms display here */}
          <div>
            {!activeTab && (
              <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Select a data type to begin</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Click Child Data, Child Leaving, Vocational Course, Computer Course, or Rejected Data to continue.
                </p>
              </section>
            )}

            {activeTab === 'child' && entryGate === 'chooser' && (
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Your Child Data Drafts</h3>
                    <p className="mt-1 text-sm text-slate-600">Continue an unfinished draft or start a new entry.</p>
                  </div>
                  <button
                    type="button"
                    onClick={startNewChildEntry}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    New Entry
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {childDraftSummaries.map((draft) => (
                    <div key={draft.regNo} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Registration No: {draft.regNo}</p>
                          <p className="text-xs text-slate-500">
                            Last saved: {draft.savedAt ? new Date(draft.savedAt).toLocaleString() : 'Unknown'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => loadChildDraftByRegistrationNo(draft.regNo)}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                          >
                            Continue
                          </button>
                          <button
                            type="button"
                            onClick={() => clearChildDraft(draft.regNo)}
                            className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50"
                          >
                            Delete Draft
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Child Data Tab */}
            {activeTab === 'child' && entryGate === 'form' && (
              <div className="space-y-8">
                <form onSubmit={handleUnifiedSubmit} className="space-y-8">
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">Unified Child Profile Form</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Step {wizardStep + 1} of {wizardSteps.length}: {wizardSteps[wizardStep].label}
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Step {wizardStep + 1}
                      </span>
                    </div>

                    <div className="mb-5 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all"
                        style={{ width: `${((wizardStep + 1) / wizardSteps.length) * 100}%` }}
                      />
                    </div>

                    <div className="mb-6 grid gap-2 md:grid-cols-4">
                      {wizardSteps.map((step, index) => (
                        <div
                          key={step.id}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${index <= wizardStep
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-500'
                            }`}
                        >
                          {index + 1}. {step.label}
                        </div>
                      ))}
                    </div>

                    {wizardStep === 0 && (
                      <div className="space-y-8">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">EAC No *</label>
                            <select
                              name="eac_no"
                              value={formData.eac_no}
                              onChange={handleEacChange}
                              required
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            >
                              <option value="">Select EAC No</option>
                              {eacOptions.map((eac) => (
                                <option key={eac.eac_no} value={eac.eac_no}>
                                  {eac.eac_no}
                                </option>
                              ))}
                            </select>
                          </div>
                          <TextInput
                            label="Registration Number *"
                            name="reg_no"
                            value={formData.reg_no}
                            onChange={handleChange}
                          />
                          <ReadOnlyInput label="Village Name" value={formData.village_name} />
                          <ReadOnlyInput label="District" value={formData.district} />
                          <ReadOnlyInput label="Taluk" value={formData.taluk} />
                          <ReadOnlyInput label="Panchayat" value={formData.panchayat} />
                          <ReadOnlyInput label="Village" value={formData.village} />
                          <TextInput label="Admission Date" name="adm_date" value={formData.adm_date} onChange={handleChange} type="date" />
                          <TextInput label="Date of Birth" name="dateofbirth" value={formData.dateofbirth} onChange={handleChange} type="date" max={todayIsoDate} />
                          <TextInput label="First Name *" name="first_name" value={formData.first_name} onChange={handleChange} />
                          <TextInput label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} />

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                            <select
                              name="gender"
                              value={formData.gender}
                              onChange={handleChange}
                              required
                              className={baseInputClass}
                            >
                              <option value="">Select Gender</option>
                              {genderOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Religion</label>
                            <select
                              name="religion"
                              value={formData.religion}
                              onChange={handleChange}
                              className={baseInputClass}
                            >
                              <option value="">Select Religion</option>
                              {religionOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          <NumberInput label="Aadhar No" name="aadhar_no" value={formData.aadhar_no} onChange={handleChange} />
                          <TextInput label="Birth Place" name="birth_place" value={formData.birth_place} onChange={handleChange} required />
                          <NumberInput label="Height (cm)" name="height" value={formData.height} onChange={handleChange} />
                          <NumberInput label="Weight (kg)" name="weight" value={formData.weight} onChange={handleChange} />

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Blood Group</label>
                            <select
                              name="blood_group"
                              value={formData.blood_group}
                              onChange={handleChange}
                              required
                              className={baseInputClass}
                            >
                              <option value="">Select Blood Group</option>
                              {bloodGroupOptions.map((group) => (
                                <option key={group} value={group}>{group}</option>
                              ))}
                            </select>
                          </div>

                          <TextInput label="Health Status" name="health" value={formData.health} onChange={handleChange} required />
                          <TextInput label="Caste" name="caste" value={formData.caste} onChange={handleChange} required />
                          <TextInput label="Mother Tongue" name="mother_tongue" value={formData.mother_tongue} onChange={handleChange} />
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Class/Standard</label>
                            <select
                              name="class_std_text"
                              value={formData.class_std_text}
                              onChange={handleChange}
                              className={baseInputClass}
                            >
                              <option value="">Select Class/Standard</option>
                              {classStandardOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>
                          <TextInput label="School Name" name="school_name" value={formData.school_name} onChange={handleChange} required />
                          <TextInput label="School Category" name="school_category" value={formData.school_category} onChange={handleChange} required />
                          <NumberInput label="SATS No" name="sats_no" value={formData.sats_no} onChange={handleChange} />
                          <NumberInput label="PEN No" name="pen_no" value={formData.pen_no} onChange={handleChange} />
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Medium of Study</label>
                            <select
                              name="medium_of_study"
                              value={formData.medium_of_study}
                              onChange={handleChange}
                              className={baseInputClass}
                            >
                              <option value="">Select Medium of Study</option>
                              {mediumOfStudyOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Life Ambition</label>
                            <select
                              name="life_ambition"
                              value={formData.life_ambition}
                              onChange={handleChange}
                              className={baseInputClass}
                            >
                              <option value="">Select Life Ambition</option>
                              {lifeAmbitionOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Favorite Subject</label>
                            <select
                              name="fav_subject"
                              value={formData.fav_subject}
                              onChange={handleChange}
                              className={baseInputClass}
                            >
                              <option value="">Select Favorite Subject</option>
                              {favSubjectOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="photoUploadWizard">
                              Child Photo
                            </label>
                            <input
                              key={photoInputKey}
                              id="photoUploadWizard"
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handlePhotoChange}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-md file:border-none file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                            {photoFile && <p className="mt-1 text-xs text-slate-600">Selected: {photoFile.name}</p>}
                            {photoPreview && (
                              <img
                                src={photoPreview}
                                alt="Selected child preview"
                                className="mt-3 h-28 w-28 rounded-lg border border-slate-200 object-cover"
                              />
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Other Information</label>
                          <textarea
                            name="child_other_info"
                            value={formData.child_other_info}
                            onChange={handleChange}
                            rows={4}
                            className={baseInputClass}
                          />
                        </div>
                      </div>
                    )}

                    {wizardStep === 1 && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <TextInput label="Father's Name" name="f_name" value={familyData.f_name} onChange={(e) => setFamilyData({ ...familyData, f_name: e.target.value })} />
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Father's Occupation</label>
                          <select
                            name="f_occup"
                            value={familyData.f_occup}
                            onChange={(e) => setFamilyData({ ...familyData, f_occup: e.target.value })}
                            required={Boolean(familyData.f_name.trim())}
                            className={baseInputClass}
                          >
                            <option value="">Select Father's Occupation</option>
                            {fatherOccupationOptions.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                        <TextInput label="Father's Income" name="f_inc" value={familyData.f_inc} onChange={(e) => setFamilyData({ ...familyData, f_inc: e.target.value })} type="number" />
                        <TextInput label="Father's Aadhar No" name="f_aadhar" value={familyData.f_aadhar} onChange={(e) => setFamilyData({ ...familyData, f_aadhar: e.target.value })} />
                        <TextInput label="Father's Mobile" name="f_mobile" value={familyData.f_mobile} onChange={(e) => setFamilyData({ ...familyData, f_mobile: e.target.value })} />
                        <TextInput label="Mother's Name" name="m_name" value={familyData.m_name} onChange={(e) => setFamilyData({ ...familyData, m_name: e.target.value })} />
                        <TextInput label="Mother's Occupation" name="m_occup" value={familyData.m_occup} onChange={(e) => setFamilyData({ ...familyData, m_occup: e.target.value })} />
                        <TextInput label="Mother's Income" name="m_inc" value={familyData.m_inc} onChange={(e) => setFamilyData({ ...familyData, m_inc: e.target.value })} type="number" />
                        <TextInput label="Mother's Aadhar No" name="m_aadhar" value={familyData.m_aadhar} onChange={(e) => setFamilyData({ ...familyData, m_aadhar: e.target.value })} />
                        <TextInput label="Mother's Mobile" name="m_mobile" value={familyData.m_mobile} onChange={(e) => setFamilyData({ ...familyData, m_mobile: e.target.value })} />

                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 1</label>
                          <textarea name="fmly_addr1" value={familyData.fmly_addr1} onChange={(e) => setFamilyData({ ...familyData, fmly_addr1: e.target.value })} rows={2} className={baseInputClass} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 2</label>
                          <textarea name="fmly_addr2" value={familyData.fmly_addr2} onChange={(e) => setFamilyData({ ...familyData, fmly_addr2: e.target.value })} rows={2} className={baseInputClass} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 3</label>
                          <textarea name="fmly_addr3" value={familyData.fmly_addr3} onChange={(e) => setFamilyData({ ...familyData, fmly_addr3: e.target.value })} rows={2} className={baseInputClass} />
                        </div>
                        <TextInput label="Pincode" name="fmly_pincode" value={familyData.fmly_pincode} onChange={(e) => setFamilyData({ ...familyData, fmly_pincode: e.target.value })} />

                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
                          <textarea name="fmly_remarks" value={familyData.fmly_remarks} onChange={(e) => setFamilyData({ ...familyData, fmly_remarks: e.target.value })} rows={3} className={baseInputClass} />
                        </div>
                      </div>
                    )}

                    {wizardStep === 2 && (
                      <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <div key={num} className="rounded-lg border border-slate-200 p-4">
                            <h3 className="mb-3 text-sm font-semibold text-slate-900">Sibling {num}</h3>
                            <div className="grid gap-4 md:grid-cols-4">
                              <TextInput
                                label={`Sibling ${num} Name`}
                                name={`names_${num}`}
                                value={siblingData[`names_${num}` as keyof ChildSiblingState]}
                                onChange={(e) => setSiblingData({ ...siblingData, [`names_${num}`]: e.target.value })}
                              />
                              <NumberInput
                                name={`ages_${num}`}
                                label="Age"
                                value={siblingData[`ages_${num}` as keyof ChildSiblingState]}
                                onChange={(e) => setSiblingData({ ...siblingData, [`ages_${num}`]: e.target.value })}
                              />
                              <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                                <select
                                  name={`genders_${num}`}
                                  value={siblingData[`genders_${num}` as keyof ChildSiblingState]}
                                  onChange={(e) => setSiblingData({ ...siblingData, [`genders_${num}`]: e.target.value })}
                                  className={baseInputClass}
                                >
                                  <option value="">Select</option>
                                  {genderOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              </div>
                              <TextInput
                                label="Class/Occupation"
                                name={`class_occup_${num}`}
                                value={siblingData[`class_occup_${num}` as keyof ChildSiblingState]}
                                onChange={(e) => setSiblingData({ ...siblingData, [`class_occup_${num}`]: e.target.value })}
                              />
                            </div>
                          </div>
                        ))}
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Sibling Remarks</label>
                          <textarea
                            name="sibling_remarks"
                            value={siblingData.sibling_remarks}
                            onChange={(e) => setSiblingData({ ...siblingData, sibling_remarks: e.target.value })}
                            rows={3}
                            className={baseInputClass}
                          />
                        </div>
                      </div>
                    )}

                    {wizardStep === 3 && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <TextInput label="Shirt Size" name="shirtsize" value={uniformData.shirtsize} onChange={(e) => setUniformData({ ...uniformData, shirtsize: e.target.value })} required />
                        <TextInput label="Knicker Size" name="knickersize" value={uniformData.knickersize} onChange={(e) => setUniformData({ ...uniformData, knickersize: e.target.value })} required />
                        {showPantSkirtSize && (
                          <TextInput label="Pant/Skirt Size" name="pant_skirtsize" value={uniformData.pant_skirtsize} onChange={(e) => setUniformData({ ...uniformData, pant_skirtsize: e.target.value })} required />
                        )}
                        {showChudidharSize && (
                          <TextInput label="Chudidhar Size" name="chudidharsize" value={uniformData.chudidharsize} onChange={(e) => setUniformData({ ...uniformData, chudidharsize: e.target.value })} required />
                        )}
                        {showTopPantSize && (
                          <TextInput label="Top/Pant Size" name="top_pantsize" value={uniformData.top_pantsize} onChange={(e) => setUniformData({ ...uniformData, top_pantsize: e.target.value })} required />
                        )}
                        <TextInput label="Footwear Size *" name="footwearsize" value={uniformData.footwearsize} onChange={(e) => setUniformData({ ...uniformData, footwearsize: e.target.value })} required />
                        <TextInput label="Uniform Updated Date" name="uniform_updated" value={uniformData.uniform_updated} onChange={(e) => setUniformData({ ...uniformData, uniform_updated: e.target.value })} type="date" required />
                      </div>
                    )}
                  </section>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      {childDraftSummaries.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            refreshChildDraftSummaries()
                            setEntryGate('chooser')
                          }}
                          disabled={loading || isSubmittingUnified}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Show My Drafts
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleWizardBack}
                        disabled={wizardStep === 0 || loading}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={saveChildDraft}
                        disabled={loading || isSubmittingUnified}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save Draft
                      </button>
                      <button
                        type="button"
                        onClick={loadChildDraft}
                        disabled={loading || isSubmittingUnified || !formData.reg_no.trim()}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Continue Entry
                      </button>
                      {draftExistsForRegNo && (
                        <button
                          type="button"
                          onClick={() => clearChildDraft()}
                          disabled={loading || isSubmittingUnified}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Clear Draft
                        </button>
                      )}
                    </div>

                    {wizardStep < wizardSteps.length - 1 ? (
                      <button
                        type="button"
                        onClick={handleWizardNext}
                        disabled={loading}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="submit"
                        onMouseDown={() => {
                          finalSubmitArmedRef.current = true
                        }}
                        disabled={loading || isSubmittingUnified}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                      >
                        {loading ? 'Submitting...' : 'Submit Complete Form'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* Child Family Tab */}
            {activeTab === 'family' && (
              <div className="space-y-8">
                {familyMessage && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm font-medium ${familyMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                  >
                    {familyMessage.text}
                  </div>
                )}
                <form onSubmit={handleFamilySubmit} className="space-y-8">
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Family Information</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Village Name"
                        name="village_name"
                        value={familyData.village_name}
                        onChange={(e) => setFamilyData({ ...familyData, village_name: e.target.value })}
                      />
                      <TextInput
                        label="EAC No"
                        name="eac_no"
                        value={familyData.eac_no}
                        onChange={(e) => setFamilyData({ ...familyData, eac_no: e.target.value })}
                      />

                      <div className="md:col-span-2 border-t pt-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Father's Information</h3>
                      </div>
                      <TextInput
                        label="Father's Name"
                        name="f_name"
                        value={familyData.f_name}
                        onChange={(e) => setFamilyData({ ...familyData, f_name: e.target.value })}
                      />
                      <TextInput
                        label="Father's Occupation"
                        name="f_occup"
                        value={familyData.f_occup}
                        onChange={(e) => setFamilyData({ ...familyData, f_occup: e.target.value })}
                      />
                      <TextInput
                        label="Father's Income"
                        name="f_inc"
                        value={familyData.f_inc}
                        onChange={(e) => setFamilyData({ ...familyData, f_inc: e.target.value })}
                        type="number"
                      />
                      <TextInput
                        label="Father's Aadhar No"
                        name="f_aadhar"
                        value={familyData.f_aadhar}
                        onChange={(e) => setFamilyData({ ...familyData, f_aadhar: e.target.value })}
                      />
                      <TextInput
                        label="Father's Mobile"
                        name="f_mobile"
                        value={familyData.f_mobile}
                        onChange={(e) => setFamilyData({ ...familyData, f_mobile: e.target.value })}
                      />

                      <div className="md:col-span-2 border-t pt-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Mother's Information</h3>
                      </div>
                      <TextInput
                        label="Mother's Name"
                        name="m_name"
                        value={familyData.m_name}
                        onChange={(e) => setFamilyData({ ...familyData, m_name: e.target.value })}
                      />
                      <TextInput
                        label="Mother's Occupation"
                        name="m_occup"
                        value={familyData.m_occup}
                        onChange={(e) => setFamilyData({ ...familyData, m_occup: e.target.value })}
                      />
                      <TextInput
                        label="Mother's Income"
                        name="m_inc"
                        value={familyData.m_inc}
                        onChange={(e) => setFamilyData({ ...familyData, m_inc: e.target.value })}
                        type="number"
                      />
                      <TextInput
                        label="Mother's Aadhar No"
                        name="m_aadhar"
                        value={familyData.m_aadhar}
                        onChange={(e) => setFamilyData({ ...familyData, m_aadhar: e.target.value })}
                      />
                      <TextInput
                        label="Mother's Mobile"
                        name="m_mobile"
                        value={familyData.m_mobile}
                        onChange={(e) => setFamilyData({ ...familyData, m_mobile: e.target.value })}
                      />

                      <div className="md:col-span-2 border-t pt-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Family Address</h3>
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 1</label>
                        <textarea
                          name="fmly_addr1"
                          value={familyData.fmly_addr1}
                          onChange={(e) => setFamilyData({ ...familyData, fmly_addr1: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 2</label>
                        <textarea
                          name="fmly_addr2"
                          value={familyData.fmly_addr2}
                          onChange={(e) => setFamilyData({ ...familyData, fmly_addr2: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 3</label>
                        <textarea
                          name="fmly_addr3"
                          value={familyData.fmly_addr3}
                          onChange={(e) => setFamilyData({ ...familyData, fmly_addr3: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <TextInput
                        label="Pincode"
                        name="fmly_pincode"
                        value={familyData.fmly_pincode}
                        onChange={(e) => setFamilyData({ ...familyData, fmly_pincode: e.target.value })}
                      />

                      <div className="md:col-span-2 border-t pt-4">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
                        <textarea
                          name="fmly_remarks"
                          value={familyData.fmly_remarks}
                          onChange={(e) => setFamilyData({ ...familyData, fmly_remarks: e.target.value })}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </section>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={familyLoading}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {familyLoading ? 'Saving...' : 'Save Family Data'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Child Sibling Tab */}
            {activeTab === 'sibling' && (
              <div className="space-y-8">
                {siblingMessage && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm font-medium ${siblingMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                  >
                    {siblingMessage.text}
                  </div>
                )}
                <form onSubmit={handleSiblingSubmit} className="space-y-8">
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Sibling Information</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Village Name"
                        name="village_name"
                        value={siblingData.village_name}
                        onChange={(e) => setSiblingData({ ...siblingData, village_name: e.target.value })}
                      />
                      <TextInput
                        label="EAC No"
                        name="eac_no"
                        value={siblingData.eac_no}
                        onChange={(e) => setSiblingData({ ...siblingData, eac_no: e.target.value })}
                      />

                      {[1, 2, 3, 4, 5].map((num) => (
                        <div key={num} className="md:col-span-2 border-t pt-4">
                          <h3 className="font-semibold text-slate-900 mb-4">Sibling {num}</h3>
                          <div className="grid gap-4 md:grid-cols-4">
                            <TextInput
                              label={`Sibling ${num} Name`}
                              name={`names_${num}`}
                              value={siblingData[`names_${num}` as keyof ChildSiblingState]}
                              onChange={(e) => setSiblingData({ ...siblingData, [`names_${num}`]: e.target.value })}
                            />
                            <NumberInput
                              name={`ages_${num}`}
                              label={`Age`}
                              value={siblingData[`ages_${num}` as keyof ChildSiblingState]}
                              onChange={(e) => setSiblingData({ ...siblingData, [`ages_${num}`]: e.target.value })}
                            />
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                              <select
                                name={`genders_${num}`}
                                value={siblingData[`genders_${num}` as keyof ChildSiblingState]}
                                onChange={(e) => setSiblingData({ ...siblingData, [`genders_${num}`]: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                              >
                                <option value="">Select</option>
                                {genderOptions.map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            </div>
                            <TextInput
                              label={`Class/Occupation`}
                              name={`class_occup_${num}`}
                              value={siblingData[`class_occup_${num}` as keyof ChildSiblingState]}
                              onChange={(e) => setSiblingData({ ...siblingData, [`class_occup_${num}`]: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}

                      <div className="md:col-span-2 border-t pt-4">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Sibling Remarks</label>
                        <textarea
                          name="sibling_remarks"
                          value={siblingData.sibling_remarks}
                          onChange={(e) => setSiblingData({ ...siblingData, sibling_remarks: e.target.value })}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </section>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={siblingLoading}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {siblingLoading ? 'Saving...' : 'Save Sibling Data'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Child Uniform Tab */}
            {activeTab === 'uniform' && (
              <div className="space-y-8">
                {uniformMessage && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm font-medium ${uniformMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                  >
                    {uniformMessage.text}
                  </div>
                )}
                <form onSubmit={handleUniformSubmit} className="space-y-8">
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Uniform Information</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Village Name"
                        name="village_name"
                        value={uniformData.village_name}
                        onChange={(e) => setUniformData({ ...uniformData, village_name: e.target.value })}
                      />
                      <TextInput
                        label="EAC No"
                        name="eac_no"
                        value={uniformData.eac_no}
                        onChange={(e) => setUniformData({ ...uniformData, eac_no: e.target.value })}
                      />

                      <div className="md:col-span-2 border-t pt-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Uniform Sizes</h3>
                      </div>
                      <TextInput
                        label="Shirt Size"
                        name="shirtsize"
                        value={uniformData.shirtsize}
                        onChange={(e) => setUniformData({ ...uniformData, shirtsize: e.target.value })}
                      />
                      <TextInput
                        label="Knicker Size"
                        name="knickersize"
                        value={uniformData.knickersize}
                        onChange={(e) => setUniformData({ ...uniformData, knickersize: e.target.value })}
                      />
                      <TextInput
                        label="Pant/Skirt Size"
                        name="pant_skirtsize"
                        value={uniformData.pant_skirtsize}
                        onChange={(e) => setUniformData({ ...uniformData, pant_skirtsize: e.target.value })}
                      />
                      <TextInput
                        label="Chudidhar Size"
                        name="chudidharsize"
                        value={uniformData.chudidharsize}
                        onChange={(e) => setUniformData({ ...uniformData, chudidharsize: e.target.value })}
                      />
                      <TextInput
                        label="Top/Pant Size"
                        name="top_pantsize"
                        value={uniformData.top_pantsize}
                        onChange={(e) => setUniformData({ ...uniformData, top_pantsize: e.target.value })}
                      />
                      <TextInput
                        label="Footwear Size"
                        name="footwearsize"
                        value={uniformData.footwearsize}
                        onChange={(e) => setUniformData({ ...uniformData, footwearsize: e.target.value })}
                      />
                      <TextInput
                        label="Uniform Updated Date"
                        name="uniform_updated"
                        value={uniformData.uniform_updated}
                        onChange={(e) => setUniformData({ ...uniformData, uniform_updated: e.target.value })}
                        type="date"
                      />
                    </div>
                  </section>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={uniformLoading}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {uniformLoading ? 'Saving...' : 'Save Uniform Data'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Child Leaving Tab */}
            {activeTab === 'leaving' && entryGate === 'form' && (
              <div className="space-y-8">
                {leavingMessage && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm font-medium ${leavingMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                  >
                    {leavingMessage.text}
                  </div>
                )}
                <form onSubmit={handleLeavingSubmit} className="space-y-8">
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Child Leaving Record</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="EAC No"
                        name="eac_no"
                        value={leavingData.eac_no}
                        onChange={(e) => setLeavingData({ ...leavingData, eac_no: e.target.value })}
                      />
                      <TextInput
                        label="Registration No *"
                        name="reg_no"
                        value={leavingData.reg_no}
                        onChange={(e) => setLeavingData({ ...leavingData, reg_no: e.target.value })}
                      />
                      <TextInput
                        label="Reason for Leaving"
                        name="reason"
                        value={leavingData.reason}
                        onChange={(e) => setLeavingData({ ...leavingData, reason: e.target.value })}
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Pass Status</label>
                        <select
                          name="pass_status"
                          value={leavingData.pass_status}
                          onChange={(e) => setLeavingData({ ...leavingData, pass_status: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select Pass Status</option>
                          {passStatusOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <TextInput
                        label="Leaving Class/Standard"
                        name="leav_class"
                        value={leavingData.leav_class}
                        onChange={(e) => setLeavingData({ ...leavingData, leav_class: e.target.value })}
                      />
                      <TextInput
                        label="Leaving Date"
                        name="leav_date"
                        value={leavingData.leav_date}
                        onChange={(e) => setLeavingData({ ...leavingData, leav_date: e.target.value })}
                        type="date"
                      />

                      <div className="md:col-span-2 border-t pt-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Forwarding Address</h3>
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 1</label>
                        <textarea
                          name="leav_addr1"
                          value={leavingData.leav_addr1}
                          onChange={(e) => setLeavingData({ ...leavingData, leav_addr1: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 2</label>
                        <textarea
                          name="leav_addr2"
                          value={leavingData.leav_addr2}
                          onChange={(e) => setLeavingData({ ...leavingData, leav_addr2: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 3</label>
                        <textarea
                          name="leav_addr3"
                          value={leavingData.leav_addr3}
                          onChange={(e) => setLeavingData({ ...leavingData, leav_addr3: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <TextInput
                        label="Pincode"
                        name="leav_pincode"
                        value={leavingData.leav_pincode}
                        onChange={(e) => setLeavingData({ ...leavingData, leav_pincode: e.target.value })}
                      />

                      <div className="md:col-span-2 border-t pt-4">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
                        <textarea
                          name="leav_remarks"
                          value={leavingData.leav_remarks}
                          onChange={(e) => setLeavingData({ ...leavingData, leav_remarks: e.target.value })}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </section>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={leavingLoading}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {leavingLoading ? 'Saving...' : 'Save Leaving Data'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Vocational Course Tab */}
            {activeTab === 'vocational' && entryGate === 'form' && (
              <div className="space-y-8">
                {vocationalMessage && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm font-medium ${vocationalMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                  >
                    {vocationalMessage.text}
                  </div>
                )}
                <form onSubmit={handleVocationalSubmit} className="space-y-8">
                  {/* Photo Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Photo</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Upload Photo
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleVocationalPhotoChange}
                          disabled={vocationalPhotoUploading}
                          className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-100"
                        />
                        <p className="mt-1 text-xs text-slate-500">JPG, PNG or GIF (max. 5MB)</p>
                      </div>
                      {vocationalPhotoPreview && (
                        <div className="flex flex-col items-center gap-4">
                          <img
                            src={vocationalPhotoPreview}
                            alt="Preview"
                            className="h-32 w-32 rounded-lg border border-slate-200 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setVocationalPhotoFile(null)
                              setVocationalPhotoPreview('')
                            }}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Remove Photo
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Registration & Admission Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Registration & Admission</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Date of Admission"
                        name="date_of_admission"
                        value={vocationalData.date_of_admission}
                        onChange={handleVocationalChange}
                        type="date"
                      />
                      <TextInput
                        label="EAC No"
                        name="eac_no"
                        value={vocationalData.eac_no}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Registration No"
                        name="reg_no"
                        value={vocationalData.reg_no}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Batch No"
                        name="batch_no"
                        value={vocationalData.batch_no}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Batch Timings"
                        name="batch_timings"
                        value={vocationalData.batch_timings}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Centre No"
                        name="centre_no"
                        value={vocationalData.centre_no}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="District"
                        name="district"
                        value={vocationalData.district}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Taluk"
                        name="taluk"
                        value={vocationalData.taluk}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Panchayat"
                        name="panchayat"
                        value={vocationalData.panchayat}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Village"
                        name="village"
                        value={vocationalData.village}
                        onChange={handleVocationalChange}
                      />
                    </div>
                  </section>

                  {/* Personal Information Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Personal Information</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Trainee Name *"
                        name="trainee_name"
                        value={vocationalData.trainee_name}
                        onChange={handleVocationalChange}
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                        <select
                          name="gender"
                          value={vocationalData.gender}
                          onChange={handleVocationalChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <TextInput
                        label="Aadhar No"
                        name="aadhar_no"
                        value={vocationalData.aadhar_no}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Date of Birth"
                        name="date_of_birth"
                        value={vocationalData.date_of_birth}
                        onChange={handleVocationalChange}
                        type="date"
                      />
                      <TextInput
                        label="Place of Birth"
                        name="place_of_birth"
                        value={vocationalData.place_of_birth}
                        onChange={handleVocationalChange}
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Blood Group</label>
                        <select
                          name="blood_group"
                          value={vocationalData.blood_group}
                          onChange={handleVocationalChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select blood group</option>
                          {bloodGroupOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Marital Status</label>
                        <select
                          name="marital_status"
                          value={vocationalData.marital_status}
                          onChange={handleVocationalChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select status</option>
                          <option value="Unmarried">Unmarried</option>
                          <option value="Married">Married</option>
                          <option value="Widow">Widow</option>
                          <option value="Divorced">Divorced</option>
                        </select>
                      </div>
                      <TextInput
                        label="Mother Tongue"
                        name="mother_tongue"
                        value={vocationalData.mother_tongue}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Religion"
                        name="religion"
                        value={vocationalData.religion}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Caste"
                        name="caste"
                        value={vocationalData.caste}
                        onChange={handleVocationalChange}
                      />
                    </div>
                  </section>

                  {/* Educational Background Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Educational Background</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Class/Standard Studied"
                        name="class_standard_studied"
                        value={vocationalData.class_standard_studied}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="School Name"
                        name="school_name"
                        value={vocationalData.school_name}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Medium of Study"
                        name="medium_of_study"
                        value={vocationalData.medium_of_study}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Ambition in Life"
                        name="ambition_in_life"
                        value={vocationalData.ambition_in_life}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Favourite Subject"
                        name="favourite_subject"
                        value={vocationalData.favourite_subject}
                        onChange={handleVocationalChange}
                      />
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Other Information</label>
                        <textarea
                          name="other_information"
                          value={vocationalData.other_information}
                          onChange={handleVocationalChange}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Family Information Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Family Information</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Father/Husband Name"
                        name="father_or_husband_name"
                        value={vocationalData.father_or_husband_name}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Father Occupation"
                        name="father_occupation"
                        value={vocationalData.father_occupation}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Father Income"
                        name="father_income"
                        value={vocationalData.father_income}
                        onChange={handleVocationalChange}
                        type="number"
                      />
                      <TextInput
                        label="Father Aadhar No"
                        name="father_aadhar_no"
                        value={vocationalData.father_aadhar_no}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Father Mobile"
                        name="father_mobile"
                        value={vocationalData.father_mobile}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Mother Name"
                        name="mother_name"
                        value={vocationalData.mother_name}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Mother Occupation"
                        name="mother_occupation"
                        value={vocationalData.mother_occupation}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Mother Income"
                        name="mother_income"
                        value={vocationalData.mother_income}
                        onChange={handleVocationalChange}
                        type="number"
                      />
                      <TextInput
                        label="Mother Aadhar No"
                        name="mother_aadhar_no"
                        value={vocationalData.mother_aadhar_no}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Mother Mobile"
                        name="mother_mobile"
                        value={vocationalData.mother_mobile}
                        onChange={handleVocationalChange}
                      />
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Parent/Guardian Address</label>
                        <textarea
                          name="parent_guardian_address"
                          value={vocationalData.parent_guardian_address}
                          onChange={handleVocationalChange}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Course & Training Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Course & Training Details</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Enrolled Course</label>
                        <select
                          name="enrolled_course"
                          value={vocationalData.enrolled_course}
                          onChange={handleVocationalChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select a course</option>
                          {vocationalCourseOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Attended Other Training</label>
                        <select
                          name="attended_other_training"
                          value={vocationalData.attended_other_training}
                          onChange={handleVocationalChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Previous Training Details</label>
                        <textarea
                          name="previous_training_details"
                          value={vocationalData.previous_training_details}
                          onChange={handleVocationalChange}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <TextInput
                        label="Plan After Course"
                        name="plan_after_course"
                        value={vocationalData.plan_after_course}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Present Status"
                        name="present_status"
                        value={vocationalData.present_status}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Education/Training/Employment"
                        name="education_training_employment"
                        value={vocationalData.education_training_employment}
                        onChange={handleVocationalChange}
                      />
                    </div>
                  </section>

                  {/* Leaving & Follow-up Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Leaving & Follow-up</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Reason for Leaving"
                        name="reason_for_leaving"
                        value={vocationalData.reason_for_leaving}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Leaving Date"
                        name="leaving_date"
                        value={vocationalData.leaving_date}
                        onChange={handleVocationalChange}
                        type="date"
                      />
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Present Address</label>
                        <textarea
                          name="present_address"
                          value={vocationalData.present_address}
                          onChange={handleVocationalChange}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <TextInput
                        label="Recommended By"
                        name="recommended_by"
                        value={vocationalData.recommended_by}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Recommended Date"
                        name="recommended_date"
                        value={vocationalData.recommended_date}
                        onChange={handleVocationalChange}
                        type="date"
                      />
                    </div>
                  </section>

                  {/* Signatures & Verification Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Signatures & Verification</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Trainee Signature Date"
                        name="trainee_signature_date"
                        value={vocationalData.trainee_signature_date}
                        onChange={handleVocationalChange}
                        type="date"
                      />
                      <TextInput
                        label="Parent/Guardian Name"
                        name="parent_guardian_name"
                        value={vocationalData.parent_guardian_name}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Parent/Guardian Signature Date"
                        name="parent_guardian_signature_date"
                        value={vocationalData.parent_guardian_signature_date}
                        onChange={handleVocationalChange}
                        type="date"
                      />
                      <TextInput
                        label="Verified by Social Worker"
                        name="verified_by_social_worker"
                        value={vocationalData.verified_by_social_worker}
                        onChange={handleVocationalChange}
                      />
                      <TextInput
                        label="Verified by DFI Staff"
                        name="verified_by_dfi_staff"
                        value={vocationalData.verified_by_dfi_staff}
                        onChange={handleVocationalChange}
                      />
                    </div>
                  </section>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={vocationalLoading}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {vocationalLoading ? 'Saving...' : 'Submit Vocational Course Data'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Computer Course Tab */}
            {activeTab === 'computer' && entryGate === 'form' && (
              <div className="space-y-8">
                {computerMessage && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm font-medium ${computerMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                  >
                    {computerMessage.text}
                  </div>
                )}
                <form onSubmit={handleComputerSubmit} className="space-y-8">
                  {/* Photo Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Photo</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Upload Photo
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleComputerPhotoChange}
                          disabled={computerPhotoUploading}
                          className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-100"
                        />
                        <p className="mt-1 text-xs text-slate-500">JPG, PNG or GIF (max. 5MB)</p>
                      </div>
                      {computerPhotoPreview && (
                        <div className="flex flex-col items-center gap-4">
                          <img
                            src={computerPhotoPreview}
                            alt="Preview"
                            className="h-32 w-32 rounded-lg border border-slate-200 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setComputerPhotoFile(null)
                              setComputerPhotoPreview('')
                            }}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Remove Photo
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Batch & Registration Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Batch & Registration</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Batch No"
                        name="batch_no"
                        value={computerData.batch_no}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Batch Timings"
                        name="batch_timings"
                        value={computerData.batch_timings}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Date of Admission"
                        name="date_of_admission"
                        value={computerData.date_of_admission}
                        onChange={handleComputerChange}
                        type="date"
                      />
                      <TextInput
                        label="Registration No"
                        name="reg_no"
                        value={computerData.reg_no}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="EAC Name"
                        name="eac_no"
                        value={computerData.eac_no}
                        onChange={handleComputerChange}
                      />
                    </div>
                  </section>

                  {/* Child Information Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Child Information</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Child Name *"
                        name="child_name"
                        value={computerData.child_name}
                        onChange={handleComputerChange}
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                        <select
                          name="gender"
                          value={computerData.gender}
                          onChange={handleComputerChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <TextInput
                        label="Aadhar No"
                        name="aadhar_no"
                        value={computerData.aadhar_no}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Date of Birth"
                        name="date_of_birth"
                        value={computerData.date_of_birth}
                        onChange={handleComputerChange}
                        type="date"
                      />
                      <TextInput
                        label="Class/Standard"
                        name="class_standard"
                        value={computerData.class_standard}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="School Name"
                        name="school_name"
                        value={computerData.school_name}
                        onChange={handleComputerChange}
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">School Type</label>
                        <select
                          name="school_type"
                          value={computerData.school_type}
                          onChange={handleComputerChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select type</option>
                          <option value="Govt">Govt</option>
                          <option value="Private">Private</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Prior Computer Knowledge</label>
                        <select
                          name="prior_computer_knowledge"
                          value={computerData.prior_computer_knowledge}
                          onChange={handleComputerChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Family Information Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Family Information</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Father Occupation"
                        name="father_occupation"
                        value={computerData.father_occupation}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Father Income"
                        name="father_income"
                        value={computerData.father_income}
                        onChange={handleComputerChange}
                        type="number"
                      />
                      <TextInput
                        label="Father Phone"
                        name="father_phone"
                        value={computerData.father_phone}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Mother Occupation"
                        name="mother_occupation"
                        value={computerData.mother_occupation}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Mother Income"
                        name="mother_income"
                        value={computerData.mother_income}
                        onChange={handleComputerChange}
                        type="number"
                      />
                      <TextInput
                        label="Mother Phone"
                        name="mother_phone"
                        value={computerData.mother_phone}
                        onChange={handleComputerChange}
                      />
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Guardian Address</label>
                        <textarea
                          name="guardian_address"
                          value={computerData.guardian_address}
                          onChange={handleComputerChange}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Consent & Verification Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Consent & Verification</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Consent Details Confirmed</label>
                        <select
                          name="consent_details_confirmed"
                          value={computerData.consent_details_confirmed}
                          onChange={handleComputerChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Consent Course Participation</label>
                        <select
                          name="consent_course_participation"
                          value={computerData.consent_course_participation}
                          onChange={handleComputerChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Consent Pickup/Drop</label>
                        <select
                          name="consent_pickup_drop"
                          value={computerData.consent_pickup_drop}
                          onChange={handleComputerChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                      <TextInput
                        label="Consent Date"
                        name="consent_date"
                        value={computerData.consent_date}
                        onChange={handleComputerChange}
                        type="date"
                      />
                      <TextInput
                        label="Guardian Signature Name"
                        name="guardian_signature_name"
                        value={computerData.guardian_signature_name}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Verified By"
                        name="verified_by"
                        value={computerData.verified_by}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Verified Date"
                        name="verified_date"
                        value={computerData.verified_date}
                        onChange={handleComputerChange}
                        type="date"
                      />
                    </div>
                  </section>

                  {/* Course Details Section */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Course Details</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Course Name"
                        name="course_name"
                        value={computerData.course_name}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Completion Date"
                        name="completion_date"
                        value={computerData.completion_date}
                        onChange={handleComputerChange}
                        type="date"
                      />
                      <TextInput
                        label="Attendance Percentage"
                        name="attendance_percentage"
                        value={computerData.attendance_percentage}
                        onChange={handleComputerChange}
                        type="number"
                        step="0.01"
                      />
                      <TextInput
                        label="Final Assessment Score"
                        name="final_assessment_score"
                        value={computerData.final_assessment_score}
                        onChange={handleComputerChange}
                        type="number"
                        step="0.01"
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Overall Performance</label>
                        <select
                          name="overall_performance"
                          value={computerData.overall_performance}
                          onChange={handleComputerChange}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Select performance</option>
                          <option value="Excellent">Excellent</option>
                          <option value="Good">Good</option>
                          <option value="Satisfactory">Satisfactory</option>
                          <option value="Needs Improvement">Needs Improvement</option>
                        </select>
                      </div>
                      <TextInput
                        label="Instructor Name"
                        name="instructor_name"
                        value={computerData.instructor_name}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="Certificate Issued On"
                        name="certificate_issued_on"
                        value={computerData.certificate_issued_on}
                        onChange={handleComputerChange}
                        type="date"
                      />
                      <TextInput
                        label="Social Worker Signature"
                        name="social_worker_signature"
                        value={computerData.social_worker_signature}
                        onChange={handleComputerChange}
                      />
                      <TextInput
                        label="DFI Staff Signature"
                        name="dfi_staff_signature"
                        value={computerData.dfi_staff_signature}
                        onChange={handleComputerChange}
                      />
                    </div>
                  </section>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={computerLoading}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {computerLoading ? 'Saving...' : 'Submit Computer Course Data'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Rejected Data Tab */}
            {activeTab === 'rejected' && (
              <div className="space-y-8">
                {rejectedMessage && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm font-medium ${rejectedMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                  >
                    {rejectedMessage.text}
                  </div>
                )}

                {/* Rejected Data Subtabs */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Rejected Entries</h2>

                  <div className="mb-6 border-b border-slate-200">
                    <div className="flex flex-wrap gap-2 sm:gap-0">
                      {(['child', 'family', 'sibling', 'uniform', 'leaving', 'vocational', 'computer'] as RejectedSubTabType[]).map((subTab) => (
                        <button
                          key={subTab}
                          onClick={() => setActiveRejectedSubTab(subTab)}
                          className={`px-4 py-3 text-sm font-medium transition capitalize ${activeRejectedSubTab === subTab
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
                            }`}
                        >
                          {subTab === 'child' && 'Child Data'}
                          {subTab === 'family' && 'Child Family'}
                          {subTab === 'sibling' && 'Child Sibling'}
                          {subTab === 'uniform' && 'Child Uniform'}
                          {subTab === 'leaving' && 'Child Leaving'}
                          {subTab === 'vocational' && 'Vocational'}
                          {subTab === 'computer' && 'Computer'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {rejectedLoading ? (
                    <div className="flex justify-center py-8">
                      <p className="text-slate-500">Loading...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-2 text-left font-medium text-slate-700">Registration No</th>
                            {activeRejectedSubTab === 'child' && (
                              <>
                                <th className="px-4 py-2 text-left font-medium text-slate-700">Name</th>
                                <th className="px-4 py-2 text-left font-medium text-slate-700">School</th>
                              </>
                            )}
                            {activeRejectedSubTab === 'family' && (
                              <>
                                <th className="px-4 py-2 text-left font-medium text-slate-700">Father Name</th>
                                <th className="px-4 py-2 text-left font-medium text-slate-700">Mother Name</th>
                              </>
                            )}
                            {activeRejectedSubTab === 'sibling' && (
                              <th className="px-4 py-2 text-left font-medium text-slate-700">EAC No</th>
                            )}
                            {activeRejectedSubTab === 'uniform' && (
                              <th className="px-4 py-2 text-left font-medium text-slate-700">EAC No</th>
                            )}
                            {activeRejectedSubTab === 'leaving' && (
                              <th className="px-4 py-2 text-left font-medium text-slate-700">Reason</th>
                            )}
                            {activeRejectedSubTab === 'vocational' && (
                              <>
                                <th className="px-4 py-2 text-left font-medium text-slate-700">Name</th>
                                <th className="px-4 py-2 text-left font-medium text-slate-700">Reason</th>
                              </>
                            )}
                            {activeRejectedSubTab === 'computer' && (
                              <>
                                <th className="px-4 py-2 text-left font-medium text-slate-700">Child Name</th>
                              </>
                            )}
                            <th className="px-4 py-2 text-left font-medium text-slate-700">Rejection Reason</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeRejectedSubTab === 'child' && rejectedChildData.length === 0 && (
                            <tr className="border-b border-slate-200">
                              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                No rejected child data found.
                              </td>
                            </tr>
                          )}
                          {activeRejectedSubTab === 'child' && rejectedChildData.map((record) => (
                            <tr key={record.record_id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-700">{record.reg_no}</td>
                              <td className="px-4 py-2 text-slate-700">{record.first_name} {record.last_name}</td>
                              <td className="px-4 py-2 text-slate-700">{record.school_name}</td>
                              <td className="px-4 py-2 text-slate-700 text-xs">{record.rejection_reason}</td>
                              <td className="px-4 py-2 text-slate-700">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(record, 'child')}
                                    className="inline-flex items-center justify-center rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResubmit(record, 'child')}
                                    disabled={rejectedLoading}
                                    className="inline-flex items-center justify-center rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-500"
                                  >
                                    Resubmit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {activeRejectedSubTab === 'family' && rejectedFamilyData.length === 0 && (
                            <tr className="border-b border-slate-200">
                              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                No rejected family data found.
                              </td>
                            </tr>
                          )}
                          {activeRejectedSubTab === 'family' && rejectedFamilyData.map((record) => (
                            <tr key={record.record_id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-700">{record.reg_no}</td>
                              <td className="px-4 py-2 text-slate-700">{record.f_name}</td>
                              <td className="px-4 py-2 text-slate-700">{record.m_name}</td>
                              <td className="px-4 py-2 text-slate-700 text-xs">{record.rejection_reason}</td>
                              <td className="px-4 py-2 text-slate-700">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(record, 'family')}
                                    className="inline-flex items-center justify-center rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResubmit(record, 'family')}
                                    disabled={rejectedLoading}
                                    className="inline-flex items-center justify-center rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-500"
                                  >
                                    Resubmit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {activeRejectedSubTab === 'sibling' && rejectedSiblingData.length === 0 && (
                            <tr className="border-b border-slate-200">
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                No rejected sibling data found.
                              </td>
                            </tr>
                          )}
                          {activeRejectedSubTab === 'sibling' && rejectedSiblingData.map((record) => (
                            <tr key={record.record_id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-700">{record.reg_no}</td>
                              <td className="px-4 py-2 text-slate-700">{record.eac_no}</td>
                              <td className="px-4 py-2 text-slate-700 text-xs">{record.rejection_reason}</td>
                              <td className="px-4 py-2 text-slate-700">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(record, 'sibling')}
                                    className="inline-flex items-center justify-center rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResubmit(record, 'sibling')}
                                    disabled={rejectedLoading}
                                    className="inline-flex items-center justify-center rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-500"
                                  >
                                    Resubmit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {activeRejectedSubTab === 'uniform' && rejectedUniformData.length === 0 && (
                            <tr className="border-b border-slate-200">
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                No rejected uniform data found.
                              </td>
                            </tr>
                          )}
                          {activeRejectedSubTab === 'uniform' && rejectedUniformData.map((record) => (
                            <tr key={record.record_id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-700">{record.reg_no}</td>
                              <td className="px-4 py-2 text-slate-700">{record.eac_no}</td>
                              <td className="px-4 py-2 text-slate-700 text-xs">{record.rejection_reason}</td>
                              <td className="px-4 py-2 text-slate-700">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(record, 'uniform')}
                                    className="inline-flex items-center justify-center rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResubmit(record, 'uniform')}
                                    disabled={rejectedLoading}
                                    className="inline-flex items-center justify-center rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-500"
                                  >
                                    Resubmit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {activeRejectedSubTab === 'leaving' && rejectedLeavingData.length === 0 && (
                            <tr className="border-b border-slate-200">
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                No rejected leaving data found.
                              </td>
                            </tr>
                          )}
                          {activeRejectedSubTab === 'leaving' && rejectedLeavingData.map((record) => (
                            <tr key={record.record_id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-700">{record.reg_no}</td>
                              <td className="px-4 py-2 text-slate-700">{record.reason}</td>
                              <td className="px-4 py-2 text-slate-700 text-xs">{record.rejection_reason}</td>
                              <td className="px-4 py-2 text-slate-700">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(record, 'leaving')}
                                    className="inline-flex items-center justify-center rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResubmit(record, 'leaving')}
                                    disabled={rejectedLoading}
                                    className="inline-flex items-center justify-center rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-500"
                                  >
                                    Resubmit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* vocational rejected rows */}
                          {activeRejectedSubTab === 'vocational' && rejectedVocationalData.length === 0 && (
                            <tr className="border-b border-slate-200">
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                No rejected vocational data found.
                              </td>
                            </tr>
                          )}
                          {activeRejectedSubTab === 'vocational' && rejectedVocationalData.map((record) => (
                            <tr key={record.record_id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-700">{record.reg_no}</td>
                              <td className="px-4 py-2 text-slate-700">{record.trainee_name}</td>
                              <td className="px-4 py-2 text-slate-700">{record.reason}</td>
                              <td className="px-4 py-2 text-slate-700 text-xs">{record.rejection_reason}</td>
                              <td className="px-4 py-2 text-slate-700">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(record, 'vocational')}
                                    className="inline-flex items-center justify-center rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResubmit(record, 'vocational')}
                                    disabled={rejectedLoading}
                                    className="inline-flex items-center justify-center rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-500"
                                  >
                                    Resubmit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* computer rejected rows */}
                          {activeRejectedSubTab === 'computer' && rejectedComputerData.length === 0 && (
                            <tr className="border-b border-slate-200">
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                No rejected computer data found.
                              </td>
                            </tr>
                          )}
                          {activeRejectedSubTab === 'computer' && rejectedComputerData.map((record) => (
                            <tr key={record.record_id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-700">{record.reg_no}</td>
                              <td className="px-4 py-2 text-slate-700">{record.child_name}</td>
                              <td className="px-4 py-2 text-slate-700 text-xs">{record.rejection_reason}</td>
                              <td className="px-4 py-2 text-slate-700">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openEditModal(record, 'computer')}
                                    className="inline-flex items-center justify-center rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResubmit(record, 'computer')}
                                    disabled={rejectedLoading}
                                    className="inline-flex items-center justify-center rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-500"
                                  >
                                    Resubmit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Edit Modal */}
                {editModalOpen && editingRecord && editFormData && (
                  <EditModal
                    isOpen={editModalOpen}
                    onClose={closeEditModal}
                    record={editingRecord}
                    formData={editFormData}
                    modalType={editModalType}
                    loading={editLoading}
                    onFormChange={handleEditFormChange}
                    onSubmit={handleEditSubmit}
                    onPhotoChange={handleEditPhotoChange}
                    photoPreview={editPhotoPreview}
                    photoInputKey={editPhotoInputKey}
                    setPhotoInputKey={setEditPhotoInputKey}
                    mediumOfStudyOptions={mediumOfStudyOptions}
                    lifeAmbitionOptions={lifeAmbitionOptions}
                    favSubjectOptions={favSubjectOptions}
                    fatherOccupationOptions={fatherOccupationOptions}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </main>
  )
}

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  record: any
  formData: any
  modalType: RejectedSubTabType
  loading: boolean
  onFormChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onSubmit: () => void
  onPhotoChange: (e: ChangeEvent<HTMLInputElement>) => void
  photoPreview: string
  photoInputKey: number
  setPhotoInputKey: (key: number) => void
  mediumOfStudyOptions: string[]
  lifeAmbitionOptions: string[]
  favSubjectOptions: string[]
  fatherOccupationOptions: string[]
}

function EditModal({
  isOpen,
  onClose,
  record,
  formData,
  modalType,
  loading,
  onFormChange,
  onSubmit,
  onPhotoChange,
  photoPreview,
  photoInputKey,
  setPhotoInputKey,
  mediumOfStudyOptions,
  lifeAmbitionOptions,
  favSubjectOptions,
  fatherOccupationOptions,
}: EditModalProps) {
  if (!isOpen) return null

  const modalGenderNormalized = String(formData?.gender ?? '').trim().toUpperCase()
  const modalIsMale = modalGenderNormalized === 'MALE'
  const modalIsFemale = modalGenderNormalized === 'FEMALE'
  const showModalPantSkirtSize = !modalIsMale
  const showModalChudidharSize = !modalIsMale
  const showModalTopPantSize = !modalIsFemale

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            Edit {modalType === 'child' && 'Child Data'}
            {modalType === 'family' && 'Family Data'}
            {modalType === 'sibling' && 'Sibling Data'}
            {modalType === 'uniform' && 'Uniform Data'}
            {modalType === 'leaving' && 'Leaving Data'}
            {modalType === 'vocational' && 'Vocational Data'}
            {modalType === 'computer' && 'Computer Data'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {modalType === 'child' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Registration Number"
                  name="reg_no"
                  value={formData.reg_no}
                  onChange={onFormChange}
                />
                <TextInput
                  label="Admission Date"
                  name="adm_date"
                  value={formData.adm_date}
                  onChange={onFormChange}
                  type="date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Date of Birth"
                  name="dateofbirth"
                  value={formData.dateofbirth}
                  onChange={onFormChange}
                  type="date"
                  max={todayIsoDate}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Religion</label>
                  <select
                    name="religion"
                    value={formData.religion || ''}
                    onChange={onFormChange}
                    className={baseInputClass}
                  >
                    <option value="">Select Religion</option>
                    {religionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={onFormChange}
                />
                <TextInput
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={onFormChange}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender || ''}
                    onChange={onFormChange}
                    required
                    className={baseInputClass}
                  >
                    <option value="">Select Gender</option>
                    {genderOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <NumberInput
                  label="Aadhar No"
                  name="aadhar_no"
                  value={formData.aadhar_no}
                  onChange={onFormChange}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Birth Place"
                  name="birth_place"
                  value={formData.birth_place}
                  onChange={onFormChange}
                  required
                />
                <NumberInput
                  label="Height (cm)"
                  name="height"
                  value={formData.height}
                  onChange={onFormChange}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Weight (kg)"
                  name="weight"
                  value={formData.weight}
                  onChange={onFormChange}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Blood Group</label>
                  <select
                    name="blood_group"
                    value={formData.blood_group || ''}
                    onChange={onFormChange}
                    required
                    className={baseInputClass}
                  >
                    <option value="">Select Blood Group</option>
                    {bloodGroupOptions.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Health Status"
                  name="health"
                  value={formData.health}
                  onChange={onFormChange}
                  required
                />
                <TextInput
                  label="Caste"
                  name="caste"
                  value={formData.caste}
                  onChange={onFormChange}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Mother Tongue"
                  name="mother_tongue"
                  value={formData.mother_tongue}
                  onChange={onFormChange}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Class/Standard</label>
                  <select
                    name="class_std_text"
                    value={formData.class_std_text || ''}
                    onChange={onFormChange}
                    className={baseInputClass}
                  >
                    <option value="">Select Class/Standard</option>
                    {classStandardOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="School Name"
                  name="school_name"
                  value={formData.school_name}
                  onChange={onFormChange}
                  required
                />
                <TextInput
                  label="School Category"
                  name="school_category"
                  value={formData.school_category}
                  onChange={onFormChange}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="SATS No"
                  name="sats_no"
                  value={formData.sats_no}
                  onChange={onFormChange}
                />
                <NumberInput
                  label="PEN No"
                  name="pen_no"
                  value={formData.pen_no}
                  onChange={onFormChange}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Medium of Study</label>
                  <select
                    name="medium_of_study"
                    value={formData.medium_of_study || ''}
                    onChange={onFormChange}
                    className={baseInputClass}
                  >
                    <option value="">Select Medium of Study</option>
                    {mediumOfStudyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Life Ambition</label>
                  <select
                    name="life_ambition"
                    value={formData.life_ambition || ''}
                    onChange={onFormChange}
                    className={baseInputClass}
                  >
                    <option value="">Select Life Ambition</option>
                    {lifeAmbitionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Favourite Subject</label>
                  <select
                    name="fav_subject"
                    value={formData.fav_subject || ''}
                    onChange={onFormChange}
                    className={baseInputClass}
                  >
                    <option value="">Select Favourite Subject</option>
                    {favSubjectOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Other Information</label>
                <textarea
                  name="child_other_info"
                  value={formData.child_other_info}
                  onChange={onFormChange}
                  rows={2}
                  className={baseInputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Photo Upload</label>
                <input
                  key={photoInputKey}
                  type="file"
                  accept="image/*"
                  onChange={onPhotoChange}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {formData.photo_link && (
                  <p className="mt-2 text-sm text-slate-600">Current: {formData.photo_link}</p>
                )}
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Selected child preview"
                    className="mt-3 h-28 w-28 rounded-lg border border-slate-200 object-cover"
                  />
                )}
              </div>
            </>
          )}

          {modalType === 'family' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Father's Name"
                  name="f_name"
                  value={formData.f_name}
                  onChange={onFormChange}
                />
                <TextInput
                  label="Father's Occupation"
                  name="f_occup"
                  value={formData.f_occup}
                  onChange={onFormChange}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Mother's Name"
                  name="m_name"
                  value={formData.m_name}
                  onChange={onFormChange}
                />
                <TextInput
                  label="Mother's Occupation"
                  name="m_occup"
                  value={formData.m_occup}
                  onChange={onFormChange}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 1</label>
                <textarea
                  name="fmly_addr1"
                  value={formData.fmly_addr1}
                  onChange={onFormChange}
                  rows={2}
                  className={baseInputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
                <textarea
                  name="fmly_remarks"
                  value={formData.fmly_remarks}
                  onChange={onFormChange}
                  rows={2}
                  className={baseInputClass}
                />
              </div>
            </>
          )}

          {modalType === 'sibling' && (
            <>
              {[1, 2, 3, 4, 5].map((num) => (
                <div key={num} className="border-t pt-4">
                  <h3 className="mb-3 font-semibold text-slate-900">Sibling {num}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <TextInput
                      label={`Sibling ${num} Name`}
                      name={`names_${num}`}
                      value={formData[`names_${num}`]}
                      onChange={onFormChange}
                    />
                    <NumberInput
                      label="Age"
                      name={`ages_${num}`}
                      value={formData[`ages_${num}`]}
                      onChange={onFormChange}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t pt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
                <textarea
                  name="sibling_remarks"
                  value={formData.sibling_remarks}
                  onChange={onFormChange}
                  rows={2}
                  className={baseInputClass}
                />
              </div>
            </>
          )}

          {modalType === 'uniform' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Shirt Size"
                  name="shirtsize"
                  value={formData.shirtsize}
                  onChange={onFormChange}
                />
                <TextInput
                  label="Knicker Size"
                  name="knickersize"
                  value={formData.knickersize}
                  onChange={onFormChange}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Pant/Skirt Size"
                  name="pant_skirtsize"
                  value={formData.pant_skirtsize}
                  onChange={onFormChange}
                />
                <TextInput
                  label="Footwear Size"
                  name="footwearsize"
                  value={formData.footwearsize}
                  onChange={onFormChange}
                />
              </div>
              <TextInput
                label="Uniform Updated Date"
                name="uniform_updated"
                value={formData.uniform_updated}
                onChange={onFormChange}
                type="date"
              />
            </>
          )}

          {modalType === 'leaving' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Reason for Leaving"
                  name="reason"
                  value={formData.reason}
                  onChange={onFormChange}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Pass Status</label>
                  <select
                    name="pass_status"
                    value={formData.pass_status || ''}
                    onChange={onFormChange}
                    className={baseInputClass}
                  >
                    <option value="">Select Pass Status</option>
                    {passStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="Leaving Class"
                  name="leav_class"
                  value={formData.leav_class}
                  onChange={onFormChange}
                />
              </div>
              <TextInput
                label="Leaving Date"
                name="leav_date"
                value={formData.leav_date}
                onChange={onFormChange}
                type="date"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 1</label>
                <textarea
                  name="leav_addr1"
                  value={formData.leav_addr1}
                  onChange={onFormChange}
                  rows={2}
                  className={baseInputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
                <textarea
                  name="leav_remarks"
                  value={formData.leav_remarks}
                  onChange={onFormChange}
                  rows={2}
                  className={baseInputClass}
                />
              </div>
            </>
          )}

          {modalType === 'vocational' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="EAC No"
                  name="eac_no"
                  value={formData.eac_no}
                  onChange={onFormChange}
                />
                <TextInput
                  label="Registration No"
                  name="reg_no"
                  value={formData.reg_no}
                  onChange={onFormChange}
                />
              </div>
              <TextInput
                label="Trainee Name"
                name="trainee_name"
                value={formData.trainee_name}
                onChange={onFormChange}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={onFormChange}
                  rows={2}
                  className={baseInputClass}
                />
              </div>
            </>
          )}

          {modalType === 'computer' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="EAC No"
                  name="eac_no"
                  value={formData.eac_no}
                  onChange={onFormChange}
                />
                <TextInput
                  label="Registration No"
                  name="reg_no"
                  value={formData.reg_no}
                  onChange={onFormChange}
                />
              </div>
              <TextInput
                label="Child Name"
                name="child_name"
                value={formData.child_name}
                onChange={onFormChange}
              />
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? 'Saving...' : 'Save & Resubmit'}
          </button>
        </div>
      </div>
    </div>
  )
}

type InputProps = {
  label: string
  name: string
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
  type?: HTMLInputTypeAttribute
  step?: string
  required?: boolean
  max?: string
}

const baseInputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

function TextInput({ label, name, value, onChange, type = 'text', step, required = false, max }: InputProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        step={step}
        required={required}
        max={max}
        className={baseInputClass}
      />
    </div>
  )
}

function NumberInput(props: InputProps) {
  return <TextInput {...props} type="number" />
}

function ReadOnlyInput({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type="text"
        value={value}
        readOnly
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
      />
    </div>
  )
}