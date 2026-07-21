import { createClient } from "@supabase/supabase-js";

// The anon key is public by design (it ships to the browser). Access is
// restricted by Row Level Security on the database, never by hiding this key.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "anon", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Current access token, or null. Used to authorise backend calls. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
