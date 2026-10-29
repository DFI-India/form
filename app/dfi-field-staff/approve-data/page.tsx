'use client'

import ApprovalsScreen from '../../components/ApprovalsScreen'

/**
 * Field staff verify what volunteers submit; approval is the next step and
 * belongs to DFI staff. The list is already limited to this person's centre by
 * the API, which reads their assigned EAC.
 */
export default function FieldStaffVerifyPage() {
  return (
    <ApprovalsScreen
      role="dfi_field_staff"
      active="/dfi-field-staff/approve-data"
      breadcrumb={['Field', 'Verify data']}
      stages={['Pending']}
    />
  )
}
