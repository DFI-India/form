'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'
import { Baby, Users, UserPlus, Shirt, DoorOpen, GraduationCap, Monitor, CheckCircle } from 'lucide-react'

type EntityType = 'child_data' | 'childfmly' | 'childsibling' | 'childuniform' | 'childleaving' | 'vocational_course' | 'computer_course'

interface ReviewRecord {
  record_id: number
  eac_no: string | number
  reg_no?: string | number
  status: string
  created_at: string
  submitter?: { username: string; role: string }
  first_name?: string
  last_name?: string
  trainee_name?: string
  child_name?: string
  f_name?: string
  [key: string]: any
}

const ENTITY_LABELS: Record<EntityType, string> = {
  child_data: 'Child Data',
  childfmly: 'Family',
  childsibling: 'Siblings',
  childuniform: 'Uniform',
  childleaving: 'Leaving',
  vocational_course: 'Vocational',
  computer_course: 'Computer'
}

const getEntityIcon = (type: EntityType, className = 'w-5 h-5') => {
  const iconProps = { className }
  switch (type) {
    case 'child_data': return <Baby {...iconProps} />
    case 'childfmly': return <Users {...iconProps} />
    case 'childsibling': return <UserPlus {...iconProps} />
    case 'childuniform': return <Shirt {...iconProps} />
    case 'childleaving': return <DoorOpen {...iconProps} />
    case 'vocational_course': return <GraduationCap {...iconProps} />
    case 'computer_course': return <Monitor {...iconProps} />
  }
}

// Fields that should be verified
const VERIFICATION_FIELDS: Record<EntityType, string[]> = {
  child_data: ['first_name', 'last_name', 'gender', 'aadhar_no', 'birth_place', 'school_name', 'class_std', 'photo_link'],
  childfmly: ['f_name', 'f_aadhar', 'f_mobile', 'm_name', 'm_aadhar', 'm_mobile', 'fmly_addr1', 'fmly_pincode'],
  childsibling: ['names_1', 'ages_1', 'genders_1', 'class_occup_1'],
  childuniform: ['shirtsize', 'knickersize', 'pant_skirtsize', 'footwearsize'],
  childleaving: ['reason', 'leav_class', 'leav_date', 'leav_addr1', 'leav_pincode'],
  vocational_course: ['trainee_name', 'aadhar_no', 'enrolled_course', 'batch_no', 'date_of_admission'],
  computer_course: ['child_name', 'aadhar_no', 'course_name', 'batch_no', 'date_of_admission']
}

