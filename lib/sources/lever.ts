import { JobSourceAdapter, RawJob } from './types';

interface Config { boards?: string[] }

export const leverAdapter: JobSourceAdapter = {
  id: 'lever',
  name: 'Lever',
  async fetch(config: Config) {
    const boards = config?.boards || [];
    const out: RawJob[] = [];
    for (const slug of boards) {
      const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of data || []) {
        const description = [j.descriptionPlain, ...((j.lists || []).map((l: any) => `${l.text}: ${stripHtml(l.content || '')}`))].filter(Boolean).join('\n\n');
        out.push({
          source: 'lever',
          source_job_id: `${slug}:${j.id}`,
          title: j.text,
          company: slug,
          description,
          url: j.hostedUrl,
          location: j.categories?.location || null,
          remote_type: /remote/i.test(j.categories?.location || '') ? 'remote' : 'unknown',
          date_posted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
          raw_data_json: j,
        });
      }
    }
    return out;
  },
};

function stripHtml(s: string) { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
