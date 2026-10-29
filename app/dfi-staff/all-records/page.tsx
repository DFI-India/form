'use client'

import RecordsScreen from '../../components/RecordsScreen'

/** Same screen as the admin one, without the delete control. */
export default function StaffAllRecordsPage() {
  return (
    <RecordsScreen
      role="dfi_staff"
      active="/dfi-staff/all-records"
      breadcrumb={['Review', 'All records']}
    />
  )
}
