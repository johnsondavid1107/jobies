'use client';

import { useCallback, useEffect, useState } from 'react';

interface SourceRow {
  name: string;
  enabled: boolean;
  config_json: any;
}

const ATS = new Set(['greenhouse', 'lever', 'ashby']);

export function JobSourcesCard() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/sources', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSources(data.sources || []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patchSource(name: string, patch: Partial<SourceRow>) {
    const res = await fetch(`/api/sources/${name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    setSources((prev) => prev.map((s) => (s.name === name ? data.source : s)));
  }

  const adzuna = sources.find((s) => s.name === 'adzuna');
  const remotive = sources.find((s) => s.name === 'remotive');
  const ats = sources.filter((s) => ATS.has(s.name));

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Job sources</div>
        {loading && <span className="text-xs text-ink/50">loading…</span>}
      </div>
      {err && <div className="rounded-xl border border-bad/20 bg-bad/5 px-4 py-3 text-sm text-bad">{err}</div>}

      {adzuna && <AdzunaEditor row={adzuna} onSave={(p) => patchSource('adzuna', p)} />}

      {ats.map((row) => (
        <BoardsEditor key={row.name} row={row} onSave={(p) => patchSource(row.name, p)} />
      ))}

      {remotive && <SimpleToggle row={remotive} onSave={(p) => patchSource('remotive', p)} />}
    </section>
  );
}

function SourceHeader({
  title,
  row,
  onToggle,
}: {
  title: string;
  row: SourceRow;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <span className={'rounded-md px-1.5 py-0.5 text-[10px] font-medium ' + (row.enabled ? 'bg-ok/10 text-ok' : 'bg-ink/[0.06] text-ink/55')}>
          {row.enabled ? 'enabled' : 'disabled'}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onToggle(!row.enabled)}
        className="text-xs text-accent hover:underline"
      >
        {row.enabled ? 'Disable' : 'Enable'}
      </button>
    </div>
  );
}

function AdzunaEditor({ row, onSave }: { row: SourceRow; onSave: (p: Partial<SourceRow>) => Promise<void> }) {
  const cfg = row.config_json || {};
  const initial = Array.isArray(cfg.queries) ? cfg.queries : [];
  const [queries, setQueries] = useState<{ what: string; where: string; results_per_page?: number }[]>(initial);
  const [country, setCountry] = useState<string>(cfg.country || 'us');
  const [what, setWhat] = useState('');
  const [where, setWhere] = useState('');
  const [saving, setSaving] = useState(false);

  function addQuery() {
    if (!what.trim() && !where.trim()) return;
    setQueries((p) => [...p, { what: what.trim(), where: where.trim(), results_per_page: 20 }]);
    setWhat(''); setWhere('');
  }
  function removeQuery(i: number) {
    setQueries((p) => p.filter((_, idx) => idx !== i));
  }
  async function save() {
    setSaving(true);
    try { await onSave({ config_json: { ...cfg, country, queries } }); }
    finally { setSaving(false); }
  }

  return (
    <div className="card space-y-3 p-4">
      <SourceHeader title="Adzuna" row={row} onToggle={(enabled) => onSave({ enabled })} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="text-ink/60">Country</label>
        <input
          className="input w-20 text-xs"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="us"
        />
        <span className="text-ink/40">·</span>
        <span className="text-ink/55">{queries.length} {queries.length === 1 ? 'query' : 'queries'}</span>
      </div>
      <ul className="space-y-1.5">
        {queries.map((q, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="rounded-md bg-ink/[0.04] px-2 py-1">
              <span className="text-ink/90">{q.what || '(any)'}</span>
              <span className="mx-1.5 text-ink/30">in</span>
              <span className="text-ink/70">{q.where || '(anywhere)'}</span>
            </span>
            <button type="button" onClick={() => removeQuery(i)} className="text-ink/40 hover:text-bad" aria-label="Remove">
              ✕
            </button>
          </li>
        ))}
        {queries.length === 0 && <li className="text-xs text-ink/50">No queries — Adzuna won't fetch anything.</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 min-w-[140px] text-xs"
          placeholder='What (e.g. "product manager")'
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addQuery()}
        />
        <input
          className="input flex-1 min-w-[120px] text-xs"
          placeholder='Where (e.g. "remote", "NYC")'
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addQuery()}
        />
        <button type="button" className="btn-secondary text-xs" onClick={addQuery}>Add</button>
        <button type="button" className="btn-primary text-xs" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function BoardsEditor({ row, onSave }: { row: SourceRow; onSave: (p: Partial<SourceRow>) => Promise<void> }) {
  const cfg = row.config_json || {};
  const initial: string[] = Array.isArray(cfg.boards) ? cfg.boards : [];
  const [boards, setBoards] = useState<string[]>(initial);
  const [slug, setSlug] = useState('');
  const [validating, setValidating] = useState(false);
  const [vMsg, setVMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function validateAndAdd() {
    const s = slug.trim().toLowerCase();
    if (!s) return;
    if (boards.includes(s)) { setVMsg({ ok: false, text: `${s} is already in the pool.` }); return; }
    setValidating(true); setVMsg(null);
    try {
      const res = await fetch(`/api/sources/validate?source=${row.name}&slug=${encodeURIComponent(s)}`);
      const data = await res.json();
      if (!data.ok) {
        setVMsg({ ok: false, text: `Not found at ${row.name} (${data.status || data.error || '404'}).` });
      } else {
        setBoards((p) => [...p, s]);
        setSlug('');
        setVMsg({ ok: true, text: `Added ${s} — ${data.openings} open ${data.openings === 1 ? 'role' : 'roles'}.` });
      }
    } catch (e: any) {
      setVMsg({ ok: false, text: e.message || 'Validation failed' });
    } finally {
      setValidating(false);
    }
  }
  function remove(s: string) {
    setBoards((p) => p.filter((x) => x !== s));
  }
  async function save() {
    setSaving(true);
    try { await onSave({ config_json: { ...cfg, boards } }); }
    finally { setSaving(false); }
  }

  const title = row.name.charAt(0).toUpperCase() + row.name.slice(1);
  return (
    <div className="card space-y-3 p-4">
      <SourceHeader title={`${title} boards`} row={row} onToggle={(enabled) => onSave({ enabled })} />
      <div className="text-xs text-ink/55">{boards.length} {boards.length === 1 ? 'board' : 'boards'} in pool</div>
      <ul className="flex flex-wrap gap-1.5">
        {boards.map((s) => (
          <li key={s} className="flex items-center gap-1 rounded-md bg-ink/[0.04] px-2 py-1 text-xs">
            <span className="text-ink/80">{s}</span>
            <button type="button" onClick={() => remove(s)} className="text-ink/40 hover:text-bad" aria-label={`Remove ${s}`}>
              ✕
            </button>
          </li>
        ))}
        {boards.length === 0 && <li className="text-xs text-ink/50">No boards — nothing will be fetched.</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 min-w-[160px] text-xs"
          placeholder="Company slug (e.g. stripe)"
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setVMsg(null); }}
          onKeyDown={(e) => e.key === 'Enter' && !validating && validateAndAdd()}
        />
        <button type="button" className="btn-secondary text-xs" onClick={validateAndAdd} disabled={validating || !slug.trim()}>
          {validating ? 'Validating…' : 'Validate & Add'}
        </button>
        <button type="button" className="btn-primary text-xs" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {vMsg && (
        <div className={'text-xs ' + (vMsg.ok ? 'text-ok' : 'text-bad')}>{vMsg.text}</div>
      )}
    </div>
  );
}

function SimpleToggle({ row, onSave }: { row: SourceRow; onSave: (p: Partial<SourceRow>) => Promise<void> }) {
  const title = row.name.charAt(0).toUpperCase() + row.name.slice(1);
  return (
    <div className="card p-4">
      <SourceHeader title={title} row={row} onToggle={(enabled) => onSave({ enabled })} />
      <p className="mt-1 text-xs text-ink/55">No per-source configuration.</p>
    </div>
  );
}
