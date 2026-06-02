'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResumeVersionRow } from '@/lib/db/resume-versions';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function VersionRow({ v }: { v: ResumeVersionRow }) {
  const router = useRouter();
  const [used, setUsed] = useState(v.used_to_apply);
  const [notes, setNotes] = useState(v.notes || '');
  const [saving, setSaving] = useState(false);
  const [docsBusy, setDocsBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [docsErr, setDocsErr] = useState<string | null>(null);

  async function save(patch: Record<string, any>) {
    setSaving(true);
    try {
      await fetch(`/api/resume-versions/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } finally {
      setSaving(false);
    }
  }

  async function openInDocs() {
    setDocsErr(null);
    setDocsBusy(true);
    try {
      const res = await fetch(`/api/resume-versions/${v.id}/open-in-docs`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open in Docs');
      window.open(data.url, '_blank', 'noopener,noreferrer');
      if (!v.google_drive_file_id) router.refresh();
    } catch (e: any) {
      setDocsErr(e.message);
    } finally {
      setDocsBusy(false);
    }
  }

  async function syncFromDocs() {
    setDocsErr(null);
    setSyncBusy(true);
    try {
      const res = await fetch(`/api/resume-versions/${v.id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      router.refresh();
    } catch (e: any) {
      setDocsErr(e.message);
    } finally {
      setSyncBusy(false);
    }
  }

  const before = v.match_score_before != null ? Math.round(v.match_score_before * 100) : null;
  const after = v.match_score_after != null ? Math.round(v.match_score_after * 100) : null;
  const delta = before != null && after != null ? after - before : null;

  return (
    <tr className="border-t border-ink/5 align-top">
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5">
          {v.company || '—'}
          {v.parent_version_id && (
            <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent" title="Synced from an edited Google Doc">
              ↳ edit
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3">{v.role || '—'}</td>
      <td className="px-4 py-3 text-xs tabular-nums text-ink/65">
        {new Date(v.created_at).toLocaleDateString()}
        {v.last_synced_at && (
          <span className="mt-0.5 block text-[10px] text-accent/80">edited · {relativeTime(v.last_synced_at)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <span className="text-ink/55">{before != null ? `${before}%` : '—'}</span>
          <span className="text-ink/30">→</span>
          <span className="font-medium text-ink">{after != null ? `${after}%` : '—'}</span>
          {delta != null && delta !== 0 && (
            <span className={'rounded-md px-1.5 py-0.5 text-[10px] font-semibold ' + (
              delta > 0 ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'
            )}>
              {delta > 0 ? '+' : ''}{delta}
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-ink/70">
        {v.keywords_emphasized_json?.slice(0, 6).join(', ') || '—'}
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {v.docx_url && <a className="text-accent hover:underline" href={v.docx_url} target="_blank" rel="noreferrer">DOCX</a>}
          {v.pdf_url && <a className="text-accent hover:underline" href={v.pdf_url} target="_blank" rel="noreferrer">PDF</a>}
          <button
            type="button"
            className="text-ink/70 hover:text-ink hover:underline disabled:opacity-50"
            onClick={openInDocs}
            disabled={docsBusy}
          >
            {docsBusy ? 'Opening…' : 'Edit in Docs'}
          </button>
          {v.google_drive_file_id && (
            <button
              type="button"
              className="text-ink/70 hover:text-ink hover:underline disabled:opacity-50"
              onClick={syncFromDocs}
              disabled={syncBusy}
            >
              {syncBusy ? 'Syncing…' : 'Sync'}
            </button>
          )}
        </div>
        {docsErr && <div className="mt-1 text-[11px] text-bad">{docsErr}</div>}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          className="toggle-pill text-xs"
          data-on={used}
          onClick={() => { const v2 = !used; setUsed(v2); save({ used_to_apply: v2 }); }}
        >
          {used ? 'Used' : 'Mark used'}
        </button>
      </td>
      <td className="px-4 py-3">
        <input
          className="input text-xs"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => save({ notes })}
          placeholder="Notes"
        />
        {saving && <span className="ml-2 text-xs text-ink/50">saving…</span>}
      </td>
    </tr>
  );
}
