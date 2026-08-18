'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import DFILogo from '../../../public/DFI.png'
import { supabase } from '../../../lib/supabase'
import { useRequireRole } from '../../../lib/hooks'
import TablePagination from '@mui/material/TablePagination'

type FormState = {
    eac_no: string
    village_name: string
    centre_id: string
    district: string
    taluk: string
    panchayat: string
    village: string
    adm_date: string
    reg_no: string
    first_name: string
    last_name: string
    gender: string
    aadhar_no: string
    birth_place: string
    height: string
    weight: string
    blood_group: string
    health: string
    caste: string
    mother_tongue: string
    class_std_text: string
    religion: string
    dateofbirth: string
    school_name: string
    school_category: string
    sats_no: string
    pen_no: string
    medium_of_study: string
    life_ambition: string
    fav_subject: string
    child_other_info: string
    photo_link: string
}

export default function ChildDetailsPage({ params }: { params: { eac_no: string } }) {
    const { eac_no } = params
    const router = useRouter()
    const { loading: authLoading, isAuthorized } = useRequireRole(['admin'])

    const [children, setChildren] = useState<FormState[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!isAuthorized) return

        let mounted = true

        const fetchChildren = async () => {
            try {
                setLoading(true)
                const { data, error } = await supabase
                    .from('Child_Data')
                    .select('*')
                    .eq('eac_no', eac_no)
                    .order('first_name', { ascending: true })

                if (error) throw error
                if (!mounted) return
                setChildren((data as FormState[]) ?? [])
                setMessage(null)
            } catch (err) {
                console.error('Error fetching child data:', err)
                if (!mounted) return
                setMessage('Unable to fetch child records.')
            } finally {
                if (!mounted) return
                setLoading(false)
            }
        }

        fetchChildren()
        return () => {
            mounted = false
        }
    }, [eac_no, isAuthorized])

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-sm text-slate-500">Loading…</p>
            </div>
        )
    }

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
                    <p className="text-slate-600">You don't have permission to access this page.</p>
                </div>
            </main>
        )
    }

    return (
        <main className="flex-1 bg-slate-100 min-h-screen p-8">
            <header className="mb-8">
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-start sm:text-left">
                        <Image
                            src={DFILogo}
                            alt="Debora Foundation India logo"
                            width={180}
                            height={60}
                            priority
                            className="h-auto w-40 sm:w-44"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800"
                    >
                        Back
                    </button>
                </div>

                <p className="text-sm font-semibold tracking-wide text-blue-600">Children</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Children for EAC: {eac_no}</h1>
            </header>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                {loading ? (
                    <p className="text-sm text-slate-500">Loading…</p>
                ) : message ? (
                    <p className="text-sm text-red-600">{message}</p>
                ) : children.length === 0 ? (
                    <p className="text-sm text-slate-500">No child records found for this EAC.</p>
                ) : (
                    // container forces both vertical and horizontal scrolling when needed
                    <div className="overflow-auto max-h-[65vh] w-full border rounded">
                        <table className="min-w-[1400px] w-full table-auto text-sm text-slate-700">
                            <thead className="bg-slate-50 text-slate-600 sticky top-0">
                                <tr>
                                    <th className="border px-3 py-2 text-left">Admission Date</th>
                                    <th className="border px-3 py-2 text-left">Registration No</th>
                                    <th className="border px-3 py-2 text-left">First Name</th>
                                    <th className="border px-3 py-2 text-left">Last Name</th>
                                    <th className="border px-3 py-2 text-left">Gender</th>
                                    <th className="border px-3 py-2 text-left">Aadhar No</th>
                                    <th className="border px-3 py-2 text-left">Birth Place</th>
                                    <th className="border px-3 py-2 text-left">Height (cm)</th>
                                    <th className="border px-3 py-2 text-left">Weight (kg)</th>
                                    <th className="border px-3 py-2 text-left">Blood Group</th>
                                    <th className="border px-3 py-2 text-left">Health</th>
                                    <th className="border px-3 py-2 text-left">Caste</th>
                                    <th className="border px-3 py-2 text-left">Mother Tongue</th>
                                    <th className="border px-3 py-2 text-left">Religion</th>
                                    <th className="border px-3 py-2 text-left">Date of Birth</th>
                                    <th className="border px-3 py-2 text-left">Class/Std</th>
                                    <th className="border px-3 py-2 text-left">School Name</th>
                                    <th className="border px-3 py-2 text-left">School Category</th>
                                    <th className="border px-3 py-2 text-left">SATS No</th>
                                    <th className="border px-3 py-2 text-left">PEN No</th>
                                    <th className="border px-3 py-2 text-left">Medium of Study</th>
                                    <th className="border px-3 py-2 text-left">Life Ambition</th>
                                    <th className="border px-3 py-2 text-left">Fav Subject</th>
                                    <th className="border px-3 py-2 text-left">Other Info</th>
                                    <th className="border px-3 py-2 text-left">Photo Link</th>
                                </tr>
                            </thead>
                            <tbody>
                                {children.map((c, i) => (
                                    <tr
                                        key={c.reg_no ?? i}
                                        className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                                    >
                                        <td className="border px-3 py-2">{c.adm_date ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.reg_no ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.first_name ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.last_name ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.gender ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.aadhar_no ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.birth_place ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.height ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.weight ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.blood_group ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.health ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.caste ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.mother_tongue ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.religion ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.dateofbirth ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.class_std_text ?? (c as any).class_std ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.school_name ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.school_category ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.sats_no ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.pen_no ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.medium_of_study ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.life_ambition ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.fav_subject ?? '-'}</td>
                                        <td className="border px-3 py-2">{c.child_other_info ?? '-'}</td>
                                        <td className="border px-3 py-2">
                                            {c.photo_link ? (
                                                <a href={c.photo_link} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                                                    View
                                                </a>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
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