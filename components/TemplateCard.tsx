'use client';
import { useCallback, useEffect, useState } from 'react';

interface Status {
  exists: boolean;
  configured?: boolean;
  filename?: string;
  uploaded_at?: string;
  download_url?: string | null;
  docs_url?: string | null;
}

/**
 * Dashboard card for the persisted résumé template. Confirms at a glance which
 * template is loaded (it survives restarts) and offers a download + a Google
 * Docs view. The LLM tailors content from your master résumé; this template is
 * the .docx design that content is rendered into.
 */
export function TemplateCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/resume/template-status', { cache: 'no-store' });
      setStatus(await res.json());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openInDocs = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch('/api/resume/template-open-in-docs', { method: 'POST' });
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j.error || 'Could not open in Docs');
      window.open(j.url, '_blank', 'noopener');
      setStatus((s) => (s ? { ...s, docs_url: j.url } : s));
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setOpening(false);
    }
  }, []);

  return (
    <section className="space-y-3">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Résumé template</div>
      <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">
              {status?.exists ? status.filename : 'No template uploaded'}
            </span>
            {status?.exists && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-ok" />
                Loaded
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink/55">
            {loading && !status
              ? 'Checking…'
              : status?.exists
              ? `Tailored résumés render into this design${
                  status.uploaded_at ? ` · uploaded ${new Date(status.uploaded_at).toLocaleDateString()}` : ''
                }`
              : 'Upload a .docx template on the Resume page — it persists across restarts.'}
          </p>
          {error && <p className="mt-1 text-xs font-medium text-bad">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary text-xs">
            {loading ? 'Checking…' : 'Recheck'}
          </button>
          {status?.exists && status.download_url && (
            <a href={status.download_url} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
              Download
            </a>
          )}
          {status?.exists && (
            <button onClick={openInDocs} disabled={opening} className="btn-primary text-xs">
              {opening ? 'Opening…' : 'Open in Docs'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
