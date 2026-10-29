'use client'

import ApprovalsScreen from '../../components/ApprovalsScreen'

/** An admin is the final authority, so both stages are theirs to act on. */
export default function AdminApprovalsPage() {
  return (
    <ApprovalsScreen
      role="admin"
      active="/admin/approvals"
      breadcrumb={['Manage records', 'Approvals']}
      stages={['Verified', 'Pending']}
    />
  )
}
