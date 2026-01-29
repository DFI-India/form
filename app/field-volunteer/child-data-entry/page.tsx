'use client'

import {
  useState,
  useEffect,
  type ChangeEvent,
  type ChangeEventHandler,
  type HTMLInputTypeAttribute,
} from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../../lib/supabase'

type TabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving' | 'rejected' | 'history'
type RejectedSubTabType = 'child' | 'family' | 'sibling' | 'uniform' | 'leaving'

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
  class_std: number
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
  rejection_reason?: string
  rejected_at?: string
}

type RejectedSiblingRecord = {
  record_id: number
  approval_id: string
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
  uniform_updated: string
  rejection_reason?: string
  rejected_at?: string
}

type RejectedLeavingRecord = {
  record_id: number
  approval_id: string
  eac_no: string
  reg_no: string
  reason: string
  leav_class: string
  leav_date: string
  leav_addr1: string
  leav_addr2: string
  leav_addr3: string
  leav_pincode: string
  leav_remarks: string
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
  reg_no: string
  first_name: string
  last_name: string
  gender: string
  aadhar_no: string
  birth_place: string
  height: string
  weight: string
  blood_group: string
  health: string
  caste: string
  mother_tongue: string
  class_std: string
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
  leav_class: string
  leav_date: string
  leav_addr1: string
  leav_addr2: string
  leav_addr3: string
  leav_pincode: string
  leav_remarks: string
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
  reg_no: '',
  first_name: '',
  last_name: '',
  gender: '',
  aadhar_no: '',
  birth_place: '',
  height: '',
  weight: '',
  blood_group: '',
  health: '',
  caste: '',
  mother_tongue: '',
  class_std: '',
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
  leav_class: '',
  leav_date: '',
  leav_addr1: '',
  leav_addr2: '',
  leav_addr3: '',
  leav_pincode: '',
  leav_remarks: ''
})

