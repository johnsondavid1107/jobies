import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { JobSourceAdapter } from './types';
import { adzunaAdapter } from './adzuna';
import { greenhouseAdapter } from './greenhouse';
import { leverAdapter } from './lever';
import { ashbyAdapter } from './ashby';
import { wtjAdapter } from './wtj';
import { remotiveAdapter } from './remotive';

const ALL: Record<string, JobSourceAdapter> = {
  adzuna: adzunaAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  ashby: ashbyAdapter,
  wtj: wtjAdapter,
  remotive: remotiveAdapter,
};

export async function getEnabledSources() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('job_sources').select('*').eq('enabled', true);
  if (error) throw error;
  return (data || []).filter((r) => ALL[r.name]).map((r) => ({
    row: r,
    adapter: ALL[r.name],
  }));
}

export function configureFromEnv(name: string, baseConfig: any) {
  // Merge in env-derived defaults (e.g. comma-separated board lists)
  const config = { ...(baseConfig || {}) };
  if (name === 'greenhouse' && !config.boards?.length) {
    config.boards = csv(process.env.GREENHOUSE_BOARDS);
  }
  if (name === 'lever' && !config.boards?.length) {
    config.boards = csv(process.env.LEVER_BOARDS);
  }
  if (name === 'ashby' && !config.boards?.length) {
    config.boards = csv(process.env.ASHBY_BOARDS);
  }
  if (name === 'adzuna' && !config.country) {
    config.country = env.adzunaCountry;
  }
  return config;
}

function csv(s?: string) {
  return (s || '').split(',').map((x) => x.trim()).filter(Boolean);
}
