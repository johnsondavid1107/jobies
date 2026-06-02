import { supabaseAdmin } from '@/lib/supabase/server';
import { Stage } from './types';

export async function listApplications() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('applications')
    .select('*, resume_versions!resume_version_id(id, docx_storage_path, pdf_storage_path, google_drive_file_id)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateApplication(id: string, patch: Record<string, any>) {
  const sb = supabaseAdmin();
  const payload: Record<string, any> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.stage === 'applied' && !patch.date_applied) {
    payload.date_applied = new Date().toISOString();
  }
  const { data, error } = await sb.from('applications').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteApplication(id: string) {
  const sb = supabaseAdmin();
  // resume_versions.application_id is ON DELETE SET NULL, so any tailored
  // résumé survives (just unlinked). The job's `swipes` row is left intact so
  // the posting stays out of the swipe deck and isn't re-fetched/re-scored.
  const { error } = await sb.from('applications').delete().eq('id', id);
  if (error) throw error;
}

export async function getApplication(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('applications').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export type { Stage };
