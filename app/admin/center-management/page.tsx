'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireRole } from '../../../lib/hooks'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, Alert } from '../../components/UI'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { ROLE_CONFIG } from '../../../lib/types'
import { ArrowLeft, Search, MapPin, Building2, Landmark, Map } from 'lucide-react'

type CentreRecord = {
  id: string
  eac_no: string | number
  village_name: string | null
  district: string | null
  taluk: string | null
  panchayat: string | null
  start_date: string | null
  end_date: string | null
  cbv_name: string | null
  in_charge: string | null
  panchayat_member: string | null
  head_master: string | null
  anganvadi: string | null
  asha_worker: string | null
  head_master_mobile: string | null
  in_charge_mobile: string | null
  cbv_mobile: string | null
  panchayat_member_mobile: string | null
  anganvadi_mobile: string | null
  asha_worker_mobile: string | null
  cbv_email: string | null
}

type CentreFormState = {
  eac_no: string
  village_name: string
  district: string
  taluk: string
  panchayat: string
  start_date: string
  end_date: string
  cbv_name: string
  in_charge: string
  panchayat_member: string
  head_master: string
  anganvadi: string
  asha_worker: string
  head_master_mobile: string
  in_charge_mobile: string
  cbv_mobile: string
  panchayat_member_mobile: string
  anganvadi_mobile: string
  asha_worker_mobile: string
  cbv_email: string
}

const emptyForm: CentreFormState = {
  eac_no: '',
  village_name: '',
  district: '',
  taluk: '',
  panchayat: '',
  start_date: '',
  end_date: '',
  cbv_name: '',
  in_charge: '',
  panchayat_member: '',
  head_master: '',
  anganvadi: '',
  asha_worker: '',
  head_master_mobile: '',
  in_charge_mobile: '',
  cbv_mobile: '',
  panchayat_member_mobile: '',
  anganvadi_mobile: '',
  asha_worker_mobile: '',
  cbv_email: '',
}

const tableColumns: Array<{ key: keyof CentreFormState; label: string }> = [
  { key: 'eac_no', label: 'EAC No' },
  { key: 'village_name', label: 'Village Name' },
  { key: 'district', label: 'District' },
  { key: 'taluk', label: 'Taluk' },
  { key: 'panchayat', label: 'Panchayat' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'End Date' },
  { key: 'cbv_name', label: 'CBV Name' },
  { key: 'in_charge', label: 'In Charge' },
  { key: 'panchayat_member', label: 'Panchayat Member' },
  { key: 'head_master', label: 'Head Master' },
  { key: 'anganvadi', label: 'Anganvadi' },
  { key: 'asha_worker', label: 'ASHA Worker' },
  { key: 'head_master_mobile', label: 'Head Master Mobile' },
  { key: 'in_charge_mobile', label: 'In Charge Mobile' },
  { key: 'cbv_mobile', label: 'CBV Mobile' },
  { key: 'panchayat_member_mobile', label: 'Panchayat Member Mobile' },
  { key: 'anganvadi_mobile', label: 'Anganvadi Mobile' },
  { key: 'asha_worker_mobile', label: 'ASHA Worker Mobile' },
  { key: 'cbv_email', label: 'CBV Email' },
]

type SortDirection = 'asc' | 'desc'
type SortableColumn = keyof CentreFormState
type CascadeManageLevel = 'district' | 'taluk' | 'panchayat' | 'village'
type CascadeManageRow = { level: CascadeManageLevel; value: string; parent: string; affected: number }
type TextDialogAction = 'add-district' | 'add-taluk' | 'add-panchayat' | 'add-village' | 'rename-cascade'

const nonSortableColumns = new Set<SortableColumn>([
  'head_master_mobile',
  'in_charge_mobile',
  'cbv_mobile',
  'panchayat_member_mobile',
  'anganvadi_mobile',
  'asha_worker_mobile',
  'cbv_email',
])

const uniqueSorted = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b))

