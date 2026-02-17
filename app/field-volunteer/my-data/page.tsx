'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { Navbar, Sidebar, PageContainer } from '../../components/Navbar'
import { LoadingSpinner } from '../../components/UI'
import { ROLE_CONFIG } from '../../../lib/types'
import { useRequireRole } from '../../../lib/hooks'

export default function FieldVolunteerDataPage() {
    
    const router = useRouter()
    const { profile, loading: authLoading, isAuthorized } = useRequireRole(['field_volunteer'])

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

    const roleInfo = ROLE_CONFIG.find(r => r.value === 'field_volunteer')!

    return (
        <main className="min-h-screen bg-slate-50/50">
            <Navbar
            username={profile.username}
            role="field_volunteer"
            roleLabel={roleInfo.label}
            roleColor={roleInfo.color} />
            <Sidebar role="field_volunteer" />
            <PageContainer>
                <h1>Field Volunteer Data Page</h1>
            </PageContainer>
        </main>
    )
}