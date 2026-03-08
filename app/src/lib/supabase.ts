import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SECRET_KEY!;

// Server-side client using service role key — bypasses RLS, only used in API routes / lib
export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
