'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function JobImportForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/api/jobs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, text }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Import failed');
      setMsg('Imported: ' + j.job.title + (j.job.company ? ` @ ${j.job.company}` : ''));
      setUrl('');
      setText('');
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-5">
      <div>
        <label className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">Job URL</label>
        <input
          className="input mt-1.5"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-ink/10" />
        <div className="relative mx-auto w-fit bg-white px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-ink/40">
          or
        </div>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">Job description</label>
        <textarea
          className="input mt-1.5 min-h-[180px] leading-relaxed"
          placeholder="Paste full JD text here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink/5 pt-4">
        <button className="btn-primary" disabled={busy || (!url && !text)}>
          {busy ? 'Importing…' : 'Import & score'}
        </button>
        {msg && (
          <span className="inline-flex items-center gap-1.5 text-sm text-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" /> {msg}
          </span>
        )}
        {err && (
          <span className="inline-flex items-center gap-1.5 text-sm text-bad">
            <span className="h-1.5 w-1.5 rounded-full bg-bad" /> {err}
          </span>
        )}
      </div>
    </form>
  );
}
