import { JobSourceAdapter, RawJob } from './types';

interface Config { boards?: string[] }

export const greenhouseAdapter: JobSourceAdapter = {
  id: 'greenhouse',
  name: 'Greenhouse',
  async fetch(config: Config) {
    const boards = config?.boards || [];
    const out: RawJob[] = [];
    for (const slug of boards) {
      const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of data.jobs || []) {
        const description = stripHtml(j.content || '');
        out.push({
          source: 'greenhouse',
          source_job_id: `${slug}:${j.id}`,
          title: j.title,
          company: slug,
          description,
          url: j.absolute_url,
          location: j.location?.name || null,
          remote_type: /remote/i.test(j.location?.name || '') ? 'remote' : 'unknown',
          date_posted: j.updated_at || null,
          raw_data_json: j,
        });
      }
    }
    return out;
  },
};

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
