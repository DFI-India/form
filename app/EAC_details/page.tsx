'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../lib/supabase'

type EacDetail = {
    eac_no: string | number
    centre_id?: string | null
    village_name?: string | null
    district?: string | null
    taluk?: string | null
    panchayat?: string | null
    village?: string | null
}

export default function EAC_Details() {
    const router = useRouter()
    const [checkedAuth, setCheckedAuth] = useState(false)
    const [authorized, setAuthorized] = useState(false)
    const [eacData, setEacData] = useState<EacDetail[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        let isMounted = true

        const verifySession = async () => {
            const { data } = await supabase.auth.getSession()
            if (!isMounted) return

            const hasSession = Boolean(data.session)
            setAuthorized(hasSession)
            setCheckedAuth(true)

            if (!hasSession) router.replace('/sign-in')
        }

        verifySession()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return
            const hasSession = Boolean(session)
            setAuthorized(hasSession)
            if (!hasSession) router.replace('/sign-in')
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [router])

    useEffect(() => {
        if (!authorized) return
        fetchEacDetails()
    }, [authorized])

    const fetchEacDetails = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase.from('centre_data').select('*')
            if (error) throw error
            setEacData(data as EacDetail[])
            setMessage(null)
        } catch (error) {
            console.error('Error fetching EAC details:', error)
            setMessage('Unable to fetch EAC details. Please try again later.')
        } finally {
            setLoading(false)
        }
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.replace('/sign-in')
    }

    if (!checkedAuth) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-100">
                <p className="text-sm text-slate-500">Checking access…</p>
            </main>
        )
    }

    if (!authorized) return null

    return (
        <main className="flex-1 bg-slate-100 min-h-screen p-8">
            {/* Header */}
            <header className="mb-8">
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-start sm:text-left">
                        <Image
                            src="/DFI.png"
                            alt="Debora Foundation India logo"
                            width={180}
                            height={60}
                            priority
                            className="h-auto w-40 sm:w-44"
                        />
                        <span className="text-xl font-semibold text-slate-900">
                            Debora Foundation India
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
                    >
                        Sign out
                    </button>
                </div>

                <p className="text-sm font-semibold tracking-wide text-blue-600">
                    Centre Directory
                </p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                    EAC Details
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    View all EAC (Education Assistance Centre) records with their location and identification details.
                </p>
            </header>

            {/* Content Section */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                {message && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {message}
                    </div>
                )}

                {loading ? (
                    <p className="text-sm text-slate-500">Loading EAC records…</p>
                ) : eacData.length === 0 ? (
                    <p className="text-sm text-slate-500">No EAC details available.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border border-slate-200 text-sm text-slate-700">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="border border-slate-200 px-3 py-2 text-left">EAC No</th>
                                    <th className="border border-slate-200 px-3 py-2 text-left">Centre ID</th>
                                    <th className="border border-slate-200 px-3 py-2 text-left">Village Name</th>
                                    <th className="border border-slate-200 px-3 py-2 text-left">District</th>
                                    <th className="border border-slate-200 px-3 py-2 text-left">Taluk</th>
                                    <th className="border border-slate-200 px-3 py-2 text-left">Panchayat</th>
                                    <th className="border border-slate-200 px-3 py-2 text-left">Village</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eacData.map((item, index) => (
                                    <tr
                                        key={index}
                                        className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                                    >
                                        <td className="border border-slate-200 px-3 py-2">{item.eac_no}</td>
                                        <td className="border border-slate-200 px-3 py-2">{item.centre_id ?? '-'}</td>
                                        <td className="border border-slate-200 px-3 py-2">{item.village_name ?? '-'}</td>
                                        <td className="border border-slate-200 px-3 py-2">{item.district ?? '-'}</td>
                                        <td className="border border-slate-200 px-3 py-2">{item.taluk ?? '-'}</td>
                                        <td className="border border-slate-200 px-3 py-2">{item.panchayat ?? '-'}</td>
                                        <td className="border border-slate-200 px-3 py-2">{item.village ?? '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    )
}
