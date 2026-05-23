import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { costUsd } from '@/lib/dashboard/pricing';

export const runtime = 'nodejs';

export async function GET() {
  const sb = supabaseAdmin();

  const [
    { count: totalJobs },
    { data: swipes },
    { count: applicationsCount },
    { data: aiRows },
  ] = await Promise.all([
    sb.from('jobs').select('id', { count: 'exact', head: true }),
    sb.from('swipes').select('action'),
    sb.from('applications').select('id', { count: 'exact', head: true }),
    sb.from('ai_outputs').select('provider, model, input_tokens, output_tokens'),
  ]);

  const swipeCounts = { interested: 0, rejected: 0, save_for_later: 0, already_applied: 0 };
  for (const s of swipes || []) {
    if (s.action in swipeCounts) swipeCounts[s.action as keyof typeof swipeCounts]++;
  }
  const seen = (swipes || []).length;

  // Aggregate token usage and cost by (provider, model).
  type Agg = { provider: string; model: string; input_tokens: number; output_tokens: number; calls: number; cost_usd: number };
  const byModel = new Map<string, Agg>();
  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;
  for (const r of aiRows || []) {
    const provider = r.provider || 'unknown';
    const model = r.model || 'unknown';
    const key = `${provider}:${model}`;
    const inp = r.input_tokens ?? 0;
    const out = r.output_tokens ?? 0;
    const cost = costUsd(model, inp, out);
    totalInput += inp;
    totalOutput += out;
    totalCost += cost;
    const cur = byModel.get(key) ?? { provider, model, input_tokens: 0, output_tokens: 0, calls: 0, cost_usd: 0 };
    cur.input_tokens += inp;
    cur.output_tokens += out;
    cur.calls += 1;
    cur.cost_usd += cost;
    byModel.set(key, cur);
  }

  return NextResponse.json({
    totals: {
      jobs_in_pool: totalJobs ?? 0,
      seen,
      liked: swipeCounts.interested,
      skipped: swipeCounts.rejected,
      saved: swipeCounts.save_for_later,
      already_applied: swipeCounts.already_applied,
      applications: applicationsCount ?? 0,
      input_tokens: totalInput,
      output_tokens: totalOutput,
      cost_usd: totalCost,
    },
    by_model: Array.from(byModel.values()).sort((a, b) => b.cost_usd - a.cost_usd),
  });
}
