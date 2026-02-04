'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { LoadingSpinner, Alert } from '../components/UI'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout

    const routeUser = async () => {
      try {
        // Get current session
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (!isMounted) return
        if (userError || !user) {
          console.log('No user found, redirecting to sign-in')
          router.replace('/sign-in')
          return
        }

        console.log('User ID:', user.id)

        // Get user profile with role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)

        if (!isMounted) return

        console.log('Profile query result:', { profile, profileError })

        if (profileError || !profile || profile.length === 0) {
          console.error('Profile error:', profileError)
          setError('Could not load user profile. Please try again.')
          setLoading(false)
          return
        }

        // Route based on role
        const roleRoutes: Record<string, string> = {
          field_volunteer: '/field-volunteer',
          dfi_field_staff: '/dfi-field-staff',
          dfi_staff: '/dfi-staff',
          admin: '/admin',
          tech_support: '/tech-support',
        }

        const userRole = profile[0]?.role || 'admin'
        const route = roleRoutes[userRole] || '/unauthorized'
        
        console.log('User role:', userRole, 'Routing to:', route)
        router.replace(route)
      } catch (err: any) {
        if (!isMounted) return
        console.error('Dashboard error:', err)
        setError(err.message || 'An error occurred')
        setLoading(false)
      }
    }

    routeUser()

    // Timeout after 5 seconds
    timeoutId = setTimeout(() => {
      if (isMounted) {
        console.error('Dashboard routing timeout')
        setError('Connection timeout. Please try again.')
        setLoading(false)
      }
    }, 5000)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <div className="max-w-md w-full">
          <Alert type="error" message={error} />
          <button
            onClick={() => window.location.href = '/sign-in'}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}
