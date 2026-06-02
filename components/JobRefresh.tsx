'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import type { RefreshEvent, SourceSummary } from '@/lib/jobs/refresh-events';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type SourceStatus = 'pending' | 'fetching' | 'scoring' | 'done' | 'error';

interface SourceState extends SourceSummary {
  name: string;
  status: SourceStatus;
  total: number;
  processed: number;
}

type Phase = 'idle' | 'running' | 'done' | 'error';

interface RefreshState {
  phase: Phase;
  minimized: boolean;
  sources: SourceState[];
  poolBefore: number | null;
  added: number;
  eligible: number;
  scored: number;
  errors: number;
  errorMessage: string | null;
}

const INITIAL: RefreshState = {
  phase: 'idle',
  minimized: false,
  sources: [],
  poolBefore: null,
  added: 0,
  eligible: 0,
  scored: 0,
  errors: 0,
  errorMessage: null,
};

function emptySource(name: string): SourceState {
  return { name, status: 'pending', total: 0, processed: 0, fetched: 0, added: 0, eligible: 0, scored: 0, errors: 0 };
}

export function useJobRefresh(onComplete?: () => void) {
  const [state, setState] = useState<RefreshState>(INITIAL);
  const running = useRef(false);

  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setState({ ...INITIAL, phase: 'running' });

    const apply = (fn: (s: RefreshState) => RefreshState) => setState(fn);
    const patchSource = (name: string, patch: Partial<SourceState>) =>
      apply((s) => ({
        ...s,
        sources: s.sources.map((src) => (src.name === name ? { ...src, ...patch } : src)),
      }));

    try {
      const res = await fetch('/api/jobs/refresh', { method: 'POST' });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      const handle = (e: RefreshEvent) => {
        switch (e.type) {
          case 'init':
            apply((s) => ({ ...s, poolBefore: e.poolBefore, sources: e.sources.map(emptySource) }));
            break;
          case 'source_start':
            patchSource(e.source, { status: 'fetching' });
            break;
          case 'fetched':
            patchSource(e.source, { fetched: e.fetched, status: e.fetched > 0 ? 'scoring' : 'done' });
            break;
          case 'progress':
            patchSource(e.source, {
              processed: e.processed,
              total: e.total,
              added: e.added,
              eligible: e.eligible,
              scored: e.scored,
              errors: e.errors,
              status: 'scoring',
            });
            break;
          case 'source_done':
            patchSource(e.source, { ...e.summary, status: e.summary.note && e.summary.fetched === 0 ? 'error' : 'done' });
            break;
          case 'done':
            apply((s) => ({
              ...s,
              phase: 'done',
              added: e.added,
              eligible: e.eligible,
              scored: e.scored,
              errors: e.errors,
            }));
            break;
          case 'error':
            apply((s) => ({ ...s, phase: 'error', errorMessage: e.message }));
            break;
        }
      };

      // Read the NDJSON stream line by line.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) {
            try {
              handle(JSON.parse(line) as RefreshEvent);
            } catch {
              /* skip malformed line */
            }
          }
        }
      }
    } catch (e: any) {
      apply((s) => ({ ...s, phase: 'error', errorMessage: e?.message || String(e) }));
    } finally {
      running.current = false;
      onComplete?.();
    }
  }, [onComplete]);

  const minimize = useCallback(() => setState((s) => ({ ...s, minimized: true })), []);
  const expand = useCallback(() => setState((s) => ({ ...s, minimized: false })), []);
  const dismiss = useCallback(() => setState(INITIAL), []);

  return { state, start, minimize, expand, dismiss };
}

// ── UI ────────────────────────────────────────────────────────────────────

export function JobRefreshProgress({
  state,
  minimize,
  expand,
  dismiss,
}: {
  state: RefreshState;
  minimize: () => void;
  expand: () => void;
  dismiss: () => void;
}) {
  const { phase } = state;
  if (phase === 'idle') return null;

  // Completed / failed → fixed toast. Running + minimized → fixed progress toast.
  if (phase === 'done') return <CompletionToast state={state} dismiss={dismiss} />;
  if (phase === 'error') return <ErrorToast state={state} dismiss={dismiss} />;
  if (state.minimized) return <ProgressToast state={state} expand={expand} />;

  // Running + expanded → focused modal.
  return <ProgressModal state={state} onClickOut={minimize} />;
}

