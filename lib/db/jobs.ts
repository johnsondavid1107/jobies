import { supabaseAdmin } from '@/lib/supabase/server';
import { RawJob } from '@/lib/sources/types';

export async function upsertJob(raw: RawJob) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('jobs')
    .upsert(
      {
        source: raw.source,
        source_job_id: raw.source_job_id,
        title: raw.title,
        company: raw.company,
        description: raw.description,
        url: raw.url,
        location: raw.location,
        remote_type: raw.remote_type,
        salary_min: raw.salary_min,
        salary_max: raw.salary_max,
        date_posted: raw.date_posted,
        raw_data_json: raw.raw_data_json,
      },
      { onConflict: 'source,source_job_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getJob(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('jobs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
