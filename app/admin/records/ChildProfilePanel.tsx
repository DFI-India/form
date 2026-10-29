'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Check, AlertTriangle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { getStandardColumnLabel } from '../../../lib/columnLabels'
import { safeFileName } from '../../../lib/csv'
import {
  SECTION_SCHEMA,
  coerceSectionValues,
  emptySectionValues,
  sectionValuesFromRow,
  type ChildSectionKey,
  type SectionField,
  type SectionGroup,
} from '../../../lib/childSections'

export type SectionKey = 'child_data' | ChildSectionKey

const SECTION_LABELS: Record<SectionKey, string> = {
  child_data: 'Personal',
  childfmly: SECTION_SCHEMA.childfmly.label,
  childsibling: SECTION_SCHEMA.childsibling.label,
  childuniform: SECTION_SCHEMA.childuniform.label,
  childleaving: SECTION_SCHEMA.childleaving.label,
}

const SECTION_ORDER: SectionKey[] = ['child_data', 'childfmly', 'childsibling', 'childuniform', 'childleaving']

/**
 * Personal-tab columns that are shown in the header or managed elsewhere.
 * eac_no and reg_no are the keys every other section hangs off — changing them
 * here would silently detach the child's family, siblings and uniform rows.
 */
const NON_EDITABLE_FIELDS = new Set([
  'id',
  'record_id',
  'eac_no',
  'reg_no',
  'village_id',
  'submitted_by',
  'verified_by',
  'verified_at',
  'approved_by',
  'approved_at',
  'created_at',
  'updated_at',
  'status',
])

type Row = Record<string, any>
type ProfileData = Partial<Record<SectionKey, Row | null>>
type FormValues = Record<string, any>

interface ChildProfilePanelProps {
  eacNo: string | number
  regNo: string | number
  token: string
  initialSection?: SectionKey
  onClose: () => void
  onSaved: () => void
}

const inputClass =
  'h-[36px] w-full rounded-md border border-rule-strong bg-surface px-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-blue-500'
const labelClass = 'mb-1 block text-[13px] text-ink-muted'

const isSchemaSection = (section: SectionKey): section is ChildSectionKey => section !== 'child_data'

/** Snapshot used to tell whether a tab has unsaved edits. */
const snapshot = (values: FormValues | undefined) => JSON.stringify(values ?? null)

function FieldInput({
  field,
  value,
  onChange,
  ariaLabel,
}: {
  field: SectionField
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}) {
  if (field.kind === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        aria-label={ariaLabel}
        className={`${inputClass} h-auto py-2`}
      />
    )
  }

  if (field.kind === 'select') {
    // Keep an imported value that isn't in today's list rather than blanking it.
    const options = field.options ?? []
    const extra = value && !options.includes(value) ? [value] : []
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel} className={inputClass}>
        <option value="">—</option>
        {[...extra, ...options].map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
      inputMode={field.kind === 'number' ? 'numeric' : undefined}
      min={field.kind === 'number' ? 0 : undefined}
      step={field.integer ? 1 : field.kind === 'number' ? 'any' : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={inputClass}
    />
  )
}

/**
 * Draws a section from its schema. Consecutive four-column groups (the sibling
 * slots) collapse into one compact table instead of five stacked cards.
 */
