import { supabaseAdmin } from '@/lib/supabase/server';

export async function getMasterResume() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('resumes')
    .select('*')
    .eq('type', 'master')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
