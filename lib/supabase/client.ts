import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export function supabaseBrowser() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error('Supabase not configured');
  }
  return createClient(env.supabaseUrl, env.supabaseAnonKey);
}
