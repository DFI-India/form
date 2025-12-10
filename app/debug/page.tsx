"use client";

import { createBrowserClient } from '@supabase/ssr';

export default function DebugPage() {
    const test = async () => {
        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const sessionRes = await supabase.auth.getSession();
            console.log("SESSION RESPONSE:", sessionRes);

            // Also retrieve user via getUser() and print the UID (auth.uid())
            const userRes = await supabase.auth.getUser();
            console.log("getUser RESPONSE:", userRes);

            // auth.uid() in RLS maps to the user id; show it here for debugging
            console.log("auth.uid():", userRes.data.user?.id ?? sessionRes.data.session?.user?.id);

            const { data: profiles, error: profilesError } =
                await supabase.from("profiles").select("*");

            console.log("PROFILE QUERY:", profiles);
            console.log("PROFILE ERROR:", profilesError);
            console.log("USER:", sessionRes.data.session?.user);
            console.log("USER ID:", sessionRes.data.session?.user?.id);
        } catch (err) {
            console.error("Error creating Supabase client or running queries:", err);
            // Friendly UI feedback for quick debugging
            // (avoid revealing secrets in production)
            alert("Supabase error: check console for details");
        }
    };

    return (
        <div style={{ padding: 40 }}>
            <h1>Debug Page</h1>

            <button
                onClick={test}
                style={{
                    padding: "10px 20px",
                    background: "black",
                    color: "white",
                    fontSize: 16,
                    borderRadius: 6,
                }}
            >
                Test Supabase
            </button>
        </div>
    );
}
