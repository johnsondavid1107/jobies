import { JobSourceAdapter, RawJob } from './types';

interface Config { boards?: string[] }

export const ashbyAdapter: JobSourceAdapter = {
  id: 'ashby',
  name: 'Ashby',
  async fetch(config: Config) {
    const boards = config?.boards || [];
    const out: RawJob[] = [];
    for (const slug of boards) {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of data.jobs || []) {
        out.push({
          source: 'ashby',
          source_job_id: `${slug}:${j.id}`,
          title: j.title,
          company: slug,
          description: stripHtml(j.descriptionHtml || ''),
          url: j.jobUrl,
          location: j.location || j.locationName || null,
          remote_type: j.isRemote ? 'remote' : 'unknown',
          date_posted: j.publishedAt || null,
          raw_data_json: j,
        });
      }
    }
    return out;
  },
};

function stripHtml(s: string) { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
