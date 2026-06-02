import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export interface ResumeVersionRow {
  id: string;
  company: string | null;
  role: string | null;
  docx_storage_path: string | null;
  pdf_storage_path: string | null;
  match_score_before: number | null;
  match_score_after: number | null;
  keywords_emphasized_json: string[] | null;
  used_to_apply: boolean;
  notes: string | null;
  created_at: string;
  job_id: string | null;
  application_id: string | null;
  google_drive_file_id: string | null;
  parent_version_id: string | null;
  last_synced_at: string | null;
  docx_url?: string | null;
  pdf_url?: string | null;
}

export async function listResumeVersions(): Promise<ResumeVersionRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('resume_versions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const out: ResumeVersionRow[] = [];
  for (const r of data || []) {
    const row: ResumeVersionRow = { ...r };
    if (r.docx_storage_path) {
      const { data: u } = await sb.storage.from(env.storageBucket).createSignedUrl(r.docx_storage_path, 3600);
      row.docx_url = u?.signedUrl || null;
    }
    if (r.pdf_storage_path) {
      const { data: u } = await sb.storage.from(env.storageBucket).createSignedUrl(r.pdf_storage_path, 3600);
      row.pdf_url = u?.signedUrl || null;
    }
    out.push(row);
  }
  return out;
}

export async function updateResumeVersion(id: string, patch: Record<string, any>) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('resume_versions').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
