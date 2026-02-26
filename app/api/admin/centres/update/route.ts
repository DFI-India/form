import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
})

async function requireAdmin(req: Request) {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null
    if (!token) throw new Error('Unauthorized')

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) throw new Error('Unauthorized')

    const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

    if (pErr || !profile || (profile as any).role !== 'admin') throw new Error('Forbidden')
}

export async function PUT(req: Request) {
    try {
        await requireAdmin(req)

        const body = await req.json()
        const id = String(body?.id || '').trim()
        const eac_no = String(body?.eac_no || '').trim()
        const village_name = String(body?.village_name || '').trim()
        const centre_id = String(body?.centre_id || '').trim()
        const district = String(body?.district || '').trim()
        const taluk = String(body?.taluk || '').trim()
        const panchayat = String(body?.panchayat || '').trim()
        const village = String(body?.village || '').trim()

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 })
        }

        if (!eac_no || !village_name || !centre_id || !district || !taluk || !panchayat || !village) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        if (!/^\d+$/.test(eac_no)) {
            return NextResponse.json({ error: 'eac_no must be an integer value' }, { status: 400 })
        }

        const { data: duplicate } = await supabase
            .from('centre_data')
            .select('id')
            .eq('eac_no', eac_no)
            .neq('id', id)
            .maybeSingle()

        if (duplicate) {
            return NextResponse.json({ error: 'Another centre already uses this eac_no' }, { status: 400 })
        }

        const { error } = await supabase
            .from('centre_data')
            .update({
                eac_no,
                village_name,
                centre_id,
                district,
                taluk,
                panchayat,
                village,
            })
            .eq('id', id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        const message = err?.message || String(err)
        if (message === 'Unauthorized' || message === 'Forbidden') {
            return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
        }
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
