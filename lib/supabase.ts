//import { createClient } from '@supabase/supabase-js'

//const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
//const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

//export const supabase = createClient(supabaseUrl, supabaseKey)

"use client";

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
