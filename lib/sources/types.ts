export interface RawJob {
  source: string;
  source_job_id: string;
  title: string;
  company?: string | null;
  description?: string | null;
  url?: string | null;
  location?: string | null;
  remote_type?: 'remote' | 'hybrid' | 'onsite' | 'unknown' | null;
  salary_min?: number | null;
  salary_max?: number | null;
  date_posted?: string | null;
  raw_data_json?: Record<string, unknown> | null;
}

export interface JobSourceAdapter {
  id: string;
  name: string;
  fetch(config: any): Promise<RawJob[]>;
}
