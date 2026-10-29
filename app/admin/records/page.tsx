'use client'

import RecordsScreen from '../../components/RecordsScreen'

export default function AdminRecordsPage() {
  return (
    <RecordsScreen
      role="admin"
      active="/admin/records"
      breadcrumb={['Manage records', 'All records']}
      canDelete
    />
  )
}
