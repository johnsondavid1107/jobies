import { supabaseAdmin } from '@/lib/supabase/server';
import { SwipeAction } from './types';

export async function recordSwipe(jobId: string, action: SwipeAction) {
  const sb = supabaseAdmin();
  const { error } = await sb.from('swipes').insert({ job_id: jobId, action });
  if (error) throw error;

  // Auto-create application records for interested/save_for_later/already_applied
  if (action === 'interested' || action === 'save_for_later' || action === 'already_applied') {
    const { data: job } = await sb.from('jobs').select('*').eq('id', jobId).maybeSingle();
    const { data: score } = await sb.from('job_scores').select('final_score').eq('job_id', jobId).maybeSingle();
    if (job) {
      const { data: existing } = await sb
        .from('applications')
        .select('id')
        .eq('job_id', jobId)
        .maybeSingle();
      const stage =
        action === 'interested' ? 'interested' :
        action === 'save_for_later' ? 'saved' :
        'applied';
      if (!existing) {
        await sb.from('applications').insert({
          job_id: jobId,
          company: job.company,
          title: job.title,
          url: job.url,
          location: job.location,
          remote_type: job.remote_type,
          source: job.source,
          salary_range:
            job.salary_min || job.salary_max
              ? `${job.salary_min || ''}${job.salary_min && job.salary_max ? '–' : ''}${job.salary_max || ''}`
              : null,
          stage,
          match_score: score?.final_score ?? null,
          date_applied: action === 'already_applied' ? new Date().toISOString() : null,
        });
      }
    }
  }
}

export async function listSwipedJobIds(): Promise<Set<string>> {
  const sb = supabaseAdmin();
  const { data } = await sb.from('swipes').select('job_id');
  return new Set((data || []).map((r) => r.job_id));
}
