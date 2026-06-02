import { supabaseAdmin } from '@/lib/supabase/server';

export async function getMasterResume() {
  return getLatestResume('master');
}

export async function getTemplateResume() {
  return getLatestResume('template');
}

async function getLatestResume(type: 'master' | 'template') {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('resumes')
    .select('*')
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
