'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Alert, LoadingSpinner } from '../components/UI'

export default function ResetPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [checkingSession, setCheckingSession] = useState(true)
    const [readyForReset, setReadyForReset] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        const initializeRecoverySession = async () => {
            try {
                const hash = new URLSearchParams(window.location.hash.replace('#', ''))
                const accessToken = hash.get('access_token')
                const refreshToken = hash.get('refresh_token')

                if (accessToken && refreshToken) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    })

                    if (sessionError) {
                        setError('This reset link is invalid or expired. Request a new one.')
                        return
                    }
                }

                const {
                    data: { session },
                } = await supabase.auth.getSession()

                if (!session) {
                    setError('This reset link is invalid or expired. Request a new one.')
                    return
                }

                setReadyForReset(true)
            } catch {
                setError('Could not validate the reset link. Request a new one.')
            } finally {
                setCheckingSession(false)
            }
        }

        initializeRecoverySession()
    }, [])

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        setError('')
        setSuccess('')

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setLoading(true)

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password,
            })

            if (updateError) {
                setError(updateError.message)
                return
            }

            setSuccess('Your password has been updated. Redirecting to sign in...')
            setPassword('')
            setConfirmPassword('')

            setTimeout(() => {
                router.replace('/sign-in')
            }, 1400)
        } catch (err: any) {
            setError(err?.message || 'Unable to reset password.')
        } finally {
            setLoading(false)
        }
    }

    if (checkingSession) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-surface-hover">
                <LoadingSpinner size="lg" />
            </main>
        )
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-surface-hover px-4">
            <div className="w-full max-w-sm rounded-xl border border-rule bg-surface p-8 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-semibold text-ink">Reset Password</h1>
                    <p className="mt-2 text-sm text-ink-muted">
                        Create a new password for your account.
                    </p>
                </div>

                {error && <Alert type="error" message={error} className="mb-4" />}
                {success && <Alert type="success" message={success} className="mb-4" />}

                {readyForReset ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="password"
                                className="mb-1 block text-sm font-medium text-ink"
                            >
                                New password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value)
                                    if (error) setError('')
                                }}
                                autoComplete="new-password"
                                required
                                className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="mb-1 block text-sm font-medium text-ink"
                            >
                                Confirm new password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value)
                                    if (error) setError('')
                                }}
                                autoComplete="new-password"
                                required
                                className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                        >
                            {loading ? 'Updating password…' : 'Update password'}
                        </button>
                    </form>
                ) : (
                    <p className="text-sm text-ink-muted">
                        <Link href="/forgot-password" className="font-medium text-blue-700 underline-offset-2 hover:underline">
                            Request a new reset link
                        </Link>
                    </p>
                )}

                <p className="mt-6 text-center text-sm text-ink-muted">
                    <Link href="/sign-in" className="font-medium text-blue-700 underline-offset-2 hover:underline">
                        Back to sign in
                    </Link>
                </p>
            </div>
        </main>
    )
}
