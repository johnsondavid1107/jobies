import { supabaseAdmin } from '@/lib/supabase/server';

export interface QueueJob {
  id: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string | null;
  location: string | null;
  remote_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  source: string;
  date_posted: string | null;
  discovered_at: string;
  final_score: number | null;
  ai_explanation: string | null;
  focus_suggestions: string[] | null;
}

export async function getSwipeQueue(limit = 50): Promise<QueueJob[]> {
  const sb = supabaseAdmin();
  const { data: swiped } = await sb.from('swipes').select('job_id');
  const swipedIds = (swiped || []).map((s) => s.job_id);
  let query = sb
    .from('jobs')
    .select('*, job_scores(final_score, ai_explanation, focus_suggestions)')
    .order('discovered_at', { ascending: false })
    .limit(limit);
  if (swipedIds.length > 0) {
    query = query.not('id', 'in', `(${swipedIds.map((id) => `"${id}"`).join(',')})`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || [])
    .filter((j: any) => isLocationEligible(j.remote_type, j.location))
    .map((j: any) => {
    const score = Array.isArray(j.job_scores) ? j.job_scores[0] : j.job_scores;
    return {
      id: j.id,
      title: j.title,
      company: j.company,
      description: j.description,
      url: j.url,
      location: j.location,
      remote_type: j.remote_type,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      source: j.source,
      date_posted: j.date_posted,
      discovered_at: j.discovered_at,
      final_score: score?.final_score ?? null,
      ai_explanation: score?.ai_explanation ?? null,
      focus_suggestions: score?.focus_suggestions ?? null,
    } as QueueJob;
  });
  rows.sort((a, b) => (b.final_score ?? -1) - (a.final_score ?? -1));
  return rows;
}

// Hard rule: remote, NYC, or NJ only. Multi-location strings pass if ANY segment matches.
const ELIGIBLE_PATTERNS: RegExp[] = [
  /\bremote\b/i,
  /\bworldwide\b/i,
  /\banywhere\b/i,
  /\bnew york\b/i,
  /\bnyc\b/i,
  /\bmanhattan\b/i,
  /\bbrooklyn\b/i,
  /\bqueens\b/i,
  /\bbronx\b/i,
  /\bstaten island\b/i,
  /\bnew jersey\b/i,
  /\bnj\b/i,
  /\bjersey city\b/i,
  /\bnewark\b/i,
  /\bhoboken\b/i,
];

export function isLocationEligible(remoteType: string | null, location: string | null): boolean {
  if (remoteType && remoteType.toLowerCase() === 'remote') return true;
  if (!location) return false;
  return ELIGIBLE_PATTERNS.some((re) => re.test(location));
}
