import { JobSourceAdapter, RawJob } from './types';

// Welcome to the Jungle does not expose a free public job-search API.
// This stub is intentionally inert; to enable, supply an Apify actor token
// (APIFY_API_TOKEN) and wire an Apify dataset call here, or use WTJ's partner
// API if you have credentials. Left disabled by default in job_sources.
export const wtjAdapter: JobSourceAdapter = {
  id: 'wtj',
  name: 'Welcome to the Jungle (stub)',
  async fetch(_config: any): Promise<RawJob[]> {
    return [];
  },
};
