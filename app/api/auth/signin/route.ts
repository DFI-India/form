import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
    try {
        console.log('[API] Sign-in request received')
        
        const body = await req.json()
        console.log('[API] Body parsed:', { username: body.username, hasPassword: !!body.password })
        
        const username = (body.username || '').trim().toLowerCase()
        const password = body.password || ''

        if (!username || !password) {
            console.log('[API] Missing username or password')
            return NextResponse.json({ error: 'Missing username or password' }, { status: 400 })
        }

        // Look up the profile to find the associated email.
        console.log('[API] Looking up user:', username)
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email')
            .eq('username', username)
            .maybeSingle()

        if (error) {
            console.log('[API] Database error:', error.message)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        
        if (!data) {
            console.log('[API] User not found')
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
        }

        console.log('[API] User found, returning email for client auth')
        // Passwords are stored in Supabase Auth; return the email so the client can sign in
        // using Supabase Auth (which will validate the password).
        return NextResponse.json({ success: true, id: data.id, email: data.email ?? null })
    } catch (err: any) {
        console.log('[API] Catch error:', err.message || err)
        return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
    }
}