export default function DFIStaffReviewQueuePage() {
  const router = useRouter()
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['dfi_staff', 'dfi_field_staff'])
  
  const [activeTab, setActiveTab] = useState<EntityType>('child_data')
  const [data, setData] = useState<Record<string, ReviewRecord[]>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  
  // Review modal state
  const [reviewingRecord, setReviewingRecord] = useState<ReviewRecord | null>(null)
  const [editFormData, setEditFormData] = useState<Record<string, any>>({})
  const [qualityIssues, setQualityIssues] = useState<string[]>([])
  const [qualityNote, setQualityNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token || null
      if (token) {
        setSessionToken(token)
        await fetchPendingRecords(token)
      }
    }
    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  const fetchPendingRecords = async (token: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/approvals/list?status=Pending&entityType=all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setData(json.data || {})
      setCounts(json.counts || {})
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenReview = (record: ReviewRecord) => {
    setReviewingRecord(record)
    const editableFields: Record<string, any> = {}
    VERIFICATION_FIELDS[activeTab].forEach(field => {
      editableFields[field] = record[field] || ''
    })
    setEditFormData(editableFields)
    setQualityIssues([])
    setQualityNote('')
  }

  const toggleQualityIssue = (field: string) => {
    setQualityIssues(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field) 
        : [...prev, field]
    )
  }

  const handleSaveAndApprove = async () => {
    if (!sessionToken || !reviewingRecord) return
    setSaving(true)
    setError('')
    try {
      // First update the record if there are edits
      const updateRes = await fetch('/api/admin/records/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          entityType: activeTab,
          entityId: reviewingRecord.record_id,
          updates: editFormData
        })
      })
      if (!updateRes.ok) {
        const json = await updateRes.json()
        throw new Error(json.error)
      }

      // Then approve the record
      const approveRes = await fetch('/api/admin/approvals/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          entityType: activeTab,
          entityId: reviewingRecord.record_id
        })
      })
      if (!approveRes.ok) {
        const json = await approveRes.json()
        throw new Error(json.error)
      }

      setSuccess('Record verified and approved!')
      setReviewingRecord(null)
      setTimeout(() => setSuccess(''), 3000)
      await fetchPendingRecords(sessionToken)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleFlagForReview = async () => {
    if (!sessionToken || !reviewingRecord || qualityIssues.length === 0) return
    setSaving(true)
    setError('')
    try {
      // Reject with quality issues
      const res = await fetch('/api/admin/approvals/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          entityType: activeTab,
          entityId: reviewingRecord.record_id,
          reason: `Quality Issues: ${qualityIssues.join(', ')}. ${qualityNote}`
        })
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error)
      }

      setSuccess('Record flagged for re-submission')
      setReviewingRecord(null)
      setTimeout(() => setSuccess(''), 3000)
      await fetchPendingRecords(sessionToken)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const getRecordName = (record: ReviewRecord): string => {
    if (record.first_name && record.last_name) {
      return `${record.first_name} ${record.last_name}`
    }
    if (record.trainee_name) return record.trainee_name
    if (record.child_name) return record.child_name
    if (record.f_name) return `Father: ${record.f_name}`
    return `Record #${record.record_id}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

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

  const roleInfo = ROLE_CONFIG.find(r => r.value === profile.role)!
  const currentTabData = data[activeTab] || []
  const totalPending = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar
        username={profile.username}
        role={profile.role as any}
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color}
      />
      <Sidebar role={profile.role as any} />

      <PageContainer>
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Review Queue</h2>
              <p className="text-slate-600 mt-2">
                Verify and review submitted data before approval 
                <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  {totalPending} pending
                </span>
              </p>
            </div>
            <button
              onClick={() => router.push(`/${profile.role === 'dfi_staff' ? 'dfi-staff' : 'dfi-field-staff'}`)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Alerts */}
          {error && <Alert type="error" message={error} className="mb-6" />}
          {success && <Alert type="success" message={success} className="mb-6" />}

          {/* Entity Type Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 mb-6">
            <div className="flex overflow-x-auto">
              {(Object.keys(ENTITY_LABELS) as EntityType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`flex-1 min-w-[120px] px-4 py-4 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === type
                      ? 'border-purple-600 text-purple-600 bg-purple-50'
                      : 'border-transparent text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="mr-2">{getEntityIcon(type, 'w-5 h-5')}</span>
                  {ENTITY_LABELS[type]}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    counts[type] > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {counts[type] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Records List */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-slate-600">Loading submissions...</p>
              </div>
            ) : currentTabData.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">No pending {ENTITY_LABELS[activeTab]} records to review</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {currentTabData.map((record) => (
                  <div key={record.record_id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {getEntityIcon(activeTab, 'w-6 h-6 text-slate-700')}
                          <div>
                            <h3 className="font-semibold text-slate-900">{getRecordName(record)}</h3>
                            <p className="text-sm text-slate-600">
                              #{record.record_id} • EAC: {record.eac_no} • Reg: {record.reg_no || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                          <span>
                            Submitted by: <strong>{record.submitter?.username || 'Unknown'}</strong>
                          </span>
                          <span>•</span>
                          <span>{formatDate(record.created_at)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenReview(record)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                      >
                        🔍 Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContainer>

      {/* Review Modal */}
      {reviewingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                Review {ENTITY_LABELS[activeTab]} - {getRecordName(reviewingRecord)}
              </h3>
              <button
                onClick={() => setReviewingRecord(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              {/* Verification Fields */}
              <div className="mb-6">
                <h4 className="font-semibold text-slate-900 mb-4">Verify & Edit Fields</h4>
                <p className="text-sm text-slate-600 mb-4">
                  Review each field. Click the flag (🚩) to mark fields with quality issues.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {VERIFICATION_FIELDS[activeTab].map(field => (
                    <div key={field} className={`p-4 rounded-lg border ${
                      qualityIssues.includes(field) 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-slate-200 bg-slate-50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700">
                          {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </label>
                        <button
                          onClick={() => toggleQualityIssue(field)}
                          className={`p-1 rounded transition-colors ${
                            qualityIssues.includes(field)
                              ? 'bg-red-200 text-red-800'
                              : 'hover:bg-slate-200 text-slate-400'
                          }`}
                          title={qualityIssues.includes(field) ? 'Remove flag' : 'Flag issue'}
                        >
                          🚩
                        </button>
                      </div>
                      <input
                        type={field.includes('date') ? 'date' : 'text'}
                        value={editFormData[field] || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, [field]: e.target.value }))}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          qualityIssues.includes(field)
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                            : 'border-slate-300 focus:ring-purple-500 focus:border-purple-500'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Issues Note */}
              {qualityIssues.length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">
                    ⚠️ {qualityIssues.length} field(s) flagged for issues
                  </h4>
                  <p className="text-sm text-red-700 mb-3">
                    Fields: {qualityIssues.join(', ')}
                  </p>
                  <textarea
                    value={qualityNote}
                    onChange={(e) => setQualityNote(e.target.value)}
                    placeholder="Add notes about the quality issues..."
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm resize-none"
                    rows={2}
                  />
                </div>
              )}

              {/* All Record Data (Read-only reference) */}
              <div className="mb-6">
                <h4 className="font-semibold text-slate-900 mb-3">All Submitted Data</h4>
                <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {Object.entries(reviewingRecord).map(([key, value]) => {
                      if (['submitter', 'approver'].includes(key)) return null
                      if (value === null || value === undefined) return null
                      return (
                        <div key={key}>
                          <p className="text-xs text-slate-500">{key.replace(/_/g, ' ')}</p>
                          <p className="text-slate-900 truncate" title={String(value)}>
                            {String(value)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setReviewingRecord(null)}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                {qualityIssues.length > 0 ? (
                  <button
                    onClick={handleFlagForReview}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    {saving ? 'Processing...' : '🚩 Flag for Re-submission'}
                  </button>
                ) : (
                  <button
                    onClick={handleSaveAndApprove}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                  >
                    {saving ? 'Processing...' : (
                      <>
                        <CheckCircle className="w-5 h-5" /> Verify & Approve
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
