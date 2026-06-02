import { supabaseAdmin } from '@/lib/supabase/server';
import { getEnabledSources, configureFromEnv } from '@/lib/sources/registry';
import { scoreAndPersist } from '@/lib/scoring/score';
import { isLocationEligible } from '@/lib/db/queue';
import type { RawJob } from '@/lib/sources/types';
import type { RefreshEvent, SourceSummary } from '@/lib/jobs/refresh-events';

export const runtime = 'nodejs';
export const maxDuration = 300;

const CHUNK = 150;

// Streams newline-delimited JSON RefreshEvents so the dashboard can show live
// per-stage progress instead of a single opaque "Fetching jobs…" spinner.
export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: RefreshEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
        } catch {
          // controller already closed (client disconnected) — ignore.
        }
      };

      try {
        const sb = supabaseAdmin();
        const sources = (await getEnabledSources()).filter(
          ({ adapter }) => adapter.id !== 'manual' && adapter.id !== 'wtj'
        );

        const poolBefore = await countJobs(sb);
        send({ type: 'init', sources: sources.map((s) => s.adapter.id), poolBefore });

        const summary: Record<string, SourceSummary> = {};

        for (const { row, adapter } of sources) {
          const key = adapter.id;
          const acc: SourceSummary = { fetched: 0, added: 0, eligible: 0, scored: 0, errors: 0 };
          summary[key] = acc;
          send({ type: 'source_start', source: key });

          // ── Stage 1: fetch from the external source ──────────────────────
          const config = configureFromEnv(row.name, row.config_json);
          let jobs: RawJob[] = [];
          try {
            jobs = await adapter.fetch(config);
          } catch (e: any) {
            acc.errors++;
            acc.note = `fetch failed: ${e?.message || String(e)}`;
            send({ type: 'source_done', source: key, summary: acc });
            continue;
          }
          acc.fetched = jobs.length;
          send({ type: 'fetched', source: key, fetched: jobs.length });
          if (jobs.length === 0) {
            send({ type: 'source_done', source: key, summary: acc });
            continue;
          }

          // ── Stage 2: dedup — which postings are already in the pool ──────
          // One batched query per CHUNK instead of a round-trip per posting.
          const existing = new Set<string>();
          for (const batch of chunk(jobs, CHUNK)) {
            const { data } = await sb
              .from('jobs')
              .select('source_job_id')
              .eq('source', key)
              .in('source_job_id', batch.map((j) => j.source_job_id));
            for (const r of data || []) existing.add(r.source_job_id);
          }

          // ── Stage 3: upsert (insert new + refresh existing) ──────────────
          const upserted: any[] = [];
          for (const batch of chunk(jobs, CHUNK)) {
            const { data, error } = await sb
              .from('jobs')
              .upsert(batch.map(toRow), { onConflict: 'source,source_job_id' })
              .select();
            if (error) {
              acc.errors++;
              if (!acc.note) acc.note = `upsert failed: ${error.message}`;
              continue;
            }
            upserted.push(...(data || []));
          }

          // Count net-new + how many of those pass the swipe location filter.
          const bySrcId = new Map(upserted.map((r) => [r.source_job_id, r]));
          for (const raw of jobs) {
            if (existing.has(raw.source_job_id)) continue;
            acc.added++;
            const r = bySrcId.get(raw.source_job_id);
            if (r && isLocationEligible(r.remote_type, r.location, r.description)) acc.eligible++;
          }

          // ── Stage 4: score postings that don't have a score yet ──────────
          // Gate scoring behind the same location filter the swipe queue uses
          // at read time: store everything (cheap, reversible — the regex can be
          // re-tuned and these rescored later), but only spend LLM tokens on jobs
          // that can actually surface in the deck. Ineligible postings stay
          // unscored until the filter loosens.
          const eligibleToScore = upserted.filter((r) =>
            isLocationEligible(r.remote_type, r.location, r.description)
          );
          const scoredIds = new Set<string>();
          const allIds = eligibleToScore.map((r) => r.id);
          for (const batch of chunk(allIds, CHUNK)) {
            const { data } = await sb.from('job_scores').select('job_id').in('job_id', batch);
            for (const r of data || []) scoredIds.add(r.job_id);
          }
          const toScore = eligibleToScore.filter((r) => !scoredIds.has(r.id));

          let processed = 0;
          for (const job of toScore) {
            try {
              await scoreAndPersist(job);
              acc.scored++;
            } catch (e: any) {
              acc.errors++;
              if (!acc.note) acc.note = `scoring failed: ${e?.message || String(e)}`;
            }
            processed++;
            if (processed % 3 === 0 || processed === toScore.length) {
              send({
                type: 'progress',
                source: key,
                processed,
                total: toScore.length,
                added: acc.added,
                eligible: acc.eligible,
                scored: acc.scored,
                errors: acc.errors,
              });
            }
          }

          send({ type: 'source_done', source: key, summary: acc });
        }

        const poolAfter = await countJobs(sb);
        const totals = Object.values(summary).reduce(
          (t, s) => ({
            added: t.added + s.added,
            eligible: t.eligible + s.eligible,
            scored: t.scored + s.scored,
            errors: t.errors + s.errors,
          }),
          { added: 0, eligible: 0, scored: 0, errors: 0 }
        );

        send({
          type: 'done',
          poolBefore,
          poolAfter,
          added: totals.added,
          eligible: totals.eligible,
          scored: totals.scored,
          errors: totals.errors,
          summary,
        });
      } catch (e: any) {
        send({ type: 'error', message: e?.message || String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
    },
  });
}

function toRow(raw: RawJob) {
  return {
    source: raw.source,
    source_job_id: raw.source_job_id,
    title: raw.title,
    company: raw.company,
    description: raw.description,
    url: raw.url,
    location: raw.location,
    remote_type: raw.remote_type,
    salary_min: raw.salary_min,
    salary_max: raw.salary_max,
    date_posted: raw.date_posted,
    raw_data_json: raw.raw_data_json,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function countJobs(sb: ReturnType<typeof supabaseAdmin>): Promise<number> {
  const { count } = await sb.from('jobs').select('*', { count: 'exact', head: true });
  return count ?? 0;
}