function SchemaForm({
  groups,
  values,
  onChange,
}: {
  groups: SectionGroup[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const blocks: ({ kind: 'table'; groups: SectionGroup[] } | { kind: 'group'; group: SectionGroup })[] = []
  for (const group of groups) {
    const last = blocks[blocks.length - 1]
    if (group.columns === 4) {
      if (last?.kind === 'table') last.groups.push(group)
      else blocks.push({ kind: 'table', groups: [group] })
    } else {
      blocks.push({ kind: 'group', group })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block, i) => {
        if (block.kind === 'table') {
          const header = block.groups[0].fields
          return (
            <div key={i} className="overflow-x-auto">
              <div className="grid min-w-[520px] grid-cols-[20px_minmax(0,1.6fr)_64px_96px_minmax(0,1.4fr)] items-center gap-2">
                <span />
                {header.map((f) => (
                  <span key={f.key} className="text-[13px] text-ink-muted">
                    {f.label}
                  </span>
                ))}
                {block.groups.map((group, row) => (
                  <div key={group.title ?? row} className="contents">
                    <span className="text-right font-mono text-[12.5px] text-ink-faint">{row + 1}</span>
                    {group.fields.map((f) => (
                      <FieldInput
                        key={f.key}
                        field={f}
                        value={values[f.key] ?? ''}
                        onChange={(v) => onChange(f.key, v)}
                        ariaLabel={`${group.title ?? ''} ${f.label}`.trim()}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        }

        const { group } = block
        return (
          <div key={i}>
            {group.title && <h4 className="mb-2 text-[13.5px] font-semibold text-ink">{group.title}</h4>}
            <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
              {group.fields.map((f) => (
                <label key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                  <span className={labelClass}>{f.label}</span>
                  <FieldInput field={f} value={values[f.key] ?? ''} onChange={(v) => onChange(f.key, v)} />
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ChildProfilePanel({
  eacNo,
  regNo,
  token,
  initialSection = 'child_data',
  onClose,
  onSaved,
}: ChildProfilePanelProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [profileData, setProfileData] = useState<ProfileData>({})
  const [duplicates, setDuplicates] = useState<Partial<Record<SectionKey, number>>>({})
  const [activeSection, setActiveSection] = useState<SectionKey>(initialSection)
  const [forms, setForms] = useState<Partial<Record<SectionKey, FormValues>>>({})
  const [baseline, setBaseline] = useState<Partial<Record<SectionKey, string>>>({})
  const [markLeft, setMarkLeft] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoBroken, setPhotoBroken] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  /** Form values for one section, from its row or blank when it doesn't exist yet. */
  const formFor = useCallback((section: SectionKey, row: Row | null | undefined): FormValues | undefined => {
    if (!isSchemaSection(section)) return row ? { ...row } : undefined
    return row ? sectionValuesFromRow(section, row) : emptySectionValues(section)
  }, [])

  const resetSection = useCallback(
    (section: SectionKey, row: Row | null) => {
      const values = formFor(section, row)
      setForms((prev) => ({ ...prev, [section]: values }))
      setBaseline((prev) => ({ ...prev, [section]: snapshot(values) }))
    },
    [formFor]
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const params = new URLSearchParams({ eacNo: String(eacNo), regNo: String(regNo) })
        const res = await fetch(`/api/admin/records/child-profile?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load child profile')
        if (cancelled) return

        setProfileData(json.data)
        setDuplicates(json.duplicates || {})
        const nextForms: Partial<Record<SectionKey, FormValues>> = {}
        const nextBaseline: Partial<Record<SectionKey, string>> = {}
        for (const key of SECTION_ORDER) {
          const values = formFor(key, json.data[key])
          nextForms[key] = values
          nextBaseline[key] = snapshot(values)
        }
        setForms(nextForms)
        setBaseline(nextBaseline)
      } catch (err: any) {
        if (!cancelled) setLoadError(err.message || 'Failed to load child profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [eacNo, regNo, token, formFor])

  const isDirty = useCallback(
    (section: SectionKey) => forms[section] !== undefined && snapshot(forms[section]) !== baseline[section],
    [forms, baseline]
  )

  const anyDirty = useMemo(() => SECTION_ORDER.some((s) => isDirty(s)), [isDirty])

  const handleClose = useCallback(() => {
    if (anyDirty && !window.confirm('You have unsaved changes. Close without saving?')) return
    setVisible(false)
    setTimeout(onClose, 200)
  }, [anyDirty, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  const childName = useMemo(() => {
    const child = profileData.child_data
    if (!child) return `EAC ${eacNo} · Reg No ${regNo}`
    return [child.first_name, child.last_name].filter(Boolean).join(' ') || `EAC ${eacNo} · Reg No ${regNo}`
  }, [profileData, eacNo, regNo])

  const setField = (section: SectionKey, field: string, value: unknown) => {
    setForms((prev) => ({ ...prev, [section]: { ...(prev[section] || {}), [field]: value } }))
  }

  const handlePhotoUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5MB or smaller')
      return
    }

    setUploadingPhoto(true)
    setError('')

    try {
      const safeName = safeFileName(file.name)
      const filePath = `admin_records_photos/${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('profiles').getPublicUrl(filePath)
      setPhotoBroken(false)
      setField('child_data', 'photo_link', data.publicUrl)
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const flash = (message: string) => {
    setSaveMessage(message)
    setTimeout(() => setSaveMessage(''), 2500)
  }

  const handleSave = async (section: SectionKey) => {
    const existing = profileData[section]
    const formData = forms[section]
    if (!formData) return

    setSaving(true)
    setSaveMessage('')
    setError('')

    try {
      // --- A section that has never been recorded: create it. ---
      if (isSchemaSection(section) && !existing) {
        const res = await fetch('/api/admin/records/create-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            section,
            eacNo,
            regNo,
            values: formData,
            markLeft: section === 'childleaving' ? markLeft : undefined,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to save')

        setProfileData((prev) => ({
          ...prev,
          [section]: json.data,
          ...(json.childLeftUpdated && prev.child_data
            ? { child_data: { ...prev.child_data, child_left: true } }
            : {}),
        }))
        resetSection(section, json.data)
        if (json.childLeftUpdated && profileData.child_data) {
          // Patch just the flag so unsaved Personal edits survive.
          setForms((prev) => ({ ...prev, child_data: { ...(prev.child_data || {}), child_left: true } }))
          setBaseline((prev) => ({
            ...prev,
            child_data: snapshot({ ...formFor('child_data', profileData.child_data), child_left: true }),
          }))
        }
        flash(`${SECTION_LABELS[section]} added.`)
        onSaved()
        return
      }

      if (!existing) return

      // --- Editing an existing row. ---
      let updates: Record<string, unknown>
      if (isSchemaSection(section)) {
        const coerced = coerceSectionValues(section, formData)
        if ('error' in coerced) throw new Error(coerced.error)
        updates = coerced.value
      } else {
        updates = {}
        for (const key of Object.keys(formData)) {
          if (NON_EDITABLE_FIELDS.has(key)) continue
          const value = formData[key]
          // A cleared input is '' — send null so numeric and date columns accept it.
          if (value === '') updates[key] = null
          else if (key === 'child_left') updates[key] = value === true || value === 'true'
          else updates[key] = value
        }
      }

      const res = await fetch('/api/admin/records/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          entityType: section,
          entityId: existing.record_id ?? existing.id,
          updates,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')

      setProfileData((prev) => ({ ...prev, [section]: json.data }))
      resetSection(section, json.data)
      flash(`${SECTION_LABELS[section]} saved.`)
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to save section')
    } finally {
      setSaving(false)
    }
  }

  const activeRow = profileData[activeSection]
  const activeForm = forms[activeSection]
  const creating = isSchemaSection(activeSection) && !activeRow
  const dirty = isDirty(activeSection)
  const duplicateCount = duplicates[activeSection]

  const saveLabel = uploadingPhoto
    ? 'Uploading photo…'
    : saving
    ? 'Saving…'
    : creating
    ? `Add ${isSchemaSection(activeSection) ? SECTION_SCHEMA[activeSection].noun : ''}`
    : 'Save changes'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${childName}`}
        className={`absolute inset-y-0 right-0 flex h-full w-full max-w-2xl transform flex-col border-l border-rule bg-surface text-ink shadow-2xl transition-transform duration-200 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-rule px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-semibold">{childName}</h3>
            <p className="font-mono text-[13px] text-ink-muted">
              EAC {eacNo} · Reg No {regNo}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
            aria-label="Close"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[14px] text-ink-muted">Loading child profile…</div>
        ) : loadError ? (
          <div className="p-12 text-center text-[14px] text-status-returned-fg">{loadError}</div>
        ) : (
          <>
            <div className="flex shrink-0 border-b border-rule px-2" role="tablist">
              {SECTION_ORDER.map((section) => {
                const hasData = Boolean(profileData[section])
                const isActive = activeSection === section
                return (
                  <button
                    key={section}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveSection(section)
                      setError('')
                    }}
                    className={`-mb-px flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 text-[14px] transition-colors ${
                      isActive
                        ? 'border-ink font-medium text-ink'
                        : 'border-transparent text-ink-muted hover:text-ink'
                    }`}
                  >
                    {hasData ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-status-approved-fg" aria-label="Recorded" />
                    ) : (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-ink-faint"
                        aria-label="Not recorded"
                      />
                    )}
                    <span className="truncate">{SECTION_LABELS[section]}</span>
                    {isDirty(section) && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending-fg" aria-label="Unsaved" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {error && (
                <div className="mb-4 rounded-md border border-status-returned-fg/30 bg-status-returned-bg px-3 py-2 text-[14px] text-status-returned-fg">
                  {error}
                </div>
              )}

              {duplicateCount && duplicateCount > 1 && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-status-pending-fg/30 bg-status-pending-bg px-3 py-2 text-[13.5px] text-status-pending-fg">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    This child has {duplicateCount} {SECTION_LABELS[activeSection].toLowerCase()} records. Showing and
                    editing the newest one.
                  </span>
                </div>
              )}

              {creating && (
                <div className="mb-4 rounded-md border border-dashed border-rule-strong px-3 py-2.5 text-[13.5px] text-ink-muted">
                  No {isSchemaSection(activeSection) ? SECTION_SCHEMA[activeSection].noun : ''} recorded yet. Fill in
                  what you have and it will be saved as approved by you.
                </div>
              )}

              {isSchemaSection(activeSection) && activeForm ? (
                <>
                  <SchemaForm
                    groups={SECTION_SCHEMA[activeSection].groups}
                    values={activeForm as Record<string, string>}
                    onChange={(key, value) => setField(activeSection, key, value)}
                  />
                  {creating && activeSection === 'childleaving' && profileData.child_data?.child_left !== true && (
                    <label className="mt-5 flex items-center gap-2 text-[14px]">
                      <input
                        type="checkbox"
                        checked={markLeft}
                        onChange={(e) => setMarkLeft(e.target.checked)}
                        className="h-4 w-4 accent-current"
                      />
                      Also mark this child as left
                    </label>
                  )}
                </>
              ) : activeForm ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.entries(activeForm).map(([key, value]) => {
                    if (NON_EDITABLE_FIELDS.has(key)) return null

                    if (key === 'photo_link') {
                      return (
                        <div key={key} className="sm:col-span-2">
                          <span className={labelClass}>{getStandardColumnLabel(key)}</span>
                          <div className="flex items-start gap-4">
                            {value && !photoBroken ? (
                              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, no loader configured
                              <img
                                src={String(value)}
                                alt="Child photo"
                                onError={() => setPhotoBroken(true)}
                                className="h-24 w-24 shrink-0 rounded-lg border border-rule object-cover"
                              />
                            ) : (
                              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-rule-strong text-center text-[12px] leading-tight text-ink-faint">
                                {value ? 'Photo did not load' : 'No photo'}
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-2">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handlePhotoUpload(file)
                                }}
                                className="w-full text-[13.5px] text-ink-muted file:mr-3 file:h-[34px] file:rounded-md file:border file:border-rule-strong file:bg-surface file:px-2.5 file:text-[13.5px] file:text-ink"
                              />
                              {uploadingPhoto && <p className="text-[13px] text-ink-faint">Uploading image…</p>}
                              {value ? (
                                <a
                                  href={String(value)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-[13px] text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  Open full size
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    }

                    if (key === 'child_left') {
                      const current = value === true || value === 'true' ? 'true' : ''
                      return (
                        <label key={key}>
                          <span className={labelClass}>Enrolment</span>
                          <select
                            value={current}
                            onChange={(e) => setField('child_data', key, e.target.value)}
                            className={inputClass}
                          >
                            <option value="">Enrolled</option>
                            <option value="true">Left</option>
                          </select>
                        </label>
                      )
                    }

                    return (
                      <label key={key}>
                        <span className={labelClass}>{getStandardColumnLabel(key)}</span>
                        <input
                          type={key.toLowerCase().includes('date') ? 'date' : 'text'}
                          value={value === null || value === undefined ? '' : String(value)}
                          onChange={(e) => setField('child_data', key, e.target.value)}
                          className={inputClass}
                        />
                      </label>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-rule px-5 py-3">
              <span className="text-[13.5px] text-ink-muted" aria-live="polite">
                {saveMessage ? (
                  <span className="text-status-approved-fg">{saveMessage}</span>
                ) : dirty ? (
                  'Unsaved changes'
                ) : creating ? (
                  ''
                ) : (
                  'No changes'
                )}
              </span>
              <button
                type="button"
                onClick={() => handleSave(activeSection)}
                disabled={saving || uploadingPhoto || !dirty}
                className="h-[36px] rounded-md bg-ink px-3.5 text-[14px] font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saveLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
