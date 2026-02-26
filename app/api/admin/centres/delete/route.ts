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

export async function DELETE(req: Request) {
    try {
        await requireAdmin(req)

        const body = await req.json()
        const id = String(body?.id || '').trim()

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 })
        }

        const { error } = await supabase
            .from('centre_data')
            .delete()
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
