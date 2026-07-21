import { createClient } from "@supabase/supabase-js";

// The anon key is public by design (it ships to the browser). Access is
// restricted by Row Level Security on the database, never by hiding this key.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fshbdeydbotglbalgnhy.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaGJkZXlkYm90Z2xiYWxnbmh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MTg5NzgsImV4cCI6MjEwMDE5NDk3OH0.YPdTPHBiIbr6GPAHJvUKS2elH6SO9XdwM4Di2jPYDaM';

// Since we provided fallbacks above, this will now correctly return true
export const supabaseConfigured = Boolean(url && anonKey);

// Initialize the client with the URL, Key, and the required Auth options
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Current access token, or null. Used to authorise backend calls. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
