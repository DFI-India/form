'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'
import type { UserProfile, AuthSession } from './types'

/**
 * useAuth: Get current user session and profile
 */
export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const getAuth = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()

        if (!isMounted) return
        if (sessionError) throw sessionError

        if (!data.session) {
          setSession(null)
          setProfile(null)
          setLoading(false)
          return
        }

        setSession({
          user: data.session.user,
          access_token: data.session.access_token,
        })

        // Get user profile with better error handling
        console.log('Fetching profile for user:', data.session.user.id)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single()

        if (!isMounted) return

        if (profileError) {
          console.error('Profile fetch error:', profileError.message)
          setError(profileError.message || 'Failed to load profile')
          setLoading(false)
          return
        }

        if (profileData) {
          console.log('Profile loaded:', profileData.role)
          setProfile(profileData as UserProfile)
          setError(null)
        } else {
          console.error('No profile data returned')
          setError('Profile not found')
        }
        setLoading(false)
      } catch (err: any) {
        if (!isMounted) return
        console.error('Auth error:', err.message || err)
        setError(err.message || 'Failed to load auth')
        setLoading(false)
      }
    }

    getAuth()

    return () => {
      isMounted = false
    }
  }, [])

  return { session, profile, loading, error }
}

/**
 * useRequireAuth: Ensure user is authenticated, redirect if not
 */
export function useRequireAuth() {
  const router = useRouter()
  const { session, profile, loading, error } = useAuth()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/sign-in')
    }
  }, [session, loading, router])

  return { session, profile, loading, error, isAuthenticated: !!session }
}

/**
 * useRequireRole: Ensure user has specific role, redirect if not
 */
export function useRequireRole(allowedRoles: string[]) {
  const router = useRouter()
  const { session, profile, loading } = useRequireAuth()

  useEffect(() => {
    if (!loading && profile && !allowedRoles.includes(profile.role || '')) {
      router.replace('/unauthorized')
    }
  }, [profile, loading, router, allowedRoles.join(',')])

  return { profile, loading, isAuthorized: profile ? allowedRoles.includes(profile.role || '') : false }
}

/**
 * useSignOut: Sign out user
 */
export function useSignOut() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signOut = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError

      router.replace('/sign-in')
    } catch (err: any) {
      setError(err.message || 'Failed to sign out')
    } finally {
      setLoading(false)
    }
  }, [router])

  return { signOut, loading, error }
}

/**
 * useFetch: Generic fetch hook with auth token
 */
export function useFetch<T = any>(url: string | null, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState<string | null>(null)
  const { session } = useAuth()

  useEffect(() => {
    if (!url || !session?.access_token) return

    const fetch_ = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            ...options?.headers,
          },
        })

        if (!response.ok) {
          const json = await response.json()
          throw new Error(json.error || `HTTP ${response.status}`)
        }

        const json = await response.json()
        setData(json)
      } catch (err: any) {
        setError(err.message || 'Failed to fetch')
      } finally {
        setLoading(false)
      }
    }

    fetch_()
  }, [url, session?.access_token, options])

  return { data, loading, error }
}

/**
 * useApiMutation: Generic mutation hook for POST/PUT/DELETE
 */
export function useApiMutation<TRequest = any, TResponse = any>() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { session } = useAuth()

  const mutate = useCallback(
    async (url: string, method: 'POST' | 'PUT' | 'DELETE', body?: TRequest): Promise<TResponse | null> => {
      setLoading(true)
      setError(null)

      if (!session?.access_token) {
        setError('Not authenticated')
        setLoading(false)
        return null
      }

      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        })

        const json = await response.json()

        if (!response.ok) {
          throw new Error(json.error || `HTTP ${response.status}`)
        }

        return json
      } catch (err: any) {
        const errorMessage = err.message || 'Request failed'
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [session?.access_token]
  )

  return { mutate, loading, error }
}