const genderOptions = ['Male', 'Female', 'Other']
const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function ChildForm() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('child')
  const [eacOptions, setEacOptions] = useState<CentreOption[]>([])

  // Child form state
  const [formData, setFormData] = useState<FormState>(() => createEmptyForm())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
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

  // Rejected data state
  const [activeRejectedSubTab, setActiveRejectedSubTab] = useState<RejectedSubTabType>('child')
  const [rejectedChildData, setRejectedChildData] = useState<RejectedChildRecord[]>([])
  const [rejectedFamilyData, setRejectedFamilyData] = useState<RejectedFamilyRecord[]>([])
  const [rejectedSiblingData, setRejectedSiblingData] = useState<RejectedSiblingRecord[]>([])
  const [rejectedUniformData, setRejectedUniformData] = useState<RejectedUniformRecord[]>([])
  const [rejectedLeavingData, setRejectedLeavingData] = useState<RejectedLeavingRecord[]>([])
  const [rejectedLoading, setRejectedLoading] = useState(false)
  const [rejectedMessage, setRejectedMessage] = useState<MessageState>(null)

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editModalType, setEditModalType] = useState<RejectedSubTabType>('child')
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [editFormData, setEditFormData] = useState<any>(null)
  const [editLoading, setEditLoading] = useState(false)

  // Personal history state
  const [historyData, setHistoryData] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyMessage, setHistoryMessage] = useState<MessageState>(null)

  const [checkedAuth, setCheckedAuth] = useState(false)
  const [authorized, setAuthorized] = useState(false)

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

  const fetchRejectedData = async (subTabType: RejectedSubTabType) => {
    setRejectedLoading(true)
    setRejectedMessage(null)

    try {
      let viewName = ''
      let setter: any = null

      switch (subTabType) {
        case 'child':
          viewName = 'childdata_rejected_for_volunteer'
          setter = setRejectedChildData
          break
        case 'family':
          viewName = 'childfmly_rejected_for_volunteer'
          setter = setRejectedFamilyData
          break
        case 'sibling':
          viewName = 'childsibling_rejected_for_volunteer'
          setter = setRejectedSiblingData
          break
        case 'uniform':
          viewName = 'childuniform_rejected_for_volunteer'
          setter = setRejectedUniformData
          break
        case 'leaving':
          viewName = 'childleaving_rejected_for_volunteer'
          setter = setRejectedLeavingData
          break
      }

      const { data, error } = await supabase
        .from(viewName)
        .select('*')

      if (error) throw error
      setter((data ?? []) as any[])
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

  useEffect(() => {
    if (activeTab === 'history' && authorized) {
      fetchPersonalHistory()
    }
  }, [activeTab, authorized])

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
      centre_id: eacData.centre_id ?? '',
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

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (file && file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be 5MB or smaller.' })
      event.target.value = ''
      setPhotoFile(null)
      setFormData((prev) => ({ ...prev, photo_link: '' }))
      setPhotoInputKey(Date.now())
      return
    }

    setPhotoFile(file)
    setFormData((prev) => ({ ...prev, photo_link: file ? file.name : '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      let photoUrl: string | null = formData.photo_link ? formData.photo_link : null
      const registrationNumber = formData.reg_no.trim()

      if (photoFile) {
        if (registrationNumber === '') {
          throw new Error('Registration number is required to upload a photo.')
        }

        const extension = (photoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const sanitizedIdentifier = registrationNumber.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()
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
      }

      const toNullableString = (value: string) => (value.trim() === '' ? null : value)
      const toNullableNumber = (value: string) => {
        if (value.trim() === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }

      const payload = {
        eac_no: eacNumber,
        village_name: toNullableString(formData.village_name),
        centre_id: toNullableString(formData.centre_id),
        district: toNullableString(formData.district),
        taluk: toNullableString(formData.taluk),
        panchayat: toNullableString(formData.panchayat),
        village: toNullableString(formData.village),
        adm_date: toNullableString(formData.adm_date),
        reg_no: toNullableNumber(formData.reg_no),
        first_name: toNullableString(formData.first_name),
        last_name: toNullableString(formData.last_name),
        gender: toNullableString(formData.gender),
        aadhar_no: toNullableNumber(formData.aadhar_no),
        birth_place: toNullableString(formData.birth_place),
        height: toNullableNumber(formData.height),
        weight: toNullableNumber(formData.weight),
        blood_group: toNullableString(formData.blood_group),
        health: toNullableString(formData.health),
        caste: toNullableString(formData.caste),
        mother_tongue: toNullableString(formData.mother_tongue),
        class_std: toNullableNumber(formData.class_std),
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
      setPhotoInputKey(Date.now())
    } catch (error: unknown) {
      const fallback = error instanceof Error ? error.message : 'Unexpected error occurred.'
      setMessage({ type: 'error', text: `Unable to save the form: ${fallback}` })
    } finally {
      setLoading(false)
    }
  }

  const handleFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFamilyLoading(true)
    setFamilyMessage(null)

    try {
      if (!familyData.reg_no) {
        throw new Error('Registration number is required.')
      }

      const { data, error } = await supabase
        .from('childfmly')
        .insert([familyData])
        .select()
        .single()

      if (error) throw error

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
    }
  }

  const handleSiblingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSiblingLoading(true)
    setSiblingMessage(null)

    try {
      if (!siblingData.reg_no) {
        throw new Error('Registration number is required.')
      }

      const { data, error } = await supabase
        .from('childsibling')
        .insert([siblingData])
        .select()
        .single()

      if (error) throw error

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
    }
  }

  const handleUniformSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUniformLoading(true)
    setUniformMessage(null)

    try {
      if (!uniformData.reg_no) {
        throw new Error('Registration number is required.')
      }

      const { data, error } = await supabase
        .from('childuniform')
        .insert([uniformData])
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
    }
  }

  const handleLeavingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLeavingLoading(true)
    setLeavingMessage(null)

    try {
      if (!leavingData.reg_no) {
        throw new Error('Registration number is required.')
      }

      const { data, error } = await supabase
        .from('childleaving')
        .insert([leavingData])
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
    }
  }

  const openEditModal = (record: any, type: RejectedSubTabType) => {
    setEditingRecord(record)
    setEditModalType(type)
    setEditFormData({ ...record })
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingRecord(null)
    setEditFormData(null)
  }

  const handleEditFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setEditFormData((prev: any) => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleEditSubmit = async () => {
    setEditLoading(true)
    setRejectedMessage(null)

    try {
      if (!editingRecord || !editFormData) {
        throw new Error('No record to edit.')
      }

      let tableName = ''
      const { record_id, approval_id } = editingRecord

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
      }

      // Remove record_id and approval_id from update payload
      const updatePayload = { ...editFormData }
      delete updatePayload.record_id
      delete updatePayload.approval_id
      delete updatePayload.rejection_reason
      delete updatePayload.rejected_at

      // Update base table
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq('record_id', record_id)

      if (updateError) throw updateError

      // Reset approval status to Pending
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      console.log('Current user ID for approval update:', userId)

      const { error: approvalError } = await supabase
        .from('child_approvals')
        .update({
          status: 'Pending',
          rejection_reason: null,
          decided_by: null,
          decided_at: null,
          resubmitted_at: new Date().toISOString(),
        })
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
      }

      // Reset approval status to Pending without updating data
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      console.log('Current user ID for resubmit:', userId)

      const { error: approvalError } = await supabase
        .from('child_approvals')
        .update({
          status: 'Pending',
          rejection_reason: null,
          decided_by: null,
          decided_at: null,
          resubmitted_at: new Date().toISOString(),
        })
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

  if (!checkedAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Checking access…</p>
      </main>
    )
  }

  if (!authorized) {
    return null
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/sign-in')
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'child', label: 'Child Data' },
    { id: 'family', label: 'Child Family' },
    { id: 'sibling', label: 'Child Sibling' },
    { id: 'uniform', label: 'Child Uniform' },
    { id: 'leaving', label: 'Child Leaving' },
    { id: 'rejected', label: 'Rejected Data' },
    { id: 'history', label: 'Personal History' },
  ]

  return (
    <main className="flex-1">
      <header className="mb-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-start sm:text-left">
            <Image
              src="/DFI.png"
              alt="Debora Foundation India logo"
              width={180}
              height={60}
              priority
              className="h-auto w-40 sm:w-44"
            />
            <span className="text-xl font-semibold text-slate-900">Debora Foundation India</span>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
          >
            Sign out
          </button>
        </div>

        <p className="text-sm font-semibold tracking-wide text-blue-600">Data Entry</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Child Management System</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Manage all child-related information in one place: basic data, family details, siblings, uniforms, and leaving records.
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-slate-200">
        <div className="flex flex-wrap gap-2 sm:gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition ${activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* Child Data Tab */}
        {activeTab === 'child' && (
          <div className="space-y-8">
            {message && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm font-medium ${message.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
                  }`}
              >
                {message.text}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-8">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Centre Information</h2>
                    <p className="mt-1 text-sm text-slate-500">Select the EAC to auto-fill the location details.</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Step 1
                  </span>
                </div>

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

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Admission Date</label>
                    <input
                      type="date"
                      name="adm_date"
                      value={formData.adm_date}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <ReadOnlyInput label="Village Name" value={formData.village_name} />
                  <ReadOnlyInput label="Centre ID" value={formData.centre_id} />
                  <ReadOnlyInput label="District" value={formData.district} />
                  <ReadOnlyInput label="Taluk" value={formData.taluk} />
                  <ReadOnlyInput label="Panchayat" value={formData.panchayat} />
                  <ReadOnlyInput label="Village" value={formData.village} />

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Registration No</label>
                    <input
                      type="number"
                      name="reg_no"
                      value={formData.reg_no}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Child Profile</h2>
                    <p className="mt-1 text-sm text-slate-500">Capture core identity information for the child.</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Step 2
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} />
                  <TextInput label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} />

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select Gender</option>
                      {genderOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <NumberInput label="Aadhar No" name="aadhar_no" value={formData.aadhar_no} onChange={handleChange} />
                  <TextInput label="Birth Place" name="birth_place" value={formData.birth_place} onChange={handleChange} />
                  <NumberInput label="Height (cm)" name="height" value={formData.height} onChange={handleChange} />
                  <NumberInput label="Weight (kg)" name="weight" value={formData.weight} onChange={handleChange} />

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Blood Group</label>
                    <select
                      name="blood_group"
                      value={formData.blood_group}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select Blood Group</option>
                      {bloodGroupOptions.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </div>

                  <TextInput label="Health Status" name="health" value={formData.health} onChange={handleChange} />
                  <TextInput label="Caste" name="caste" value={formData.caste} onChange={handleChange} />
                  <TextInput label="Mother Tongue" name="mother_tongue" value={formData.mother_tongue} onChange={handleChange} />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Academic Details</h2>
                    <p className="mt-1 text-sm text-slate-500">Schooling, identification numbers, and learning context.</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Step 3
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <NumberInput label="Class/Standard" name="class_std" value={formData.class_std} onChange={handleChange} />
                  <TextInput label="School Name" name="school_name" value={formData.school_name} onChange={handleChange} />
                  <TextInput label="School Category" name="school_category" value={formData.school_category} onChange={handleChange} />
                  <NumberInput label="SATS No" name="sats_no" value={formData.sats_no} onChange={handleChange} />
                  <NumberInput label="PEN No" name="pen_no" value={formData.pen_no} onChange={handleChange} />
                  <TextInput label="Medium of Study" name="medium_of_study" value={formData.medium_of_study} onChange={handleChange} />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Aspirations & Extras</h2>
                    <p className="mt-1 text-sm text-slate-500">Capture interests, ambitions, and supporting details.</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Step 4
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput label="Life Ambition" name="life_ambition" value={formData.life_ambition} onChange={handleChange} />
                  <TextInput label="Favorite Subject" name="fav_subject" value={formData.fav_subject} onChange={handleChange} />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="photoUpload">
                      Child Photo
                    </label>
                    <input
                      key={photoInputKey}
                      id="photoUpload"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-md file:border-none file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-xs text-slate-500">Use your camera or upload an existing image (max 5MB).</p>
                    {photoFile && (
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        Selected: {photoFile.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Other Information</label>
                  <textarea
                    name="child_other_info"
                    value={formData.child_other_info}
                    onChange={handleChange}
                    rows={4}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </section>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {loading ? 'Saving...' : 'Save Child Data'}
                </button>
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
                  <TextInput
                    label="Registration No *"
                    name="reg_no"
                    value={familyData.reg_no}
                    onChange={(e) => setFamilyData({ ...familyData, reg_no: e.target.value })}
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
                  <TextInput
                    label="Registration No *"
                    name="reg_no"
                    value={siblingData.reg_no}
                    onChange={(e) => setSiblingData({ ...siblingData, reg_no: e.target.value })}
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
                  <TextInput
                    label="Registration No *"
                    name="reg_no"
                    value={uniformData.reg_no}
                    onChange={(e) => setUniformData({ ...uniformData, reg_no: e.target.value })}
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
        {activeTab === 'leaving' && (
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
                  {(['child', 'family', 'sibling', 'uniform', 'leaving'] as RejectedSubTabType[]).map((subTab) => (
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
                    </button>
                  ))}
                </div>
              </div>

              {rejectedLoading ? (
                <div className="flex justify-center py-8">
                  <p className="text-slate-500">Loading...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
              />
            )}
          </div>
        )}

        {/* Personal History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-8">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Personal History</h2>
              <p className="text-sm text-slate-600 mb-4">Track all updates and changes to child records.</p>
              <div className="max-h-[60vh] overflow-auto rounded border border-slate-100 bg-white">
                {historyLoading ? (
                  <div className="p-4 text-sm text-slate-600">Loading history…</div>
                ) : historyMessage ? (
                  <div className={`p-4 text-sm font-medium ${historyMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                    {historyMessage.text}
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="p-4 text-sm text-slate-600">No history found.</div>
                ) : (
                  <div className="min-w-full">
                    <table className="min-w-[900px] w-full table-auto">
                      <thead>
                        <tr className="bg-slate-50 text-left text-sm text-slate-700">
                          <th className="px-4 py-3">Record</th>
                          <th className="px-4 py-3">Adm Date</th>
                          <th className="px-4 py-3">EAC No</th>
                          <th className="px-4 py-3">Reg No</th>
                          <th className="px-4 py-3">First Name</th>
                          <th className="px-4 py-3">Last Name</th>
                          <th className="px-4 py-3">Gender</th>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3">School</th>
                          <th className="px-4 py-3">Photo</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm text-slate-700">
                        {historyData.map((row) => (
                          <tr key={(row.record_id ?? '') + '-' + (row.reg_no ?? '')} className="border-t">
                            <td className="px-4 py-3">{row.record_id}</td>
                            <td className="px-4 py-3">{row.adm_date ?? ''}</td>
                            <td className="px-4 py-3">{row.eac_no}</td>
                            <td className="px-4 py-3">{row.reg_no}</td>
                            <td className="px-4 py-3">{row.first_name}</td>
                            <td className="px-4 py-3">{row.last_name}</td>
                            <td className="px-4 py-3">{row.gender}</td>
                            <td className="px-4 py-3">{row.class_std}</td>
                            <td className="px-4 py-3">{row.school_name}</td>
                            <td className="px-4 py-3">
                              {row.photo_link ? (
                                <a href={row.photo_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main >
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
}: EditModalProps) {
  if (!isOpen) return null

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
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {modalType === 'child' && (
            <>
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
                  label="School Name"
                  name="school_name"
                  value={formData.school_name}
                  onChange={onFormChange}
                />
                <NumberInput
                  label="Class/Standard"
                  name="class_std"
                  value={formData.class_std}
                  onChange={onFormChange}
                />
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
}

const baseInputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

function TextInput({ label, name, value, onChange, type = 'text' }: InputProps) {
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