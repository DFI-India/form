'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ChildForm() {
  const [eacOptions, setEacOptions] = useState<any[]>([])
  const [formData, setFormData] = useState({
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

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchEacData()
  }, [])

  const fetchEacData = async () => {
    try {
      const { data, error } = await supabase
        .from('centre_data')
        .select('*')
      
      if (error) throw error
      setEacOptions(data || [])
    } catch (error) {
      console.error('Error fetching EAC data:', error)
    }
  }

  const handleEacChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedEac = e.target.value
    const eacData = eacOptions.find(item => item.eac_no.toString() === selectedEac)
    
    if (eacData) {
      setFormData({
        ...formData,
        eac_no: selectedEac,
        village_name: eacData.village_name || '',
        centre_id: eacData.centre_id || '',
        district: eacData.district || '',
        taluk: eacData.taluk || '',
        panchayat: eacData.panchayat || '',
        village: eacData.village || ''
      })
    } else {
      setFormData({
        ...formData,
        eac_no: selectedEac
      })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('Child_Data')
        .insert([formData])

      if (error) throw error

      setMessage('Child data saved successfully!')
      setFormData({
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
    } catch (error: any) {
      setMessage('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Child Registration Form</h1>
      
      {message && (
        <div className={`p-4 mb-4 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">EAC No *</label>
            <select
              name="eac_no"
              value={formData.eac_no}
              onChange={handleEacChange}
              required
              className="w-full p-2 border rounded"
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
            <label className="block text-sm font-medium mb-1">Village Name</label>
            <input
              type="text"
              name="village_name"
              value={formData.village_name}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Centre ID</label>
            <input
              type="text"
              name="centre_id"
              value={formData.centre_id}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">District</label>
            <input
              type="text"
              name="district"
              value={formData.district}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Taluk</label>
            <input
              type="text"
              name="taluk"
              value={formData.taluk}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Panchayat</label>
            <input
              type="text"
              name="panchayat"
              value={formData.panchayat}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Village</label>
            <input
              type="text"
              name="village"
              value={formData.village}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Admission Date</label>
            <input
              type="date"
              name="adm_date"
              value={formData.adm_date}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Registration No</label>
            <input
              type="number"
              name="reg_no"
              value={formData.reg_no}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">First Name</label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Last Name</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Aadhar No</label>
            <input
              type="number"
              name="aadhar_no"
              value={formData.aadhar_no}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Birth Place</label>
            <input
              type="text"
              name="birth_place"
              value={formData.birth_place}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Height (cm)</label>
            <input
              type="number"
              name="height"
              value={formData.height}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Weight (kg)</label>
            <input
              type="number"
              name="weight"
              value={formData.weight}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Blood Group</label>
            <select
              name="blood_group"
              value={formData.blood_group}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Health Status</label>
            <input
              type="text"
              name="health"
              value={formData.health}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Caste</label>
            <input
              type="text"
              name="caste"
              value={formData.caste}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mother Tongue</label>
            <input
              type="text"
              name="mother_tongue"
              value={formData.mother_tongue}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Class/Standard</label>
            <input
              type="number"
              name="class_std"
              value={formData.class_std}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">School Name</label>
            <input
              type="text"
              name="school_name"
              value={formData.school_name}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">School Category</label>
            <input
              type="text"
              name="school_category"
              value={formData.school_category}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">SATS No</label>
            <input
              type="number"
              name="sats_no"
              value={formData.sats_no}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">PEN No</label>
            <input
              type="number"
              name="pen_no"
              value={formData.pen_no}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Medium of Study</label>
            <input
              type="text"
              name="medium_of_study"
              value={formData.medium_of_study}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Life Ambition</label>
            <input
              type="text"
              name="life_ambition"
              value={formData.life_ambition}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Favorite Subject</label>
            <input
              type="text"
              name="fav_subject"
              value={formData.fav_subject}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Photo Link</label>
            <input
              type="url"
              name="photo_link"
              value={formData.photo_link}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Other Information</label>
          <textarea
            name="child_other_info"
            value={formData.child_other_info}
            onChange={handleChange}
            rows={3}
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white p-3 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Child Data'}
        </button>
      </form>
    </div>
  )
}