function ProgressModal({ state, onClickOut }: { state: RefreshState; onClickOut: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClickOut} aria-hidden />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Fetching jobs"
          className="card relative z-10 w-[440px] max-w-[calc(100vw-2rem)] p-5 shadow-card-lift"
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: EASE_OUT } }}
          exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.16 } }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Spinner />
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Fetching jobs</h2>
                <p className="text-xs text-black/55">Pulling postings, deduping, and scoring against your résumé.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClickOut}
              className="-mr-1 -mt-1 shrink-0 rounded p-1 text-xs font-medium text-black/45 transition-colors hover:bg-black/[0.05] hover:text-black/70"
            >
              Run in background
            </button>
          </div>

          <ul className="mt-4 space-y-1.5">
            {state.sources.length === 0 && (
              <li className="text-xs text-black/50">Starting…</li>
            )}
            {state.sources.map((s) => (
              <SourceRow key={s.name} s={s} />
            ))}
          </ul>

          <div className="mt-4 border-t border-black/[0.06] pt-3 text-xs text-black/60">
            <span className="font-medium text-black/75 tabular-nums">{state.added}</span> new ·{' '}
            <span className="font-medium text-ok tabular-nums">{state.eligible}</span> match your filters
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SourceRow({ s }: { s: SourceState }) {
  const pct = s.total > 0 ? Math.round((s.processed / s.total) * 100) : s.status === 'done' ? 100 : 0;
  return (
    <li className="rounded-lg bg-black/[0.02] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusGlyph status={s.status} />
          <span className="text-sm font-medium capitalize tracking-tight">{s.name}</span>
        </div>
        <span className="text-[11px] tabular-nums text-black/50">
          {s.status === 'fetching' && 'fetching…'}
          {s.status === 'scoring' && (s.total > 0 ? `scoring ${s.processed}/${s.total}` : `${s.fetched} fetched`)}
          {s.status === 'done' && `${s.added} new`}
          {s.status === 'error' && 'error'}
          {s.status === 'pending' && 'queued'}
        </span>
      </div>
      {(s.status === 'scoring' || s.status === 'done') && s.total > 0 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${s.status === 'done' ? 'bg-ok' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {s.note && <p className="mt-1 text-[11px] leading-snug text-bad/80">{s.note}</p>}
    </li>
  );
}

function ProgressToast({ state, expand }: { state: RefreshState; expand: () => void }) {
  const active = state.sources.find((s) => s.status === 'scoring' || s.status === 'fetching');
  return (
    <FixedToast>
      <button type="button" onClick={expand} className="flex w-full items-start gap-3 text-left">
        <span className="mt-0.5">
          <Spinner />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug tracking-tight">Fetching jobs…</p>
          <p className="mt-0.5 truncate text-xs text-black/60">
            {active ? `${active.name} · ${active.processed}/${active.total}` : 'Working…'} ·{' '}
            <span className="text-ok">{state.eligible}</span> match so far
          </p>
          <p className="mt-1 text-[11px] font-medium text-accent">Tap to expand ↗</p>
        </div>
      </button>
    </FixedToast>
  );
}

function CompletionToast({ state, dismiss }: { state: RefreshState; dismiss: () => void }) {
  return (
    <FixedToast tone="ok">
      <span className="mt-0.5">
        <Dot tone="ok" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug tracking-tight text-ok">Jobs refreshed</p>
        <p className="mt-0.5 text-xs leading-relaxed text-black/65">
          <span className="font-medium tabular-nums">{state.added}</span> new job{state.added === 1 ? '' : 's'} added
          {state.added > 0 ? (
            <>
              {' '}— <span className="font-medium tabular-nums text-ok">{state.eligible}</span> match your filters.
            </>
          ) : (
            '.'
          )}{' '}
          Refresh the swipe screen to see them.
        </p>
        {state.errors > 0 && (
          <p className="mt-0.5 text-[11px] text-black/45">{state.errors} item(s) had errors — see sources above.</p>
        )}
        <Link
          href="/swipe"
          className="mt-1.5 inline-block text-xs font-medium text-accent underline-offset-2 hover:underline"
        >
          Go to swipe deck ↗
        </Link>
      </div>
      <DismissButton onClick={dismiss} />
    </FixedToast>
  );
}

function ErrorToast({ state, dismiss }: { state: RefreshState; dismiss: () => void }) {
  return (
    <FixedToast tone="bad">
      <span className="mt-0.5">
        <Dot tone="bad" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug tracking-tight text-bad">Refresh failed</p>
        <p className="mt-0.5 text-xs leading-relaxed text-black/65">{state.errorMessage || 'Something went wrong.'}</p>
      </div>
      <DismissButton onClick={dismiss} />
    </FixedToast>
  );
}

// ── primitives ──────────────────────────────────────────────────────────────

function FixedToast({ children, tone }: { children: React.ReactNode; tone?: 'ok' | 'bad' }) {
  const ring = tone === 'ok' ? 'ring-1 ring-ok/20' : tone === 'bad' ? 'ring-1 ring-bad/20' : '';
  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-4 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)]"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: EASE_OUT } }}
        exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } }}
        role="status"
        aria-live="polite"
      >
        <div className={`card flex items-start gap-3 p-3.5 shadow-card-lift ${ring}`}>{children}</div>
      </motion.div>
    </AnimatePresence>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss"
      className="-mr-1 -mt-1 shrink-0 rounded p-1 text-black/35 transition-colors hover:bg-black/[0.05] hover:text-black/60"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function StatusGlyph({ status }: { status: SourceStatus }) {
  if (status === 'done') return <Check />;
  if (status === 'error') return <Dot tone="bad" />;
  if (status === 'pending') return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-black/15" />;
  return <Spinner small />;
}

function Spinner({ small }: { small?: boolean }) {
  const size = small ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <svg className={`${size} animate-spin text-accent`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="h-4 w-4 text-ok" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dot({ tone }: { tone: 'ok' | 'warn' | 'bad' }) {
  const cls = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-bad';
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} />;
}
