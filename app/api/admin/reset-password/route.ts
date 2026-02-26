import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

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
    return data.user
}

function generateTemporaryPassword(): string {
    const randomPart = randomBytes(6).toString('base64url')
    return `Tmp@${randomPart}9`
}

export async function POST(req: Request) {
    try {
        await requireAdmin(req)

        const body = await req.json()
        const userId = String(body?.id || '').trim()
        if (!userId) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 })
        }

        const temporaryPassword = generateTemporaryPassword()

        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: temporaryPassword,
        })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, temporaryPassword })
    } catch (err: any) {
        const message = err?.message || String(err)
        if (message === 'Unauthorized' || message === 'Forbidden') {
            return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
        }
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
