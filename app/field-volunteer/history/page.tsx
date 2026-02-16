'use client'

import { useEffect, useState } from 'react'
import { useRequireRole } from '@/lib/hooks'
import { LoadingSpinner } from '../../components/UI'
import { ROLE_CONFIG } from '@/lib/types'

type HistoryRow = {
    id: string
    type: string
    created_at: string
    details: string
}

export default function ActivityHistoryPage() {
    const { profile, loading: authLoading, isAuthorized } =
        useRequireRole(['field_volunteer'])

    // =============================
    // STATE
    // =============================

    const [historyData, setHistoryData] = useState<HistoryRow[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    const [historyChildDateRange, setHistoryChildDateRange] = useState<
        [Date | null, Date | null]
    >([null, null])

    const [historyFamilyDateRange, setHistoryFamilyDateRange] = useState<
        [Date | null, Date | null]
    >([null, null])

    const [historySiblingDateRange, setHistorySiblingDateRange] = useState<
        [Date | null, Date | null]
    >([null, null])

    const [historyUniformDateRange, setHistoryUniformDateRange] = useState<
        [Date | null, Date | null]
    >([null, null])

    const [historyLeavingDateRange, setHistoryLeavingDateRange] = useState<
        [Date | null, Date | null]
    >([null, null])

    // =============================
    // DATA FETCHING
    // =============================

    const fetchPersonalHistory = async () => {
        if (!profile) return

        try {
            setLoadingHistory(true)

            // 🔁 Replace with your actual fetch logic
            const response = await fetch('/api/activity-history')
            const data = await response.json()

            setHistoryData(data || [])
        } catch (error) {
            console.error('Error fetching history:', error)
        } finally {
            setLoadingHistory(false)
        }
    }

    // =============================
    // EFFECTS
    // =============================

    useEffect(() => {
        if (isAuthorized) {
            fetchPersonalHistory()
        }
    }, [isAuthorized])

    useEffect(() => {
        if (!isAuthorized) return

        // Example: something dependent on authorization
        console.log('User authorized')
    }, [isAuthorized])

    useEffect(() => {
        // Example filter effect
        // Runs when any date range changes

        console.log('Date filters updated')

    }, [
        historyChildDateRange,
        historyFamilyDateRange,
        historySiblingDateRange,
        historyUniformDateRange,
        historyLeavingDateRange,
    ])

    // =============================
    // CONDITIONAL RETURNS (AFTER HOOKS)
    // =============================

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

    const roleInfo = ROLE_CONFIG.find(
        (role: typeof ROLE_CONFIG[0]) => role.value === 'field_volunteer'
    )

    // =============================
    // MAIN RENDER
    // =============================

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">
                Activity History
            </h1>

            {loadingHistory ? (
                <LoadingSpinner />
            ) : (
                <div className="space-y-4">
                    {historyData.length === 0 ? (
                        <p>No history found.</p>
                    ) : (
                        historyData.map((row) => (
                            <div
                                key={row.id}
                                className="border rounded p-4 shadow-sm"
                            >
                                <p className="font-medium">{row.type}</p>
                                <p className="text-sm text-gray-500">
                                    {new Date(row.created_at).toLocaleString()}
                                </p>
                                <p className="mt-2">{row.details}</p>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
