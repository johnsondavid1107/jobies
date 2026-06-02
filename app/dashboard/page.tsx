'use client';

import { useCallback, useEffect, useState } from 'react';
import { GoogleDriveCard } from '@/components/GoogleDriveCard';
import { TemplateCard } from '@/components/TemplateCard';
import { JobSourcesCard } from '@/components/JobSourcesCard';
import { useJobRefresh, JobRefreshProgress } from '@/components/JobRefresh';

interface Totals {
  jobs_in_pool: number;
  seen: number;
  liked: number;
  skipped: number;
  saved: number;
  already_applied: number;
  applications: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface ByModel {
  provider: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface Stats {
  totals: Totals;
  by_model: ByModel[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/stats', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Reload stats once the refresh stream finishes so the pool/activity KPIs update.
  const { state: refreshState, start: refreshJobs, minimize, expand, dismiss } = useJobRefresh(loadStats);
  const refreshing = refreshState.phase === 'running';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Overview</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-ink/60">Swipe activity, LLM usage, and approximate cost.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadStats} disabled={loading} className="btn-secondary">
            {loading ? 'Loading…' : 'Refresh stats'}
          </button>
          <button onClick={refreshJobs} disabled={refreshing} className="btn-primary">
            {refreshing ? 'Fetching jobs…' : 'Refresh jobs'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-bad/20 bg-bad/5 px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      <JobRefreshProgress state={refreshState} minimize={minimize} expand={expand} dismiss={dismiss} />

      <GoogleDriveCard />

      <TemplateCard />

      <JobSourcesCard />

      {stats && (
        <>
          <section className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Activity</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Jobs in pool" value={stats.totals.jobs_in_pool} />
              <Kpi label="Seen" value={stats.totals.seen} />
              <Kpi label="Liked" value={stats.totals.liked} accent="ok" />
              <Kpi label="Skipped" value={stats.totals.skipped} accent="muted" />
              <Kpi label="Saved" value={stats.totals.saved} accent="accent" />
              <Kpi label="Applications" value={stats.totals.applications} accent="accent" />
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">LLM usage</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Kpi label="Input tokens" value={stats.totals.input_tokens.toLocaleString()} />
              <Kpi label="Output tokens" value={stats.totals.output_tokens.toLocaleString()} />
              <Kpi label="Approx. cost" value={`$${stats.totals.cost_usd.toFixed(4)}`} accent="accent" />
            </div>
            {stats.by_model.length > 0 ? (
              <div className="card overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-[0.12em] text-ink/55">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Provider</th>
                      <th className="px-4 py-2.5 font-medium">Model</th>
                      <th className="px-4 py-2.5 text-right font-medium">Calls</th>
                      <th className="px-4 py-2.5 text-right font-medium">Input</th>
                      <th className="px-4 py-2.5 text-right font-medium">Output</th>
                      <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.by_model.map((m) => (
                      <tr key={`${m.provider}:${m.model}`} className="border-t border-ink/5">
                        <td className="px-4 py-2.5 capitalize">{m.provider}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-ink/75">{m.model}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{m.calls.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{m.input_tokens.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{m.output_tokens.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">${m.cost_usd.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink/50">
                No tracked AI calls yet. Token tracking starts logging on the next scoring or resume operation.
              </p>
            )}
            <p className="text-xs text-ink/40">
              Costs are approximate, based on public list prices. Update{' '}
              <code className="rounded bg-ink/[0.06] px-1 py-0.5 font-mono text-[11px]">lib/dashboard/pricing.ts</code>{' '}
              when rates change.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

type KpiAccent = 'default' | 'ok' | 'accent' | 'muted';

function Kpi({ label, value, accent = 'default' }: { label: string; value: number | string; accent?: KpiAccent }) {
  const valueColor =
    accent === 'ok' ? 'text-ok' : accent === 'accent' ? 'text-accent' : accent === 'muted' ? 'text-ink/55' : 'text-ink';
  return (
    <div
      className="card p-4 transition-shadow duration-200"
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${valueColor}`}>{value}</div>
    </div>
  );
}
