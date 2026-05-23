import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getEnabledSources, configureFromEnv } from '@/lib/sources/registry';
import { upsertJob } from '@/lib/db/jobs';
import { scoreAndPersist } from '@/lib/scoring/score';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  try {
    const sources = await getEnabledSources();
    const summary: Record<string, { fetched: number; scored: number; errors: number }> = {};
    const sb = supabaseAdmin();

    for (const { row, adapter } of sources) {
      if (adapter.id === 'manual' || adapter.id === 'wtj') continue;
      const config = configureFromEnv(row.name, row.config_json);
      const key = adapter.id;
      summary[key] = { fetched: 0, scored: 0, errors: 0 };
      let jobs: any[] = [];
      try {
        jobs = await adapter.fetch(config);
      } catch (e) {
        summary[key].errors++;
        continue;
      }
      for (const raw of jobs) {
        try {
          const job = await upsertJob(raw);
          summary[key].fetched++;
          // Only score if no score exists yet
          const { data: existing } = await sb
            .from('job_scores')
            .select('id')
            .eq('job_id', job.id)
            .maybeSingle();
          if (!existing) {
            try {
              await scoreAndPersist(job);
              summary[key].scored++;
            } catch {
              summary[key].errors++;
            }
          }
        } catch {
          summary[key].errors++;
        }
      }
    }
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
