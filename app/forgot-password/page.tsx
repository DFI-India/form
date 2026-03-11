'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { Alert } from '../components/UI'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const redirectTo = `${window.location.origin}/reset-password`

            const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo,
            })

            if (resetError) {
                setError(resetError.message)
                return
            }

            // Do not reveal whether the account exists.
            setSuccess('If an account exists for this email, a password reset link has been sent.')
            setEmail('')
        } catch (err: any) {
            setError(err?.message || 'Unable to send password reset email.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-semibold text-slate-900">Forgot Password</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Enter your email and we will send a reset link.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="email"
                            className="mb-1 block text-sm font-medium text-slate-700"
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                if (error) setError('')
                                if (success) setSuccess('')
                            }}
                            autoComplete="email"
                            required
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    {error && <Alert type="error" message={error} />}
                    {success && <Alert type="success" message={success} />}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                        {loading ? 'Sending link…' : 'Send reset link'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-600">
                    <Link href="/sign-in" className="font-medium text-blue-700 underline-offset-2 hover:underline">
                        Back to sign in
                    </Link>
                </p>
            </div>
        </main>
    )
}
