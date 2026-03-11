'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { Alert, LoadingSpinner } from '../components/UI'

export default function SignInPage() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [redirecting, setRedirecting] = useState(false)

  const normalizedUsername = useMemo(
    () => username.trim().toLowerCase(),
    [username]
  )

  // 🔁 Redirect user based on role
  const redirectByRole = async (routerInstance: any) => {
    try {
      console.log('redirectByRole called')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        console.log('No user found in redirectByRole')
        return
      }

      console.log('User found:', user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        return
      }

      if (!profile) {
        console.log('No profile found for user')
        return
      }

      console.log('Profile found, role:', profile.role)
      const redirectPath =
        profile.role === 'field_volunteer' ? '/field-volunteer' :
          profile.role === 'dfi_field_staff' ? '/dfi-field-staff' :
            profile.role === 'dfi_staff' ? '/dfi-staff' :
              profile.role === 'admin' ? '/admin' :
                profile.role === 'tech_support' ? '/tech-support' :
                  '/unauthorized'

      console.log('Navigating to:', redirectPath)
      routerInstance.replace(redirectPath)
    } catch (err: any) {
      console.error('Redirect error:', err)
    }
  }

  // ✅ Handle existing session
  useEffect(() => {
    let isMounted = true
    const checkSession = async () => {
      try {
        console.log('Checking for existing session...')
        const { data } = await supabase.auth.getSession()

        if (!isMounted) return

        if (data.session) {
          console.log('Existing session found, redirecting...')
          setRedirecting(true)
          await redirectByRole(router)
          return
        }

        // No session → allow sign-in page to render
        console.log('No session found, showing sign-in page')
        setCheckingAuth(false)
      } catch (err: any) {
        if (!isMounted) return
        console.error('Session check error:', err?.message || err)
        // If session check fails, still allow sign-in page to render
        setCheckingAuth(false)
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [router])
  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <LoadingSpinner size="lg" />
      </main>
    )
  }

  // 🔐 Handle login
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      console.log('Submitting sign-in form with username:', normalizedUsername)
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: normalizedUsername,
          password,
        }),
      })

      console.log('API Response status:', res.status, 'Content-Type:', res.headers.get('content-type'))

      if (!res.ok) {
        const text = await res.text()
        console.log('Error response text:', text)
        let json
        try {
          json = JSON.parse(text)
        } catch {
          json = { error: text || `HTTP ${res.status}` }
        }
        setError(json.error || `Sign in failed (${res.status})`)
        setLoading(false)
        return
      }

      const json = await res.json()
      console.log('SIGNIN API RESPONSE:', res.status, json)

      // Create Supabase session
      if (json.email) {
        try {
          console.log('Attempting Supabase login with email:', json.email)
          const { error: signInError } =
            await supabase.auth.signInWithPassword({
              email: json.email,
              password,
            })

          if (signInError) {
            console.error('Supabase sign-in error:', signInError)
            setError(signInError.message)
            setLoading(false)
            return
          }

          console.log('Supabase sign-in successful, waiting for session...')

          // Wait for session to be fully established
          await new Promise(resolve => setTimeout(resolve, 1000))

          console.log('Calling redirectByRole after login...')
          setRedirecting(true)
          // Now redirect based on role
          await redirectByRole(router)

          // Don't stop loading - let the page redirect
        } catch (supabaseErr: any) {
          console.error('Supabase auth error:', supabaseErr?.message || supabaseErr)
          setError('Authentication service error: ' + (supabaseErr?.message || 'Unknown error'))
          setLoading(false)
          return
        }
      }
    } catch (err: any) {
      console.error('Signin error:', err?.message || err)
      setError(err?.message || 'Unexpected error')
      setLoading(false)
    }
  }

  // Show loading spinner while redirecting
  if (redirecting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <LoadingSpinner size="lg" />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Sign In
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter credentials to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (error) setError('')
              }}
              autoComplete="username"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError('')
              }}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <Alert type="error" message={error} />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Credentials are validated against the <code>profiles</code> table.
        </p>
      </div>
    </main>
  )
}
