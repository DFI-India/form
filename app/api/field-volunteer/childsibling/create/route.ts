import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
)

// Fields the client-side form actually sends (app/field-volunteer/child-data-entry/page.tsx).
// Whitelisting these keeps the insert to exactly this shape instead of trusting the
// request body wholesale.
const STRING_FIELDS = [
    'village_name', 'eac_no',
    'names_1', 'genders_1', 'class_occup_1',
    'names_2', 'genders_2', 'class_occup_2',
    'names_3', 'genders_3', 'class_occup_3',
    'names_4', 'genders_4', 'class_occup_4',
    'names_5', 'genders_5', 'class_occup_5',
    'sibling_remarks',
] as const

const NUMBER_FIELDS = ['reg_no', 'ages_1', 'ages_2', 'ages_3', 'ages_4', 'ages_5'] as const

function sanitizeSiblingPayload(payload: Record<string, unknown>): { value: Record<string, unknown> } | { error: string } {
    const sanitized: Record<string, unknown> = {}

    for (const key of STRING_FIELDS) {
        if (!(key in payload)) continue
        const value = payload[key]
        if (value === null || value === undefined) {
            sanitized[key] = null
        } else if (typeof value === 'string') {
            sanitized[key] = value
        } else {
            return { error: `Field "${key}" must be a string or null` }
        }
    }

    for (const key of NUMBER_FIELDS) {
        if (!(key in payload)) continue
        const value = payload[key]
        if (value === null || value === undefined) {
            sanitized[key] = null
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            sanitized[key] = value
        } else {
            return { error: `Field "${key}" must be a number or null` }
        }
    }

    const allowedKeys = new Set<string>([...STRING_FIELDS, ...NUMBER_FIELDS])
    const unknownKeys = Object.keys(payload).filter((key) => !allowedKeys.has(key))
    if (unknownKeys.length > 0) {
        return { error: `Unexpected field(s): ${unknownKeys.join(', ')}` }
    }

    return { value: sanitized }
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const {
            data: { user },
            error: authError,
        } = await supabaseAdmin.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profileError || !profile || profile.role !== 'field_volunteer') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json().catch(() => null)
        const payload = body?.payload

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        const sanitizeResult = sanitizeSiblingPayload(payload)
        if ('error' in sanitizeResult) {
            return NextResponse.json({ error: sanitizeResult.error }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('childsibling')
            .insert([sanitizeResult.value])
            .select()
            .single()

        if (error) {
            return NextResponse.json(
                {
                    error: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Unexpected server error' }, { status: 500 })
    }
}
