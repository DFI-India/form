'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function SignInPage() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const normalizedUsername = useMemo(
    () => username.trim().toLowerCase(),
    [username]
  )

  // 🔁 Redirect user based on role
  const redirectByRole = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) return

    switch (profile.role) {
      case 'field_volunteer':
        router.replace('/field-volunteer/child-data-entry')
        break
      case 'dfi_field_staff':
        router.replace('/dfi-field-staff/approve-data')
        break

      case 'admin':
        router.replace('/EAC_details')
        break

      default:
        router.replace('/unauthorized')
    }
  }

  // ✅ Handle existing session
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()

      if (data.session) {
        await redirectByRole()
        return
      }

      // No session → allow sign-in page to render
      setCheckingAuth(false)
    }

    checkSession()
  }, [])
  if (checkingAuth) {
    return null // or a spinner
  }

  // 🔐 Handle login
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: normalizedUsername,
          password,
        }),
      })

      const json = await res.json()
      console.log('SIGNIN API RESPONSE:', json)

      if (!res.ok) {
        setError(json.error || 'Sign in failed')
        setLoading(false)
        return
      }

      // Create Supabase session
      if (json.email) {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: json.email,
            password,
          })

        if (signInError) {
          setError(signInError.message)
          setLoading(false)
          return
        }
      }

      setLoading(false)
      await redirectByRole()
    } catch (err: any) {
      setError(err?.message || 'Unexpected error')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Admin Sign In
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
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Credentials are validated against the <code>profiles</code> table.
        </p>
      </div>
    </main>
  )
}
