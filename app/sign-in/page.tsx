
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const USERNAME_EMAIL_MAP: Record<string, string> = {
  volunteer1: process.env.NEXT_PUBLIC_VOLUNTEER_EMAIL || 'volunteer1@example.com',
}

export default function SignInPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace('/')
      }
    }

    checkSession()
  }, [router])

  const normalizedUsername = useMemo(() => username.trim().toLowerCase(), [username])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    setError('')
    setLoading(true)

    const email = USERNAME_EMAIL_MAP[normalizedUsername]

    if (!email) {
      setError('Unknown username.')
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    router.replace('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Admin Sign In</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter the admin credentials to manage child registrations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                if (error) setError('')
              }}
              autoComplete="username"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (error) setError('')
              }}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          Create the volunteer account in Supabase Auth using the mapped email (default{' '}
          <code className="rounded bg-slate-100 px-1">volunteer1@example.com</code>). Update{' '}
          <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_VOLUNTEER_EMAIL</code> if you use a different email.
        </p>
      </div>
    </main>
  )
}