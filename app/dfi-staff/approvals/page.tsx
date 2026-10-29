'use client'

import ApprovalsScreen from '../../components/ApprovalsScreen'

/**
 * DFI staff sign off what field staff have verified. The endpoints only accept
 * that transition from this role, so the unverified queue is not shown: a
 * button that would always be refused is worse than no button.
 */
export default function StaffApprovalsPage() {
  return (
    <ApprovalsScreen
      role="dfi_staff"
      active="/dfi-staff/approvals"
      breadcrumb={['Review', 'Approvals']}
      stages={['Verified']}
    />
  )
}