export default function CenterManagementPage() {
  const router = useRouter()
  const { profile, loading: authLoading, isAuthorized } = useRequireRole(['admin'])

  const [centres, setCentres] = useState<CentreRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState<CentreFormState>(emptyForm)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editCentre, setEditCentre] = useState<CentreRecord | null>(null)
  const [editForm, setEditForm] = useState<CentreFormState>(emptyForm)
  const [deleteCentre, setDeleteCentre] = useState<CentreRecord | null>(null)
  const [sortColumn, setSortColumn] = useState<SortableColumn>('eac_no')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [tableSearch, setTableSearch] = useState('')
  const [showCascadeManager, setShowCascadeManager] = useState(false)
  const [showCentreRecords, setShowCentreRecords] = useState(false)
  const [customDistricts, setCustomDistricts] = useState<string[]>([])
  const [customTaluksByDistrict, setCustomTaluksByDistrict] = useState<Record<string, string[]>>({})
  const [customPanchayatsByTaluk, setCustomPanchayatsByTaluk] = useState<Record<string, string[]>>({})
  const [customVillagesByPanchayat, setCustomVillagesByPanchayat] = useState<Record<string, string[]>>({})
  const [cascadeScope, setCascadeScope] = useState({ district: '', taluk: '', panchayat: '' })
  const [cascadeLoading, setCascadeLoading] = useState(false)
  const [textDialog, setTextDialog] = useState<{
    open: boolean
    title: string
    label: string
    confirmText: string
    action: TextDialogAction
    value: string
    row?: CascadeManageRow
  }>({
    open: false,
    title: '',
    label: '',
    confirmText: '',
    action: 'add-district',
    value: '',
  })
  const [cascadeDeleteDialog, setCascadeDeleteDialog] = useState<{ open: boolean; row?: CascadeManageRow }>({ open: false })

  const hierarchy = useMemo(() => {
    const districts = new Set<string>()
    const taluksByDistrict: Record<string, Set<string>> = {}
    const panchayatsByTaluk: Record<string, Set<string>> = {}
    const villagesByPanchayat: Record<string, Set<string>> = {}

    for (const centre of centres) {
      const district = String(centre.district ?? '').trim()
      const taluk = String(centre.taluk ?? '').trim()
      const panchayat = String(centre.panchayat ?? '').trim()
      const village = String(centre.village_name ?? '').trim()

      if (!district) continue
      districts.add(district)

      if (taluk) {
        const districtTaluks = taluksByDistrict[district] ?? new Set<string>()
        districtTaluks.add(taluk)
        taluksByDistrict[district] = districtTaluks

        const talukKey = `${district}::${taluk}`
        if (panchayat) {
          const talukPanchayats = panchayatsByTaluk[talukKey] ?? new Set<string>()
          talukPanchayats.add(panchayat)
          panchayatsByTaluk[talukKey] = talukPanchayats

          const panchayatKey = `${district}::${taluk}::${panchayat}`
          if (village) {
            const panchayatVillages = villagesByPanchayat[panchayatKey] ?? new Set<string>()
            panchayatVillages.add(village)
            villagesByPanchayat[panchayatKey] = panchayatVillages
          }
        }
      }
    }

    return { districts, taluksByDistrict, panchayatsByTaluk, villagesByPanchayat }
  }, [centres])

  const districtOptions = useMemo(() => {
    return uniqueSorted([...Array.from(hierarchy.districts), ...customDistricts])
  }, [customDistricts, hierarchy.districts])

  const talukKey = `${createForm.district}::${createForm.taluk}`
  const panchayatKey = `${createForm.district}::${createForm.taluk}::${createForm.panchayat}`

  const talukOptions = useMemo(() => {
    if (!createForm.district) return []
    const baseTaluks = Array.from(hierarchy.taluksByDistrict[createForm.district] ?? [])
    const customTaluks = customTaluksByDistrict[createForm.district] ?? []
    return uniqueSorted([...baseTaluks, ...customTaluks])
  }, [createForm.district, customTaluksByDistrict, hierarchy.taluksByDistrict])

  const panchayatOptions = useMemo(() => {
    if (!createForm.district || !createForm.taluk) return []
    const basePanchayats = Array.from(hierarchy.panchayatsByTaluk[talukKey] ?? [])
    const customPanchayats = customPanchayatsByTaluk[talukKey] ?? []
    return uniqueSorted([...basePanchayats, ...customPanchayats])
  }, [createForm.district, createForm.taluk, customPanchayatsByTaluk, hierarchy.panchayatsByTaluk, talukKey])

  const villageOptions = useMemo(() => {
    if (!createForm.district || !createForm.taluk || !createForm.panchayat) return []
    const baseVillages = Array.from(hierarchy.villagesByPanchayat[panchayatKey] ?? [])
    const customVillages = customVillagesByPanchayat[panchayatKey] ?? []
    return uniqueSorted([...baseVillages, ...customVillages])
  }, [createForm.district, createForm.taluk, createForm.panchayat, customVillagesByPanchayat, hierarchy.villagesByPanchayat, panchayatKey])

  const cascadeTalukOptions = useMemo(() => {
    if (!cascadeScope.district) return []
    const baseTaluks = Array.from(hierarchy.taluksByDistrict[cascadeScope.district] ?? [])
    const customTaluks = customTaluksByDistrict[cascadeScope.district] ?? []
    return uniqueSorted([...baseTaluks, ...customTaluks])
  }, [cascadeScope.district, hierarchy.taluksByDistrict, customTaluksByDistrict])

  const cascadePanchayatOptions = useMemo(() => {
    if (!cascadeScope.district || !cascadeScope.taluk) return []
    const key = `${cascadeScope.district}::${cascadeScope.taluk}`
    const basePanchayats = Array.from(hierarchy.panchayatsByTaluk[key] ?? [])
    const customPanchayats = customPanchayatsByTaluk[key] ?? []
    return uniqueSorted([...basePanchayats, ...customPanchayats])
  }, [cascadeScope.district, cascadeScope.taluk, hierarchy.panchayatsByTaluk, customPanchayatsByTaluk])

  const cascadeVillageOptions = useMemo(() => {
    if (!cascadeScope.district || !cascadeScope.taluk || !cascadeScope.panchayat) return []
    const key = `${cascadeScope.district}::${cascadeScope.taluk}::${cascadeScope.panchayat}`
    const baseVillages = Array.from(hierarchy.villagesByPanchayat[key] ?? [])
    const customVillages = customVillagesByPanchayat[key] ?? []
    return uniqueSorted([...baseVillages, ...customVillages])
  }, [cascadeScope.district, cascadeScope.taluk, cascadeScope.panchayat, hierarchy.villagesByPanchayat, customVillagesByPanchayat])

  const cascadeManageLevel: CascadeManageLevel = !cascadeScope.district
    ? 'district'
    : !cascadeScope.taluk
      ? 'taluk'
      : !cascadeScope.panchayat
        ? 'panchayat'
        : 'village'

  const cascadeManageRows = useMemo(() => {
    const rows: CascadeManageRow[] = []

    if (cascadeManageLevel === 'district') {
      for (const district of districtOptions) {
        const affected = centres.filter((centre) => String(centre.district ?? '').trim() === district).length
        rows.push({ level: 'district', value: district, parent: '-', affected })
      }
    }

    if (cascadeManageLevel === 'taluk') {
      for (const taluk of cascadeTalukOptions) {
        const affected = centres.filter(
          (centre) =>
            String(centre.district ?? '').trim() === cascadeScope.district &&
            String(centre.taluk ?? '').trim() === taluk
        ).length
        rows.push({ level: 'taluk', value: taluk, parent: cascadeScope.district, affected })
      }
    }

    if (cascadeManageLevel === 'panchayat') {
      for (const panchayat of cascadePanchayatOptions) {
        const affected = centres.filter(
          (centre) =>
            String(centre.district ?? '').trim() === cascadeScope.district &&
            String(centre.taluk ?? '').trim() === cascadeScope.taluk &&
            String(centre.panchayat ?? '').trim() === panchayat
        ).length
        rows.push({ level: 'panchayat', value: panchayat, parent: `${cascadeScope.district} / ${cascadeScope.taluk}`, affected })
      }
    }

    if (cascadeManageLevel === 'village') {
      for (const village of cascadeVillageOptions) {
        const affected = centres.filter(
          (centre) =>
            String(centre.district ?? '').trim() === cascadeScope.district &&
            String(centre.taluk ?? '').trim() === cascadeScope.taluk &&
            String(centre.panchayat ?? '').trim() === cascadeScope.panchayat &&
            String(centre.village_name ?? '').trim() === village
        ).length
        rows.push({
          level: 'village',
          value: village,
          parent: `${cascadeScope.district} / ${cascadeScope.taluk} / ${cascadeScope.panchayat}`,
          affected,
        })
      }
    }

    return rows
  }, [
    cascadeManageLevel,
    districtOptions,
    cascadeTalukOptions,
    cascadePanchayatOptions,
    cascadeVillageOptions,
    centres,
    cascadeScope.district,
    cascadeScope.taluk,
    cascadeScope.panchayat,
  ])

  const removeCascadeValueLocally = (
    level: CascadeManageLevel,
    value: string,
    scope: { district?: string; taluk?: string; panchayat?: string }
  ) => {
    if (level === 'district') {
      setCustomDistricts((prev) => prev.filter((item) => item !== value))
      setCustomTaluksByDistrict((prev) => {
        const next = { ...prev }
        delete next[value]
        return next
      })
      return
    }

    if (level === 'taluk' && scope.district) {
      const key = scope.district
      setCustomTaluksByDistrict((prev) => ({
        ...prev,
        [key]: (prev[key] || []).filter((item) => item !== value),
      }))
      setCustomPanchayatsByTaluk((prev) => {
        const oldKey = `${scope.district}::${value}`
        const next = { ...prev }
        delete next[oldKey]
        return next
      })
      return
    }

    if (level === 'panchayat' && scope.district && scope.taluk) {
      const key = `${scope.district}::${scope.taluk}`
      setCustomPanchayatsByTaluk((prev) => ({
        ...prev,
        [key]: (prev[key] || []).filter((item) => item !== value),
      }))
      setCustomVillagesByPanchayat((prev) => {
        const oldKey = `${scope.district}::${scope.taluk}::${value}`
        const next = { ...prev }
        delete next[oldKey]
        return next
      })
      return
    }

    if (level === 'village' && scope.district && scope.taluk && scope.panchayat) {
      const key = `${scope.district}::${scope.taluk}::${scope.panchayat}`
      setCustomVillagesByPanchayat((prev) => ({
        ...prev,
        [key]: (prev[key] || []).filter((item) => item !== value),
      }))
    }
  }

  const openTextDialog = (config: {
    title: string
    label: string
    confirmText: string
    action: TextDialogAction
    value?: string
    row?: CascadeManageRow
  }) => {
    setTextDialog({
      open: true,
      title: config.title,
      label: config.label,
      confirmText: config.confirmText,
      action: config.action,
      value: config.value ?? '',
      row: config.row,
    })
  }

  const addDistrict = () => {
    openTextDialog({
      title: 'Add District',
      label: 'District Name',
      confirmText: 'Add District',
      action: 'add-district',
    })
  }

  const addTaluk = () => {
    if (!createForm.district) return
    openTextDialog({
      title: `Add Taluk in ${createForm.district}`,
      label: 'Taluk Name',
      confirmText: 'Add Taluk',
      action: 'add-taluk',
    })
  }

  const addPanchayat = () => {
    if (!createForm.district || !createForm.taluk) return
    openTextDialog({
      title: `Add Panchayat in ${createForm.taluk}`,
      label: 'Panchayat Name',
      confirmText: 'Add Panchayat',
      action: 'add-panchayat',
    })
  }

  const addVillage = () => {
    if (!createForm.district || !createForm.taluk || !createForm.panchayat) return
    openTextDialog({
      title: `Add Village in ${createForm.panchayat}`,
      label: 'Village Name',
      confirmText: 'Add Village',
      action: 'add-village',
    })
  }

  const applyCascadeRenameLocally = (
    level: 'district' | 'taluk' | 'panchayat' | 'village',
    oldValue: string,
    newValue: string,
    scope: { district?: string; taluk?: string; panchayat?: string }
  ) => {
    if (level === 'district') {
      setCustomDistricts((prev) => prev.map((item) => (item === oldValue ? newValue : item)))
      setCustomTaluksByDistrict((prev) => {
        const next = { ...prev }
        if (next[oldValue]) {
          next[newValue] = uniqueSorted([...(next[newValue] || []), ...next[oldValue]])
          delete next[oldValue]
        }
        return next
      })
    }

    if (level === 'taluk' && scope.district) {
      setCustomTaluksByDistrict((prev) => ({
        ...prev,
        [scope.district!]: (prev[scope.district!] || []).map((item) => (item === oldValue ? newValue : item)),
      }))
      setCustomPanchayatsByTaluk((prev) => {
        const oldKey = `${scope.district}::${oldValue}`
        const newKey = `${scope.district}::${newValue}`
        const next = { ...prev }
        if (next[oldKey]) {
          next[newKey] = uniqueSorted([...(next[newKey] || []), ...next[oldKey]])
          delete next[oldKey]
        }
        return next
      })
    }

    if (level === 'panchayat' && scope.district && scope.taluk) {
      const key = `${scope.district}::${scope.taluk}`
      setCustomPanchayatsByTaluk((prev) => ({
        ...prev,
        [key]: (prev[key] || []).map((item) => (item === oldValue ? newValue : item)),
      }))
      setCustomVillagesByPanchayat((prev) => {
        const oldKey = `${scope.district}::${scope.taluk}::${oldValue}`
        const newKey = `${scope.district}::${scope.taluk}::${newValue}`
        const next = { ...prev }
        if (next[oldKey]) {
          next[newKey] = uniqueSorted([...(next[newKey] || []), ...next[oldKey]])
          delete next[oldKey]
        }
        return next
      })
    }

    if (level === 'village' && scope.district && scope.taluk && scope.panchayat) {
      const key = `${scope.district}::${scope.taluk}::${scope.panchayat}`
      setCustomVillagesByPanchayat((prev) => ({
        ...prev,
        [key]: (prev[key] || []).map((item) => (item === oldValue ? newValue : item)),
      }))
    }
  }

  const handleCascadeTableRename = (
    row: CascadeManageRow,
    scope?: { district: string; taluk?: string; panchayat?: string }
  ) => {
    if (scope) {
      setCascadeScope({
        district: scope.district,
        taluk: scope.taluk ?? '',
        panchayat: scope.panchayat ?? '',
      })
    }
    const label = row.level === 'village' ? 'Village' : row.level.charAt(0).toUpperCase() + row.level.slice(1)
    openTextDialog({
      title: `Rename ${label}`,
      label: `${label} Name`,
      confirmText: `Rename ${label}`,
      action: 'rename-cascade',
      value: row.value,
      row,
    })
  }

  const handleCascadeTableDelete = (
    row: CascadeManageRow,
    scope?: { district: string; taluk?: string; panchayat?: string }
  ) => {
    if (scope) {
      setCascadeScope({
        district: scope.district,
        taluk: scope.taluk ?? '',
        panchayat: scope.panchayat ?? '',
      })
    }
    setCascadeDeleteDialog({ open: true, row })
  }

  const selectCascadeDistrict = (district: string) => {
    setCascadeScope({ district, taluk: '', panchayat: '' })
  }

  const selectCascadeTaluk = (taluk: string) => {
    setCascadeScope((prev) => ({ ...prev, taluk, panchayat: '' }))
  }

  const selectCascadePanchayat = (panchayat: string) => {
    setCascadeScope((prev) => ({ ...prev, panchayat }))
  }

  const submitTextDialog = async () => {
    const value = textDialog.value.trim()
    if (!value) return

    if (textDialog.action === 'add-district') {
      setCustomDistricts((prev) => uniqueSorted([...prev, value]))
      setCreateForm((prev) => ({ ...prev, district: value, taluk: '', panchayat: '', village_name: '' }))
      setTextDialog((prev) => ({ ...prev, open: false }))
      return
    }

    if (textDialog.action === 'add-taluk') {
      if (!createForm.district) return
      setCustomTaluksByDistrict((prev) => ({
        ...prev,
        [createForm.district]: uniqueSorted([...(prev[createForm.district] ?? []), value]),
      }))
      setCreateForm((prev) => ({ ...prev, taluk: value, panchayat: '', village_name: '' }))
      setTextDialog((prev) => ({ ...prev, open: false }))
      return
    }

    if (textDialog.action === 'add-panchayat') {
      if (!createForm.district || !createForm.taluk) return
      const key = `${createForm.district}::${createForm.taluk}`
      setCustomPanchayatsByTaluk((prev) => ({
        ...prev,
        [key]: uniqueSorted([...(prev[key] ?? []), value]),
      }))
      setCreateForm((prev) => ({ ...prev, panchayat: value, village_name: '' }))
      setTextDialog((prev) => ({ ...prev, open: false }))
      return
    }

    if (textDialog.action === 'add-village') {
      if (!createForm.district || !createForm.taluk || !createForm.panchayat) return
      const key = `${createForm.district}::${createForm.taluk}::${createForm.panchayat}`
      setCustomVillagesByPanchayat((prev) => ({
        ...prev,
        [key]: uniqueSorted([...(prev[key] ?? []), value]),
      }))
      setCreateForm((prev) => ({ ...prev, village_name: value }))
      setTextDialog((prev) => ({ ...prev, open: false }))
      return
    }

    if (textDialog.action === 'rename-cascade' && textDialog.row && sessionToken) {
      const row = textDialog.row
      if (value === row.value) {
        setTextDialog((prev) => ({ ...prev, open: false }))
        return
      }
      const label = row.level === 'village' ? 'Village' : row.level.charAt(0).toUpperCase() + row.level.slice(1)

      setCascadeLoading(true)
      setError('')
      setSuccess('')
      try {
        const res = await fetch('/api/admin/centres/cascade-update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            level: row.level,
            oldValue: row.value,
            newValue: value,
            district: cascadeScope.district,
            taluk: cascadeScope.taluk,
            panchayat: cascadeScope.panchayat,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || `Failed to rename ${label}`)

        applyCascadeRenameLocally(row.level, row.value, value, {
          district: cascadeScope.district,
          taluk: cascadeScope.taluk,
          panchayat: cascadeScope.panchayat,
        })

        setSuccess(`${label} updated successfully${json.updatedCount ? ` (${json.updatedCount} rows)` : ''}`)
        setTextDialog((prev) => ({ ...prev, open: false }))
        await loadCentres(sessionToken)
      } catch (err: any) {
        setError(err.message || String(err))
      } finally {
        setCascadeLoading(false)
      }
    }
  }

  const confirmCascadeDelete = async () => {
    if (!sessionToken || !cascadeDeleteDialog.row) return
    const row = cascadeDeleteDialog.row
    const label = row.level === 'village' ? 'Village' : row.level.charAt(0).toUpperCase() + row.level.slice(1)

    setCascadeLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/centres/cascade-update', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          level: row.level,
          oldValue: row.value,
          district: cascadeScope.district,
          taluk: cascadeScope.taluk,
          panchayat: cascadeScope.panchayat,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Failed to delete ${label}`)

      removeCascadeValueLocally(row.level, row.value, {
        district: cascadeScope.district,
        taluk: cascadeScope.taluk,
        panchayat: cascadeScope.panchayat,
      })

      setSuccess(`${label} deleted successfully${json.updatedCount ? ` (${json.updatedCount} rows affected)` : ''}`)
      setCascadeDeleteDialog({ open: false })
      await loadCentres(sessionToken)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setCascadeLoading(false)
    }
  }

  const overviewStats = useMemo(() => {
    const districtCount = hierarchy.districts.size
    const talukCount = Object.values(hierarchy.taluksByDistrict).reduce((acc, set) => acc + set.size, 0)
    const panchayatCount = Object.values(hierarchy.panchayatsByTaluk).reduce((acc, set) => acc + set.size, 0)
    const villageCount = Object.values(hierarchy.villagesByPanchayat).reduce((acc, set) => acc + set.size, 0)

    return {
      centreCount: centres.length,
      districtCount,
      talukCount,
      panchayatCount,
      villageCount,
    }
  }, [centres.length, hierarchy])

  const nextEacNo = useMemo(() => {
    const highestEac = centres.reduce((max, centre) => {
      const parsed = Number(String(centre.eac_no ?? '').trim())
      return Number.isFinite(parsed) && parsed > max ? parsed : max
    }, 0)

    return String(highestEac + 1)
  }, [centres])

  const sortedCentres = useMemo(() => {
    const search = tableSearch.trim().toLowerCase()
    const rows = !search
      ? [...centres]
      : centres.filter((centre) => {
          const haystack = [
            centre.eac_no,
            centre.village_name,
            centre.district,
            centre.taluk,
            centre.panchayat,
            centre.cbv_name,
            centre.in_charge,
          ]
            .map((value) => String(value ?? '').toLowerCase())
            .join(' ')

          return haystack.includes(search)
        })

    rows.sort((a, b) => {
      const aValue = a[sortColumn as keyof CentreRecord]
      const bValue = b[sortColumn as keyof CentreRecord]

      if (aValue === null || aValue === undefined || aValue === '') return 1
      if (bValue === null || bValue === undefined || bValue === '') return -1

      if (sortColumn === 'eac_no') {
        const left = Number(aValue)
        const right = Number(bValue)
        if (left < right) return sortDirection === 'asc' ? -1 : 1
        if (left > right) return sortDirection === 'asc' ? 1 : -1
        return 0
      }

      const left = String(aValue).toLowerCase()
      const right = String(bValue).toLowerCase()
      if (left < right) return sortDirection === 'asc' ? -1 : 1
      if (left > right) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return rows
  }, [centres, sortColumn, sortDirection, tableSearch])

  const toggleSort = (column: SortableColumn) => {
    if (nonSortableColumns.has(column)) return

    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortColumn(column)
    setSortDirection('asc')
  }

  const loadCentres = async (token: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/list-centres', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load centres')
      setCentres(json.centres || [])
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token || null
      if (!token) {
        setError('Not signed in')
        setLoading(false)
        return
      }
      setSessionToken(token)
      await loadCentres(token)
    }

    if (isAuthorized) {
      init()
    }
  }, [isAuthorized])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionToken) return

    const eacNo = createForm.eac_no.trim() || nextEacNo
    const duplicateEac = centres.some((centre) => String(centre.eac_no).trim() === eacNo)
    if (duplicateEac) {
      setError('This EAC No already exists. Please choose a different number.')
      return
    }

    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/centres/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ ...createForm, eac_no: eacNo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create centre')

      setCreateForm(emptyForm)
      setShowCreateForm(false)
      setSuccess('Centre created successfully!')
      await loadCentres(sessionToken)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setActionLoading(false)
    }
  }

  const openEditModal = (centre: CentreRecord) => {
    setError('')
    setEditCentre(centre)
    setEditForm({
      eac_no: String(centre.eac_no || ''),
      village_name: centre.village_name || '',
      district: centre.district || '',
      taluk: centre.taluk || '',
      panchayat: centre.panchayat || '',
      start_date: centre.start_date || '',
      end_date: centre.end_date || '',
      cbv_name: centre.cbv_name || '',
      in_charge: centre.in_charge || '',
      panchayat_member: centre.panchayat_member || '',
      head_master: centre.head_master || '',
      anganvadi: centre.anganvadi || '',
      asha_worker: centre.asha_worker || '',
      head_master_mobile: centre.head_master_mobile || '',
      in_charge_mobile: centre.in_charge_mobile || '',
      cbv_mobile: centre.cbv_mobile || '',
      panchayat_member_mobile: centre.panchayat_member_mobile || '',
      anganvadi_mobile: centre.anganvadi_mobile || '',
      asha_worker_mobile: centre.asha_worker_mobile || '',
      cbv_email: centre.cbv_email || '',
    })
  }

  const handleUpdate = async () => {
    if (!sessionToken || !editCentre) return

    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/centres/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ id: editCentre.id, ...editForm }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update centre')

      setEditCentre(null)
      setSuccess('Centre updated successfully!')
      await loadCentres(sessionToken)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!sessionToken || !deleteCentre) return

    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/centres/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ id: deleteCentre.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete centre')

      setDeleteCentre(null)
      setSuccess('Centre deleted successfully!')
      await loadCentres(sessionToken)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setActionLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const roleInfo = ROLE_CONFIG.find(r => r.value === 'admin')!

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar
        username={profile!.username}
        role="admin"
        roleLabel={roleInfo.label}
        roleColor={roleInfo.color}
      />
      <Sidebar role="admin" />

      <PageContainer>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Centre Management</h1>
              <p className="mt-1 text-slate-600">Create, edit, and delete centre records.</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
          </div>

          {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
          {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Building2 className="w-3.5 h-3.5" />
                Total Centres
              </div>
              <p className="text-xl font-semibold text-slate-900">{overviewStats.centreCount}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <MapPin className="w-3.5 h-3.5" />
                Districts
              </div>
              <p className="text-xl font-semibold text-slate-900">{overviewStats.districtCount}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Landmark className="w-3.5 h-3.5" />
                Taluks
              </div>
              <p className="text-xl font-semibold text-slate-900">{overviewStats.talukCount}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Map className="w-3.5 h-3.5" />
                Panchayats / Villages
              </div>
              <p className="text-xl font-semibold text-slate-900">
                {overviewStats.panchayatCount} / {overviewStats.villageCount}
              </p>
            </div>
          </div>

          <section className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCreateForm((prev) => !prev)}
                className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">Create Centre</p>
                  <p className="text-xs text-slate-500">Add a new centre with editable cascade data</p>
                </div>
                <span className="text-xs font-medium text-blue-700 rounded-full bg-blue-50 px-3 py-1">
                  {showCreateForm ? 'Hide' : 'Open'}
                </span>
              </button>

              {showCreateForm && (
                <div className="border-t border-slate-200 p-4 md:p-5">
                  <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3 [&_input]:py-1.5">
                    <div className="md:col-span-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                      Cascade options are loaded from existing centre_data rows. Use +Add new to add values for this form, then save the centre to persist them.
                    </div>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">EAC No</span>
                      <input
                        type="number"
                        value={createForm.eac_no || nextEacNo}
                        onChange={e => setCreateForm({ ...createForm, eac_no: e.target.value })}
                        inputMode="numeric"
                        min="1"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <span className="text-xs text-slate-500">Suggested next EAC No: {nextEacNo}</span>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">District</span>
                      <select
                        value={createForm.district}
                        onChange={e =>
                          setCreateForm({ ...createForm, district: e.target.value, taluk: '', panchayat: '', village_name: '' })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select District</option>
                        {districtOptions.map((district) => (
                          <option key={district} value={district}>
                            {district}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={addDistrict} className="text-xs font-medium text-blue-700 hover:text-blue-800 text-left">
                        + Add new District
                      </button>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Taluk</span>
                      <select
                        value={createForm.taluk}
                        onChange={e => setCreateForm({ ...createForm, taluk: e.target.value, panchayat: '', village_name: '' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!createForm.district}
                        required
                      >
                        <option value="">Select Taluk</option>
                        {talukOptions.map((taluk) => (
                          <option key={taluk} value={taluk}>
                            {taluk}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={addTaluk} className="text-xs font-medium text-blue-700 hover:text-blue-800 text-left">
                        + Add new Taluk
                      </button>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Panchayat</span>
                      <select
                        value={createForm.panchayat}
                        onChange={e => setCreateForm({ ...createForm, panchayat: e.target.value, village_name: '' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!createForm.taluk}
                        required
                      >
                        <option value="">Select Panchayat</option>
                        {panchayatOptions.map((panchayat) => (
                          <option key={panchayat} value={panchayat}>
                            {panchayat}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={addPanchayat} className="text-xs font-medium text-blue-700 hover:text-blue-800 text-left">
                        + Add new Panchayat
                      </button>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Village Name</span>
                      <select
                        value={createForm.village_name}
                        onChange={e => setCreateForm({ ...createForm, village_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!createForm.panchayat}
                        required
                      >
                        <option value="">Select Village</option>
                        {villageOptions.map((village) => (
                          <option key={village} value={village}>
                            {village}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={addVillage} className="text-xs font-medium text-blue-700 hover:text-blue-800 text-left">
                        + Add new Village
                      </button>
                    </label>
                    <div className="md:col-span-3 border-t border-slate-200 pt-1" />
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Start Date</span>
                      <input
                        type="date"
                        value={createForm.start_date}
                        onChange={e => setCreateForm({ ...createForm, start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        aria-label="Start Date"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">End Date</span>
                      <input
                        type="date"
                        value={createForm.end_date}
                        onChange={e => setCreateForm({ ...createForm, end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        aria-label="End Date"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">CBV Name</span>
                      <input
                        type="text"
                        value={createForm.cbv_name}
                        onChange={e => setCreateForm({ ...createForm, cbv_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">In Charge</span>
                      <input
                        type="text"
                        value={createForm.in_charge}
                        onChange={e => setCreateForm({ ...createForm, in_charge: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Panchayat Member</span>
                      <input
                        type="text"
                        value={createForm.panchayat_member}
                        onChange={e => setCreateForm({ ...createForm, panchayat_member: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Head Master</span>
                      <input
                        type="text"
                        value={createForm.head_master}
                        onChange={e => setCreateForm({ ...createForm, head_master: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Anganvadi</span>
                      <input
                        type="text"
                        value={createForm.anganvadi}
                        onChange={e => setCreateForm({ ...createForm, anganvadi: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">ASHA Worker</span>
                      <input
                        type="text"
                        value={createForm.asha_worker}
                        onChange={e => setCreateForm({ ...createForm, asha_worker: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Head Master Mobile</span>
                      <input
                        type="text"
                        value={createForm.head_master_mobile}
                        onChange={e => setCreateForm({ ...createForm, head_master_mobile: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">In Charge Mobile</span>
                      <input
                        type="text"
                        value={createForm.in_charge_mobile}
                        onChange={e => setCreateForm({ ...createForm, in_charge_mobile: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">CBV Mobile</span>
                      <input
                        type="text"
                        value={createForm.cbv_mobile}
                        onChange={e => setCreateForm({ ...createForm, cbv_mobile: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Panchayat Member Mobile</span>
                      <input
                        type="text"
                        value={createForm.panchayat_member_mobile}
                        onChange={e => setCreateForm({ ...createForm, panchayat_member_mobile: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">Anganvadi Mobile</span>
                      <input
                        type="text"
                        value={createForm.anganvadi_mobile}
                        onChange={e => setCreateForm({ ...createForm, anganvadi_mobile: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">ASHA Worker Mobile</span>
                      <input
                        type="text"
                        value={createForm.asha_worker_mobile}
                        onChange={e => setCreateForm({ ...createForm, asha_worker_mobile: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-600">CBV Email</span>
                      <input
                        type="email"
                        value={createForm.cbv_email}
                        onChange={e => setCreateForm({ ...createForm, cbv_email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <div className="md:col-span-3 flex flex-col md:flex-row gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 md:min-w-[170px]"
                      >
                        {actionLoading ? 'Creating…' : 'Create Centre'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className="px-4 py-2 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 md:min-w-[130px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCascadeManager((prev) => !prev)}
                className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">Cascade Management</p>
                  <p className="text-xs text-slate-500">Rename or delete district, taluk, panchayat, and village values</p>
                </div>
                <span className="text-xs font-medium text-blue-700 rounded-full bg-blue-50 px-3 py-1">
                  {showCascadeManager ? 'Hide' : 'Open'}
                </span>
              </button>

              {showCascadeManager && (
                <div className="border-t border-slate-200 p-4 md:p-5 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 md:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Drill down by location</p>
                        <p className="text-xs text-slate-500">Click any row to drill down. Edit or delete directly from that row.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 border border-slate-200">
                          {cascadeScope.district || 'All Districts'}
                        </span>
                        {cascadeScope.taluk && (
                          <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 border border-slate-200">
                            {cascadeScope.taluk}
                          </span>
                        )}
                        {cascadeScope.panchayat && (
                          <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 border border-slate-200">
                            {cascadeScope.panchayat}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCascadeScope({ district: '', taluk: '', panchayat: '' })}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-100"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {districtOptions.length === 0 ? (
                        <p className="text-sm text-slate-500">No districts available.</p>
                      ) : (
                        districtOptions.map((district) => {
                          const districtTaluks = uniqueSorted([
                            ...Array.from(hierarchy.taluksByDistrict[district] ?? []),
                            ...(customTaluksByDistrict[district] ?? []),
                          ])
                          const districtOpen = cascadeScope.district === district
                          const districtAffected = centres.filter(
                            (centre) => String(centre.district ?? '').trim() === district
                          ).length
                          return (
                            <div key={district} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                              <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => selectCascadeDistrict(district)}
                                  className={`text-left min-w-0 ${districtOpen ? 'text-blue-700' : 'text-slate-900'} hover:text-blue-700`}
                                >
                                  <span className="font-medium">{district}</span>
                                </button>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs text-slate-500">{districtTaluks.length} taluk(s)</span>
                                  <span className="text-xs text-slate-500">{districtAffected} records</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCascadeTableRename(
                                        { level: 'district', value: district, parent: '-', affected: districtAffected },
                                        { district, taluk: '', panchayat: '' }
                                      )
                                    }
                                    className="text-xs font-medium text-blue-700 hover:text-blue-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCascadeTableDelete(
                                        { level: 'district', value: district, parent: '-', affected: districtAffected },
                                        { district, taluk: '', panchayat: '' }
                                      )
                                    }
                                    className="text-xs font-medium text-red-600 hover:text-red-700"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {districtOpen && (
                                <div className="border-t border-slate-200 px-3 py-2.5 bg-slate-50/70 space-y-2">
                                  {districtTaluks.length === 0 ? (
                                    <p className="text-sm text-slate-500">No taluks available.</p>
                                  ) : (
                                    districtTaluks.map((taluk) => {
                                      const talukKey = `${district}::${taluk}`
                                      const talukPanchayats = uniqueSorted([
                                        ...Array.from(hierarchy.panchayatsByTaluk[talukKey] ?? []),
                                        ...(customPanchayatsByTaluk[talukKey] ?? []),
                                      ])
                                      const talukOpen = districtOpen && cascadeScope.taluk === taluk
                                      const talukAffected = centres.filter(
                                        (centre) =>
                                          String(centre.district ?? '').trim() === district &&
                                          String(centre.taluk ?? '').trim() === taluk
                                      ).length

                                      return (
                                        <div key={taluk} className="ml-4 border-l border-slate-300 pl-3">
                                          <div className="py-2 flex items-center justify-between gap-3">
                                            <button
                                              type="button"
                                              onClick={() => selectCascadeTaluk(taluk)}
                                              className={`text-left min-w-0 ${talukOpen ? 'text-blue-700' : 'text-slate-900'} hover:text-blue-700`}
                                            >
                                              <span className="font-medium">{taluk}</span>
                                            </button>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="text-xs text-slate-500">{talukPanchayats.length} panchayat(s)</span>
                                              <span className="text-xs text-slate-500">{talukAffected} records</span>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleCascadeTableRename(
                                                    { level: 'taluk', value: taluk, parent: district, affected: talukAffected },
                                                    { district, taluk, panchayat: '' }
                                                  )
                                                }
                                                className="text-xs font-medium text-blue-700 hover:text-blue-800"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleCascadeTableDelete(
                                                    { level: 'taluk', value: taluk, parent: district, affected: talukAffected },
                                                    { district, taluk, panchayat: '' }
                                                  )
                                                }
                                                className="text-xs font-medium text-red-600 hover:text-red-700"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                          {talukOpen && (
                                            <div className="ml-4 border-l border-slate-300 pl-3 space-y-2 pb-2">
                                              {talukPanchayats.length === 0 ? (
                                                <p className="text-sm text-slate-500">No panchayats available.</p>
                                              ) : (
                                                talukPanchayats.map((panchayat) => {
                                                  const panchayatKey = `${district}::${taluk}::${panchayat}`
                                                  const villages = uniqueSorted([
                                                    ...Array.from(hierarchy.villagesByPanchayat[panchayatKey] ?? []),
                                                    ...(customVillagesByPanchayat[panchayatKey] ?? []),
                                                  ])
                                                  const panchayatOpen = talukOpen && cascadeScope.panchayat === panchayat
                                                  const panchayatAffected = centres.filter(
                                                    (centre) =>
                                                      String(centre.district ?? '').trim() === district &&
                                                      String(centre.taluk ?? '').trim() === taluk &&
                                                      String(centre.panchayat ?? '').trim() === panchayat
                                                  ).length

                                                  return (
                                                    <div key={panchayat} className="py-2">
                                                      <div className="flex items-center justify-between gap-3">
                                                        <button
                                                          type="button"
                                                          onClick={() => selectCascadePanchayat(panchayat)}
                                                          className={`text-left min-w-0 ${panchayatOpen ? 'text-blue-700' : 'text-slate-900'} hover:text-blue-700`}
                                                        >
                                                          <span className="font-medium">{panchayat}</span>
                                                        </button>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                          <span className="text-xs text-slate-500">{villages.length} village(s)</span>
                                                          <span className="text-xs text-slate-500">{panchayatAffected} records</span>
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              handleCascadeTableRename(
                                                                {
                                                                  level: 'panchayat',
                                                                  value: panchayat,
                                                                  parent: `${district} / ${taluk}`,
                                                                  affected: panchayatAffected,
                                                                },
                                                                { district, taluk, panchayat }
                                                              )
                                                            }
                                                            className="text-xs font-medium text-blue-700 hover:text-blue-800"
                                                          >
                                                            Edit
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              handleCascadeTableDelete(
                                                                {
                                                                  level: 'panchayat',
                                                                  value: panchayat,
                                                                  parent: `${district} / ${taluk}`,
                                                                  affected: panchayatAffected,
                                                                },
                                                                { district, taluk, panchayat }
                                                              )
                                                            }
                                                            className="text-xs font-medium text-red-600 hover:text-red-700"
                                                          >
                                                            Delete
                                                          </button>
                                                        </div>
                                                      </div>
                                                      {panchayatOpen && (
                                                        <div className="ml-4 border-l border-slate-300 pl-3 mt-2 space-y-1">
                                                          {villages.length === 0 ? (
                                                            <p className="text-sm text-slate-500">No villages available.</p>
                                                          ) : (
                                                            <ul className="space-y-1">
                                                              {villages.map((village) => (
                                                                <li key={village} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 border border-slate-200">
                                                                  <span className="text-sm text-slate-700">{village}</span>
                                                                  <div className="flex items-center gap-2">
                                                                    <button
                                                                      type="button"
                                                                      onClick={() =>
                                                                        handleCascadeTableRename(
                                                                          {
                                                                            level: 'village',
                                                                            value: village,
                                                                            parent: `${district} / ${taluk} / ${panchayat}`,
                                                                            affected: centres.filter(
                                                                              (centre) =>
                                                                                String(centre.district ?? '').trim() === district &&
                                                                                String(centre.taluk ?? '').trim() === taluk &&
                                                                                String(centre.panchayat ?? '').trim() === panchayat &&
                                                                                String(centre.village_name ?? '').trim() === village
                                                                            ).length,
                                                                          },
                                                                          { district, taluk, panchayat }
                                                                        )
                                                                      }
                                                                      className="text-xs font-medium text-blue-700 hover:text-blue-800"
                                                                    >
                                                                      Edit
                                                                    </button>
                                                                    <button
                                                                      type="button"
                                                                      onClick={() =>
                                                                        handleCascadeTableDelete(
                                                                          {
                                                                            level: 'village',
                                                                            value: village,
                                                                            parent: `${district} / ${taluk} / ${panchayat}`,
                                                                            affected: centres.filter(
                                                                              (centre) =>
                                                                                String(centre.district ?? '').trim() === district &&
                                                                                String(centre.taluk ?? '').trim() === taluk &&
                                                                                String(centre.panchayat ?? '').trim() === panchayat &&
                                                                                String(centre.village_name ?? '').trim() === village
                                                                            ).length,
                                                                          },
                                                                          { district, taluk, panchayat }
                                                                        )
                                                                      }
                                                                      className="text-xs font-medium text-red-600 hover:text-red-700"
                                                                    >
                                                                      Delete
                                                                    </button>
                                                                  </div>
                                                                </li>
                                                              ))}
                                                            </ul>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  )
                                                })
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCentreRecords((prev) => !prev)}
                className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">Centre Records</p>
                  <p className="text-xs text-slate-500">Search, sort, edit, and delete saved centres</p>
                </div>
                <span className="text-xs font-medium text-blue-700 rounded-full bg-blue-50 px-3 py-1">
                  {showCentreRecords ? 'Hide' : 'Open'}
                </span>
              </button>

              {showCentreRecords && (
                <div className="border-t border-slate-200">
                  <div className="p-3 md:p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">{sortedCentres.length} result(s)</p>
                    </div>
                    <label className="relative w-full md:w-[360px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="Search by EAC, village, district, taluk, panchayat, CBV, in-charge"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                  {loading ? (
                    <div className="p-12 text-center">
                      <LoadingSpinner size="lg" />
                    </div>
                  ) : centres.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">No centres found</div>
                  ) : (
                    <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
                      <table className="min-w-[2600px] w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-3 text-left font-semibold text-slate-900">Actions</th>
                            {tableColumns.map((column) => (
                              <th key={column.key} className="px-6 py-3 text-left font-semibold text-slate-900 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span>{column.label}</span>
                                  {!nonSortableColumns.has(column.key) && (
                                    <button
                                      type="button"
                                      onClick={() => toggleSort(column.key)}
                                      className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                      {sortColumn === column.key ? (sortDirection === 'asc' ? 'ASC' : 'DESC') : 'Sort'}
                                    </button>
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedCentres.map((centre) => (
                            <tr key={centre.id} className="border-b border-slate-200 odd:bg-white even:bg-slate-50/30 hover:bg-blue-50/40">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => openEditModal(centre)}
                                    className="text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setDeleteCentre(centre)}
                                    className="text-red-600 hover:text-red-700 font-medium"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                              {tableColumns.map((column) => {
                                const value = centre[column.key as keyof CentreRecord]
                                return (
                                  <td
                                    key={`${centre.id}-${column.key}`}
                                    className={`px-6 py-4 whitespace-nowrap ${column.key === 'eac_no' ? 'text-slate-900 font-medium' : 'text-slate-700'}`}
                                  >
                                    {value || '-'}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </PageContainer>

      {textDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void submitTextDialog()
              }}
              className="space-y-4 p-5"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{textDialog.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{textDialog.label}</p>
              </div>
              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-600">{textDialog.label}</span>
                <input
                  autoFocus
                  type="text"
                  value={textDialog.value}
                  onChange={(e) => setTextDialog((prev) => ({ ...prev, value: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={textDialog.label}
                />
              </label>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setTextDialog((prev) => ({ ...prev, open: false }))}
                  className="flex-1 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cascadeLoading}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {textDialog.confirmText}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cascadeDeleteDialog.open && cascadeDeleteDialog.row && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Delete {cascadeDeleteDialog.row.level}</h3>
              <p className="text-sm text-slate-600 mt-1">
                Remove <span className="font-semibold">{cascadeDeleteDialog.row.value}</span> from the current scope. This will clear the value from matching centre rows.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setCascadeDeleteDialog({ open: false })}
                className="flex-1 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCascadeDelete}
                disabled={cascadeLoading}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cascadeLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editCentre && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Edit Centre</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
              <input
                type="number"
                placeholder="EAC No"
                value={editForm.eac_no}
                onChange={e => setEditForm({ ...editForm, eac_no: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Village Name"
                value={editForm.village_name}
                onChange={e => setEditForm({ ...editForm, village_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="District"
                value={editForm.district}
                onChange={e => setEditForm({ ...editForm, district: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Taluk"
                value={editForm.taluk}
                onChange={e => setEditForm({ ...editForm, taluk: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Panchayat"
                value={editForm.panchayat}
                onChange={e => setEditForm({ ...editForm, panchayat: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="date"
                placeholder="Start Date"
                value={editForm.start_date}
                onChange={e => setEditForm({ ...editForm, start_date: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                placeholder="End Date"
                value={editForm.end_date}
                onChange={e => setEditForm({ ...editForm, end_date: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="CBV Name"
                value={editForm.cbv_name}
                onChange={e => setEditForm({ ...editForm, cbv_name: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="In Charge"
                value={editForm.in_charge}
                onChange={e => setEditForm({ ...editForm, in_charge: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Panchayat Member"
                value={editForm.panchayat_member}
                onChange={e => setEditForm({ ...editForm, panchayat_member: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Head Master"
                value={editForm.head_master}
                onChange={e => setEditForm({ ...editForm, head_master: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Anganvadi"
                value={editForm.anganvadi}
                onChange={e => setEditForm({ ...editForm, anganvadi: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="ASHA Worker"
                value={editForm.asha_worker}
                onChange={e => setEditForm({ ...editForm, asha_worker: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Head Master Mobile"
                value={editForm.head_master_mobile}
                onChange={e => setEditForm({ ...editForm, head_master_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="In Charge Mobile"
                value={editForm.in_charge_mobile}
                onChange={e => setEditForm({ ...editForm, in_charge_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="CBV Mobile"
                value={editForm.cbv_mobile}
                onChange={e => setEditForm({ ...editForm, cbv_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Panchayat Member Mobile"
                value={editForm.panchayat_member_mobile}
                onChange={e => setEditForm({ ...editForm, panchayat_member_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Anganvadi Mobile"
                value={editForm.anganvadi_mobile}
                onChange={e => setEditForm({ ...editForm, anganvadi_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="ASHA Worker Mobile"
                value={editForm.asha_worker_mobile}
                onChange={e => setEditForm({ ...editForm, asha_worker_mobile: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="CBV Email"
                value={editForm.cbv_email}
                onChange={e => setEditForm({ ...editForm, cbv_email: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditCentre(null)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCentre && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Delete Centre</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete centre <span className="font-semibold">EAC {deleteCentre.eac_no}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteCentre(null)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
