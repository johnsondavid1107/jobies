'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { QueueJob } from '@/lib/db/queue';
import { SwipeAction } from '@/lib/db/types';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

// Direction-aware exit: matches the gesture or shortcut that caused it.
function exitFor(action: SwipeAction | null) {
  switch (action) {
    case 'rejected':
      return { x: -520, y: 40, rotate: -18, opacity: 0 };
    case 'interested':
      return { x: 520, y: 40, rotate: 18, opacity: 0 };
    case 'save_for_later':
      return { x: 0, y: -560, rotate: 0, opacity: 0 };
    case 'already_applied':
      return { x: 0, y: 560, rotate: 0, opacity: 0 };
    default:
      return { x: 0, y: 40, opacity: 0 };
  }
}

export function SwipeDeck({ initial }: { initial: QueueJob[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<SwipeAction | null>(null);

  const current = jobs[0];

  const act = useCallback(
    async (action: SwipeAction) => {
      if (!current || busy) return;
      setBusy(true);
      setLastAction(action);
      setJobs((prev) => prev.slice(1));
      try {
        await fetch('/api/swipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: current.id, action }),
        });
      } finally {
        setBusy(false);
      }
    },
    [current, busy]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') act('rejected');
      else if (e.key === 'ArrowRight') act('interested');
      else if (e.key === 'ArrowUp') act('save_for_later');
      else if (e.key === 'ArrowDown') act('already_applied');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  async function refresh() {
    setBusy(true);
    try {
      await fetch('/api/jobs/refresh', { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!current) {
    return (
      <div className="card mx-auto max-w-xl p-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] text-2xl">
          ✓
        </div>
        <p className="text-lg font-semibold tracking-tight">You're all caught up.</p>
        <p className="mt-1 text-sm text-black/55">
          Import a job manually or fetch from your enabled sources.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn-primary" onClick={refresh} disabled={busy}>
            {busy ? 'Refreshing…' : 'Refresh jobs now'}
          </button>
          <a className="btn-secondary" href="/import">Import a job</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-black/55">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-ok" />
          <span className="tabular-nums">{jobs.length} in queue</span>
        </div>
        <button className="btn-secondary" onClick={refresh} disabled={busy}>
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="relative mx-auto h-[580px] max-w-xl">
        <AnimatePresence custom={lastAction} initial={false}>
          {jobs
            .slice(0, 3)
            .reverse()
            .map((job, idx, arr) => {
              const stackDepth = arr.length - 1 - idx;
              const isTop = stackDepth === 0;
              return (
                <SwipeCard
                  key={job.id}
                  job={job}
                  isTop={isTop}
                  stackDepth={stackDepth}
                  onSwipe={isTop ? act : undefined}
                  setLastAction={setLastAction}
                />
              );
            })}
        </AnimatePresence>
      </div>
      <div className="flex justify-center gap-2">
        <button className="btn-danger" onClick={() => act('rejected')} aria-label="Reject">
          <span className="mr-1.5">←</span> Skip
        </button>
        <button className="btn-secondary" onClick={() => act('save_for_later')} aria-label="Save">
          <span className="mr-1.5">↑</span> Save
        </button>
        <button className="btn-secondary" onClick={() => act('already_applied')} aria-label="Already applied">
          <span className="mr-1.5">↓</span> Applied
        </button>
        <button className="btn-primary" onClick={() => act('interested')} aria-label="Interested">
          Interested <span className="ml-1.5">→</span>
        </button>
      </div>
      <p className="text-center text-[11px] uppercase tracking-wider text-black/35">
        ← skip · → interested · ↑ save · ↓ applied
      </p>
    </div>
  );
}

function scoreTone(score: number | null) {
  if (score == null) return { ring: 'ring-black/15', text: 'text-black/55', label: '—' };
  const pct = Math.round(score * 100);
  if (pct >= 75) return { ring: 'ring-ok/40', text: 'text-ok', label: `${pct}%` };
  if (pct >= 55) return { ring: 'ring-accent/40', text: 'text-accent', label: `${pct}%` };
  return { ring: 'ring-black/15', text: 'text-black/55', label: `${pct}%` };
}

function SwipeCard({
  job,
  isTop,
  stackDepth,
  onSwipe,
  setLastAction,
}: {
  job: QueueJob;
  isTop: boolean;
  stackDepth: number;
  onSwipe?: (a: SwipeAction) => void;
  setLastAction: (a: SwipeAction) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);

  // Drag intent overlays: fade in as the user crosses the commit zone.
  const skipOpacity = useTransform(x, [-180, -60, 0], [1, 0.2, 0]);
  const interestedOpacity = useTransform(x, [0, 60, 180], [0, 0.2, 1]);
  const saveOpacity = useTransform(y, [-180, -60, 0], [1, 0.2, 0]);

  const tone = scoreTone(job.final_score);

  // Stack repositioning animates when depth changes (top card leaves → next promotes).
  const targetY = stackDepth * 10;
  const targetScale = 1 - stackDepth * 0.04;

  useMotionValueEvent(x, 'change', () => {
    /* keep motion value subscribed so the transform updates */
  });

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - stackDepth }}
      initial={{ opacity: 0, scale: 0.94, y: targetY + 12 }}
      animate={{
        opacity: 1,
        scale: targetScale,
        y: targetY,
        transition: { duration: 0.45, ease: EASE_OUT },
      }}
      variants={{
        exit: (action: SwipeAction | null) => ({
          ...exitFor(action),
          transition: { duration: 0.32, ease: EASE_IN_OUT },
        }),
      }}
      exit="exit"
    >
      <motion.div
        className={`card relative flex h-full flex-col overflow-hidden p-6 ${
          isTop ? 'shadow-card-lift' : 'shadow-card'
        }`}
        drag={isTop ? true : false}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.6}
        style={isTop ? { x, y, rotate } : undefined}
        whileTap={isTop ? { cursor: 'grabbing' } : undefined}
        onDragEnd={(_, info) => {
          if (!onSwipe) return;
          const vx = info.velocity.x;
          const vy = info.velocity.y;
          const dx = info.offset.x;
          const dy = info.offset.y;
          // Horizontal commit: distance OR velocity-based flick.
          if (dx > 130 || vx > 600) return onSwipe('interested');
          if (dx < -130 || vx < -600) return onSwipe('rejected');
          // Vertical save (up). Be more conservative on down to avoid scroll conflict.
          if (dy < -130 || vy < -600) return onSwipe('save_for_later');
        }}
      >
        {/* Drag intent overlays — only show for top card */}
        {isTop && (
          <>
            <motion.div
              className="pointer-events-none absolute left-5 top-5 rounded-md border-2 border-bad px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-bad"
              style={{ opacity: skipOpacity, transform: 'rotate(-8deg)' }}
            >
              Skip
            </motion.div>
            <motion.div
              className="pointer-events-none absolute right-5 top-5 rounded-md border-2 border-ok px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-ok"
              style={{ opacity: interestedOpacity, transform: 'rotate(8deg)' }}
            >
              Interested
            </motion.div>
            <motion.div
              className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-md border-2 border-accent px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-accent"
              style={{ opacity: saveOpacity }}
            >
              Save
            </motion.div>
          </>
        )}

        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-black/45">
              {job.company || 'Unknown company'}
            </p>
            <h2 className="mt-0.5 truncate text-xl font-semibold leading-tight tracking-tight">
              {job.title}
            </h2>
            <p className="mt-1 text-sm text-black/55">
              {job.location || 'Location not listed'}
              {job.remote_type && job.remote_type !== 'unknown' ? ` · ${job.remote_type}` : ''}
            </p>
          </div>
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold tabular-nums ring-2 ${tone.ring} ${tone.text}`}
            title="Match score"
          >
            {tone.label}
          </div>
        </header>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(job.salary_min || job.salary_max) && (
            <span className="rounded-md bg-black/[0.04] px-2 py-1 text-xs text-black/65">
              ${job.salary_min ? Math.round(job.salary_min / 1000) + 'k' : '?'} – $
              {job.salary_max ? Math.round(job.salary_max / 1000) + 'k' : '?'}
            </span>
          )}
          <span className="rounded-md bg-black/[0.04] px-2 py-1 text-xs text-black/55">
            via {job.source}
          </span>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md bg-black/[0.04] px-2 py-1 text-xs text-black/65 transition-colors duration-150 hover:bg-black/[0.08]"
            >
              Open posting ↗
            </a>
          )}
        </div>

        {job.ai_explanation && (
          <div className="mt-4 rounded-lg border border-accent/15 bg-accent/[0.04] p-3 text-sm leading-relaxed text-ink">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Why this fits
            </span>
            <p className="mt-1 text-black/80">{job.ai_explanation}</p>
          </div>
        )}

        {job.focus_suggestions && job.focus_suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-black/50">
              Application focus
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-black/70">
              {job.focus_suggestions.slice(0, 4).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-black/30" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 flex-1 overflow-auto rounded-lg bg-black/[0.02] p-3 text-xs leading-relaxed text-black/70">
          {job.description || '(no description)'}
        </div>
      </motion.div>
    </motion.div>
  );
}
