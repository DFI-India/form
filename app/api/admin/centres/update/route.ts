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
        const district = String(body?.district || '').trim() || null
        const taluk = String(body?.taluk || '').trim() || null
        const panchayat = String(body?.panchayat || '').trim() || null
        const village = String(body?.village || '').trim() || null
        const start_date = String(body?.start_date || '').trim() || null
        const end_date = String(body?.end_date || '').trim() || null
        const cbv_name = String(body?.cbv_name || '').trim() || null
        const in_charge = String(body?.in_charge || '').trim() || null
        const panchayat_member = String(body?.panchayat_member || '').trim() || null
        const head_master = String(body?.head_master || '').trim() || null
        const anganvadi = String(body?.anganvadi || '').trim() || null
        const asha_worker = String(body?.asha_worker || '').trim() || null
        const head_master_mobile = String(body?.head_master_mobile || '').trim() || null
        const in_charge_mobile = String(body?.in_charge_mobile || '').trim() || null
        const cbv_mobile = String(body?.cbv_mobile || '').trim() || null
        const panchayat_member_mobile = String(body?.panchayat_member_mobile || '').trim() || null
        const anganvadi_mobile = String(body?.anganvadi_mobile || '').trim() || null
        const asha_worker_mobile = String(body?.asha_worker_mobile || '').trim() || null
        const cbv_email = String(body?.cbv_email || '').trim() || null

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 })
        }

        if (!eac_no || !village_name) {
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
                district,
                taluk,
                panchayat,
                village,
                start_date,
                end_date,
                cbv_name,
                in_charge,
                panchayat_member,
                head_master,
                anganvadi,
                asha_worker,
                head_master_mobile,
                in_charge_mobile,
                cbv_mobile,
                panchayat_member_mobile,
                anganvadi_mobile,
                asha_worker_mobile,
                cbv_email,
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
