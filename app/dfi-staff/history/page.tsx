'use client'

import ActivityScreen from '../../components/ActivityScreen'

export default function StaffHistoryPage() {
  return (
    <ActivityScreen
      role="dfi_staff"
      active="/dfi-staff/history"
      breadcrumb={['Review', 'History']}
      verb="decided"
    />
  )
}
