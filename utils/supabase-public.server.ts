import "server-only"
import { createClient } from "@supabase/supabase-js"

// Public server rendering must use the same RLS restrictions as an anonymous
// visitor. Keep this separate from both admin credentials and browser sessions.
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
)
