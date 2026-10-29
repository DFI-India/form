'use client'

import ActivityScreen from '../../components/ActivityScreen'

export default function FieldStaffHistoryPage() {
  return (
    <ActivityScreen
      role="dfi_field_staff"
      active="/dfi-field-staff/history"
      breadcrumb={['Field', 'History']}
      verb="verified"
    />
  )
}
