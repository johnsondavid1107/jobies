'use client';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

export type TailorToastState =
  | { status: 'loading'; label: string }
  | { status: 'success'; label: string; href?: string; delta?: string; docHref?: string }
  | { status: 'warning'; label: string; docHref?: string }
  | { status: 'error'; label: string };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// Indeterminate circular spinner. (A real percentage would require the
// /api/resume/generate route to stream progress events — deferred for now.)
function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Dot({ tone }: { tone: 'ok' | 'warn' | 'bad' }) {
  const cls = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-bad';
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} />;
}

/**
 * Floating status toast for the résumé tailor flow. Fixed under the nav bar on
 * the upper-left so it's never clipped by a card's `overflow-hidden`.
 */
export function TailorToast({
  state,
  onClose,
}: {
  state: TailorToastState | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {state && (
        <motion.div
          key="tailor-toast"
          className="fixed left-4 top-[68px] z-40 w-[320px] max-w-[calc(100vw-2rem)]"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: EASE_OUT } }}
          exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18 } }}
          role="status"
          aria-live="polite"
        >
          <div className="card flex items-start gap-3 p-3.5 shadow-card-lift">
            <span className="mt-0.5">
              {state.status === 'loading' && <Spinner />}
              {state.status === 'success' && <Dot tone="ok" />}
              {state.status === 'warning' && <Dot tone="warn" />}
              {state.status === 'error' && <Dot tone="bad" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug tracking-tight">
                {state.status === 'loading' && 'Tailoring résumé…'}
                {state.status === 'success' && 'Résumé tailored'}
                {state.status === 'warning' && 'Tailored — with a warning'}
                {state.status === 'error' && 'Tailor failed'}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-black/60">{state.label}</p>
              {state.status === 'success' && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {state.delta && (
                    <span className="rounded bg-ok/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ok">
                      {state.delta}
                    </span>
                  )}
                  <Link
                    href={state.href || '/resume-versions'}
                    className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                  >
                    View in Resume versions ↗
                  </Link>
                  {state.docHref && (
                    <a
                      href={state.docHref}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                    >
                      Open in Google Docs ↗
                    </a>
                  )}
                </div>
              )}
              {state.status === 'warning' && state.docHref && (
                <a
                  href={state.docHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-xs font-medium text-accent underline-offset-2 hover:underline"
                >
                  Open in Google Docs ↗
                </a>
              )}
            </div>
            {state.status !== 'loading' && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 shrink-0 rounded p-1 text-black/35 transition-colors hover:bg-black/[0.05] hover:text-black/60"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
