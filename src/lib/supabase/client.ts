import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client. Uses the PUBLIC anon key only — this is safe to ship
 * in a static bundle because the database is locked down by RLS (anon can read
 * the public vote views and nothing else; all writes go through the cast-vote
 * Edge Function). The service_role key is NEVER referenced here.
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

/** True when both env vars are present, so the UI can degrade gracefully. */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

let cached: SupabaseClient | null = null;

/** Lazily-created singleton client, or null when not configured. */
export function getSupabaseClient(): SupabaseClient | null {
  if (cached) return cached;
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  cached = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
