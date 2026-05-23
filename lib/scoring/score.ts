import { supabaseAdmin } from '@/lib/supabase/server';
import { aiComplete, extractJson } from '@/lib/ai/provider';
import { SCORE_SYSTEM, buildScorePrompt, ScoreOutput } from '@/lib/ai/prompts';
import { getProfile } from '@/lib/db/profile';
import { ScoringWeights } from '@/lib/db/types';

export function computeFinalScore(
  subscores: Omit<ScoreOutput, 'ai_explanation' | 'focus_suggestions'>,
  weights: ScoringWeights
): number {
  const totalWeight =
    weights.resume + weights.title + weights.industry + weights.seniority +
    weights.salary + weights.location + weights.swipe + weights.quality;
  if (totalWeight === 0) return 0;
  const weighted =
    (subscores.resume_match_score ?? 0) * weights.resume +
    (subscores.title_match_score ?? 0) * weights.title +
    (subscores.industry_match_score ?? 0) * weights.industry +
    (subscores.seniority_match_score ?? 0) * weights.seniority +
    (subscores.salary_match_score ?? 0) * weights.salary +
    (subscores.location_match_score ?? 0) * weights.location +
    (subscores.swipe_learning_score ?? 0) * weights.swipe +
    (subscores.quality_score ?? 0) * weights.quality;
  return Math.max(0, Math.min(1, weighted / totalWeight));
}

export async function scoreAndPersist(job: any) {
  const sb = supabaseAdmin();
  const profile = await getProfile();

  if (!profile.resume_text) throw new Error('No master resume uploaded yet');

  const { data: recentSwipes } = await sb
    .from('swipes')
    .select('action, job_id, jobs:job_id(title, company), job_scores:job_id(final_score)')
    .order('created_at', { ascending: false })
    .limit(30);

  const swipesForPrompt = (recentSwipes || []).map((s: any) => ({
    title: s.jobs?.title || '',
    company: s.jobs?.company || null,
    action: s.action,
    final_score: s.job_scores?.final_score ?? null,
  }));

  const raw = await aiComplete({
    system: SCORE_SYSTEM,
    prompt: buildScorePrompt({
      resumeText: profile.resume_text,
      job: {
        title: job.title,
        company: job.company,
        description: job.description,
        location: job.location,
        remote_type: job.remote_type,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
      },
      preferences: profile.preferences_json,
      recentSwipes: swipesForPrompt,
    }),
    json: true,
    maxTokens: 1500,
    jobId: job.id,
    type: 'score',
  });

  let parsed: ScoreOutput;
  try {
    parsed = extractJson<ScoreOutput>(raw);
  } catch {
    parsed = {
      resume_match_score: 0,
      title_match_score: 0,
      industry_match_score: 0,
      seniority_match_score: 0,
      salary_match_score: 0,
      location_match_score: 0,
      swipe_learning_score: 0,
      quality_score: 0.5,
      ai_explanation: 'AI scoring failed; defaulted to zeros.',
      focus_suggestions: [],
    };
  }

  const final = computeFinalScore(parsed, profile.scoring_weights_json);

  const { data, error } = await sb
    .from('job_scores')
    .upsert(
      {
        job_id: job.id,
        resume_match_score: parsed.resume_match_score,
        title_match_score: parsed.title_match_score,
        industry_match_score: parsed.industry_match_score,
        seniority_match_score: parsed.seniority_match_score,
        salary_match_score: parsed.salary_match_score,
        location_match_score: parsed.location_match_score,
        swipe_learning_score: parsed.swipe_learning_score,
        quality_score: parsed.quality_score,
        final_score: final,
        ai_explanation: parsed.ai_explanation,
        focus_suggestions: parsed.focus_suggestions,
      },
      { onConflict: 'job_id' }
    )
    .select()
    .single();
  if (error) throw error;

  return data;
}

export async function recalculateAllFinalScores() {
  const sb = supabaseAdmin();
  const profile = await getProfile();
  const { data: scores } = await sb.from('job_scores').select('*');
  for (const s of scores || []) {
    const final = computeFinalScore(s, profile.scoring_weights_json);
    await sb.from('job_scores').update({ final_score: final }).eq('id', s.id);
  }
  return scores?.length || 0;
}
