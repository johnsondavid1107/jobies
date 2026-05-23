import { env } from '@/lib/env';
import { JobSourceAdapter, RawJob } from './types';

interface AdzunaConfig {
  country?: string;
  queries?: { what?: string; where?: string; results_per_page?: number }[];
}

export const adzunaAdapter: JobSourceAdapter = {
  id: 'adzuna',
  name: 'Adzuna',
  async fetch(config: AdzunaConfig) {
    if (!env.adzunaId || !env.adzunaKey) return [];
    const country = config?.country || env.adzunaCountry || 'us';
    const queries = (config?.queries && config.queries.length > 0)
      ? config.queries
      : [{ what: 'software engineer', where: 'remote' }];
    const out: RawJob[] = [];
    for (const q of queries) {
      const params = new URLSearchParams({
        app_id: env.adzunaId,
        app_key: env.adzunaKey,
        results_per_page: String(q.results_per_page || 20),
        what: q.what || '',
        where: q.where || '',
        content_type: 'application/json',
      });
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data.results || []) {
        out.push({
          source: 'adzuna',
          source_job_id: String(r.id),
          title: r.title,
          company: r.company?.display_name || null,
          description: r.description,
          url: r.redirect_url,
          location: r.location?.display_name || null,
          remote_type: /remote/i.test(r.title + ' ' + (r.description || '')) ? 'remote' : 'unknown',
          salary_min: r.salary_min ?? null,
          salary_max: r.salary_max ?? null,
          date_posted: r.created || null,
          raw_data_json: r,
        });
      }
    }
    return out;
  },
};
