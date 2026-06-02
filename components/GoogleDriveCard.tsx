'use client';
import { useCallback, useEffect, useState } from 'react';

interface Status {
  configured: boolean;
  connected: boolean;
  live: boolean;
  email: string | null;
  source: 'db' | 'env' | null;
  detail: string | null;
}

type Tone = 'ok' | 'warn' | 'bad' | 'muted';

function chip(status: Status | null): { tone: Tone; label: string } {
  if (!status) return { tone: 'muted', label: 'Checking…' };
  if (!status.configured) return { tone: 'muted', label: 'Not configured' };
  if (!status.connected) return { tone: 'warn', label: 'Not connected' };
  if (!status.live) return { tone: 'bad', label: 'Token expired' };
  return { tone: 'ok', label: 'Connected' };
}

const TONE: Record<Tone, string> = {
  ok: 'bg-ok/10 text-ok',
  warn: 'bg-warn/10 text-warn',
  bad: 'bg-bad/10 text-bad',
  muted: 'bg-ink/[0.06] text-ink/55',
};
const DOT: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', muted: 'bg-ink/40' };

export function GoogleDriveCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/google/status', { cache: 'no-store' });
      setStatus(await res.json());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Surface the OAuth callback result (?google=connected|error) once on mount.
    const p = new URLSearchParams(window.location.search);
    const g = p.get('google');
    if (g === 'connected') setFlash('Google Drive connected.');
    else if (g === 'error') setFlash(`Connection failed${p.get('detail') ? ` — ${p.get('detail')}` : ''}.`);
    if (g) window.history.replaceState({}, '', window.location.pathname);
  }, [load]);

  const c = chip(status);
  const canConnect = status?.configured;
  const isConnected = status?.connected;

  return (
    <section className="space-y-3">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Integrations</div>
      <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">Google Drive</span>
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${TONE[c.tone]}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[c.tone]}`} />
              {loading && !status ? 'Checking…' : c.label}
            </span>
            {status?.source === 'env' && status.connected && (
              <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 text-[10px] text-ink/50">via env</span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink/55">
            {!status?.configured
              ? 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then connect.'
              : status?.live
              ? `Powers tailored-résumé PDF conversion & Edit-in-Docs${status.email ? ` · ${status.email}` : ''}`
              : status?.connected
              ? status.detail || 'Reconnect to restore Drive features.'
              : 'Connect your Google account to enable PDF conversion & Edit-in-Docs.'}
          </p>
          {flash && <p className="mt-1 text-xs font-medium text-ink/70">{flash}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary text-xs">
            {loading ? 'Checking…' : 'Recheck'}
          </button>
          {canConnect && (
            <a href="/api/google/auth/start" className="btn-primary text-xs">
              {isConnected ? 'Reconnect' : 'Connect Google Drive'}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
