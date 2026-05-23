'use client';
import { useState } from 'react';
import { ResumeVersionRow } from '@/lib/db/resume-versions';

export function VersionRow({ v }: { v: ResumeVersionRow }) {
  const [used, setUsed] = useState(v.used_to_apply);
  const [notes, setNotes] = useState(v.notes || '');
  const [saving, setSaving] = useState(false);

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

  const before = v.match_score_before != null ? Math.round(v.match_score_before * 100) : null;
  const after = v.match_score_after != null ? Math.round(v.match_score_after * 100) : null;
  const delta = before != null && after != null ? after - before : null;

  return (
    <tr className="border-t border-ink/5 align-top">
      <td className="px-4 py-3">{v.company || '—'}</td>
      <td className="px-4 py-3">{v.role || '—'}</td>
      <td className="px-4 py-3 text-xs tabular-nums text-ink/65">
        {new Date(v.created_at).toLocaleDateString()}
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
      <td className="px-4 py-3 space-x-3 text-sm">
        {v.docx_url && <a className="text-accent hover:underline" href={v.docx_url} target="_blank" rel="noreferrer">DOCX</a>}
        {v.pdf_url && <a className="text-accent hover:underline" href={v.pdf_url} target="_blank" rel="noreferrer">PDF</a>}
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
