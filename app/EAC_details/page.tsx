// Updated EAC_Details.tsx with:
// 1. Search bar (filters by eac_no)
// 2. Add New Entry form (clean, aligned inputs)
// 3. Works with Tailwind CSS

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../lib/supabase'
import TablePagination from '@mui/material/TablePagination'

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

    // Pagination
    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(5)

    // Search
    const [searchQuery, setSearchQuery] = useState('')

    // Add Entry Form
    const [newEntry, setNewEntry] = useState<EacDetail>({
        eac_no: '',
        centre_id: '',
        village_name: '',
        district: '',
        taluk: '',
        panchayat: '',
        village: ''
    })

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
            data: { subscription }
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

    const filteredData = eacData.filter((item) =>
        item.eac_no?.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage)
    }

    const handleChangeRowsPerPage = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setRowsPerPage(parseInt(event.target.value, 10))
        setPage(0)
    }

    const handleAddRecord = async () => {
        try {
            const { error } = await supabase.from('centre_data').insert([newEntry])
            if (error) throw error

            setNewEntry({
                eac_no: '',
                centre_id: '',
                village_name: '',
                district: '',
                taluk: '',
                panchayat: '',
                village: ''
            })

            fetchEacDetails()
        } catch (error) {
            console.error(error)
            setMessage('Could not add entry.')
        }
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
                        onClick={async () => {
                            await supabase.auth.signOut()
                            router.replace('/sign-in')
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800"
                    >
                        Sign out
                    </button>
                </div>

                <p className="text-sm font-semibold tracking-wide text-blue-600">
                    Centre Directory
                </p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">EAC Details</h1>
            </header>

            {/* Search Bar */}
            <section className="mb-6">
                <input
                    type="text"
                    placeholder="Search by EAC No…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
            </section>

            {/* Add New Entry Form */}
            <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-800">
                    Add New EAC Entry
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(
                        [
                            'eac_no',
                            'centre_id',
                            'village_name',
                            'district',
                            'taluk',
                            'panchayat',
                            'village'
                        ] as (keyof EacDetail)[]
                    ).map((field) => (
                        <div key={field} className="flex flex-col">
                            <label className="mb-1 text-sm font-medium text-slate-700">
                                {field.replace('_', ' ').toUpperCase()}
                            </label>
                            <input
                                type="text"
                                value={newEntry[field] ?? ''}
                                onChange={(e) =>
                                    setNewEntry({ ...newEntry, [field]: e.target.value })
                                }
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleAddRecord}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                    Add Entry
                </button>
            </section>

            {/* Table Section */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                {message && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {message}
                    </div>
                )}

                {loading ? (
                    <p className="text-sm text-slate-500">Loading…</p>
                ) : filteredData.length === 0 ? (
                    <p className="text-sm text-slate-500">No matching records.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border border-slate-200 text-sm text-slate-700">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="border px-3 py-2 text-left">EAC No</th>
                                    <th className="border px-3 py-2 text-left">Centre ID</th>
                                    <th className="border px-3 py-2 text-left">Village Name</th>
                                    <th className="border px-3 py-2 text-left">District</th>
                                    <th className="border px-3 py-2 text-left">Taluk</th>
                                    <th className="border px-3 py-2 text-left">Panchayat</th>
                                    <th className="border px-3 py-2 text-left">Village</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((item, index) => (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                            <td className="border px-3 py-2">{item.eac_no}</td>
                                            <td className="border px-3 py-2">{item.centre_id ?? '-'}</td>
                                            <td className="border px-3 py-2">{item.village_name ?? '-'}</td>
                                            <td className="border px-3 py-2">{item.district ?? '-'}</td>
                                            <td className="border px-3 py-2">{item.taluk ?? '-'}</td>
                                            <td className="border px-3 py-2">{item.panchayat ?? '-'}</td>
                                            <td className="border px-3 py-2">{item.village ?? '-'}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>

                        <TablePagination
                            component="div"
                            count={filteredData.length}
                            page={page}
                            onPageChange={handleChangePage}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            rowsPerPageOptions={[5, 10, 25]}
                        />
                    </div>
                )}
            </section>
        </main>
    )
}
