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
  });
  return cached;
}

export function hasSupabase() {
  return !!(env.supabaseUrl && env.supabaseServiceKey);
}
