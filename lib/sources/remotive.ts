import { JobSourceAdapter, RawJob } from './types';

interface Config {
  // Remotive supports category and search filters; if omitted, returns all listings.
  category?: string;
  search?: string;
  limit?: number;
}

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

export const remotiveAdapter: JobSourceAdapter = {
  id: 'remotive',
  name: 'Remotive',
  async fetch(config: Config) {
    const params = new URLSearchParams();
    if (config?.category) params.set('category', config.category);
    if (config?.search) params.set('search', config.search);
    if (config?.limit) params.set('limit', String(config.limit));
    const qs = params.toString();
    const url = `https://remotive.com/api/remote-jobs${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: { 'user-agent': 'jobies/0.1' } });
    if (!res.ok) throw new Error(`Remotive ${res.status}`);
    const data = (await res.json()) as { jobs: RemotiveJob[] };
    const out: RawJob[] = [];
    for (const j of data.jobs || []) {
      out.push({
        source: 'remotive',
        source_job_id: String(j.id),
        title: j.title,
        company: j.company_name,
        description: stripHtml(j.description || ''),
        url: j.url,
        location: j.candidate_required_location || 'Remote',
        remote_type: 'remote',
        ...parseSalary(j.salary),
        date_posted: j.publication_date || null,
        raw_data_json: j as unknown as Record<string, unknown>,
      });
    }
    return out;
  },
};

function stripHtml(s: string) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSalary(s: string | null | undefined): { salary_min: number | null; salary_max: number | null } {
  if (!s) return { salary_min: null, salary_max: null };
  const nums = s.replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return { salary_min: null, salary_max: null };
  const vals = nums.map(Number).map((n) => (s.toLowerCase().includes('k') && n < 1000 ? n * 1000 : n));
  if (vals.length === 1) return { salary_min: vals[0], salary_max: vals[0] };
  return { salary_min: Math.min(...vals), salary_max: Math.max(...vals) };
}
