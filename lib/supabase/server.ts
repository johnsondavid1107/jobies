import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error('Supabase admin not configured (need URL + service role key)');
  }
  cached = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false },
    // Next.js caches the GET requests supabase-js makes via fetch, which served
    // stale (empty) results for live data like resume_versions. Force every
    // server-side query to be dynamic so the dashboard always reflects the DB.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  return cached;
}

export function hasSupabase() {
  return !!(env.supabaseUrl && env.supabaseServiceKey);
}
