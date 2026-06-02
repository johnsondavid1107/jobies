// Wire protocol shared between the streaming /api/jobs/refresh route and the
// dashboard progress UI. The route emits these as newline-delimited JSON
// (one object per line); the client parses them to drive the progress modal.

export interface SourceSummary {
  fetched: number; // raw postings returned by the source
  added: number; // net-new rows inserted into the jobs pool (after dedup)
  eligible: number; // of the new rows, how many pass the swipe location filter
  scored: number; // new rows that got an AI score this run
  errors: number; // failures (fetch, upsert, or scoring)
  note?: string; // first human-readable error/skip reason, if any
}

export type RefreshEvent =
  | { type: 'init'; sources: string[]; poolBefore: number }
  | { type: 'source_start'; source: string }
  | { type: 'fetched'; source: string; fetched: number }
  | {
      type: 'progress';
      source: string;
      processed: number;
      total: number;
      added: number;
      eligible: number;
      scored: number;
      errors: number;
    }
  | { type: 'source_done'; source: string; summary: SourceSummary }
  | {
      type: 'done';
      poolBefore: number;
      poolAfter: number;
      added: number;
      eligible: number;
      scored: number;
      errors: number;
      summary: Record<string, SourceSummary>;
    }
  | { type: 'error'; message: string };
