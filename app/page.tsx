'use client'

import {
  useState,
  useEffect,
  type ChangeEvent,
  type ChangeEventHandler,
  type HTMLInputTypeAttribute,
} from 'react'
import Image from 'next/image'
import { supabase } from '../lib/supabase'

type CentreOption = {
  eac_no: string | number
  village_name?: string | null
  centre_id?: string | null
  district?: string | null
  taluk?: string | null
  panchayat?: string | null
  village?: string | null
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

const genderOptions = ['Male', 'Female', 'Other']
const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function ChildForm() {
  const [eacOptions, setEacOptions] = useState<CentreOption[]>([])
  const [formData, setFormData] = useState<FormState>(() => createEmptyForm())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoInputKey, setPhotoInputKey] = useState(() => Date.now())

  useEffect(() => {
    fetchEacData()
  }, [])

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

      if (photoFile) {
        const extension = photoFile.name.split('.').pop() ?? 'jpg'
        const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)
        const folder = (formData.reg_no || formData.eac_no || 'uploads').replace(/\s+/g, '-').toLowerCase()
        const filePath = `${folder}/${uniqueId}.${extension}`

        const { error: uploadError } = await supabase.storage.from('bucket').upload(filePath, photoFile, {
          cacheControl: '3600',
          upsert: false,
        })

        if (uploadError) {
          throw uploadError
        }

        const { data: publicData } = supabase.storage.from('bucket').getPublicUrl(filePath)
        photoUrl = publicData.publicUrl
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

    const { error } = await supabase.from('Child_Data').insert([payload])

    if (error) throw error

    setMessage({ type: 'success', text: 'Child data saved successfully.' })
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

  return (
    <main className="flex-1">
      <header className="mb-8">
        <div className="mb-6 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-start sm:text-left">
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

        <p className="text-sm font-semibold tracking-wide text-blue-600">Registration</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Child Onboarding Form</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Fill in each section carefully. Centre details auto-fill once you pick an EAC number, so you can
          focus on the child's personal and academic information.
        </p>
      </header>

      {message && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${
            message.type === 'success'
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
    </main>
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