'use client';
import { useState } from 'react';
import { DEFAULT_PREFERENCES, DEFAULT_WEIGHTS, Preferences, ScoringWeights } from '@/lib/db/types';

const WEIGHT_LABELS: { key: keyof ScoringWeights; label: string }[] = [
  { key: 'resume', label: 'Resume match' },
  { key: 'title', label: 'Title match' },
  { key: 'industry', label: 'Industry match' },
  { key: 'seniority', label: 'Seniority match' },
  { key: 'salary', label: 'Salary match' },
  { key: 'location', label: 'Location / remote fit' },
  { key: 'swipe', label: 'Swipe feedback' },
  { key: 'quality', label: 'Scam / quality filter' },
];

const TOGGLES: { key: keyof Preferences; label: string }[] = [
  { key: 'allow_senior_titles', label: 'Senior titles' },
  { key: 'allow_stretch_roles', label: 'Stretch roles' },
  { key: 'broaden_industries', label: 'Broaden industries' },
  { key: 'strict_salary_floor', label: 'Strict salary floor' },
  { key: 'remote_only', label: 'Remote only' },
  { key: 'exploration_mode', label: 'Exploration mode' },
  { key: 'exclude_scams', label: 'Exclude scams' },
];

export function ScoringPanel({
  initialWeights,
  initialPreferences,
}: {
  initialWeights: ScoringWeights;
  initialPreferences: Preferences;
}) {
  const [weights, setWeights] = useState<ScoringWeights>({ ...DEFAULT_WEIGHTS, ...initialWeights });
  const [prefs, setPrefs] = useState<Preferences>({ ...DEFAULT_PREFERENCES, ...initialPreferences });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function save(recalculate = false) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoring_weights_json: weights,
          preferences_json: prefs,
          recalculate,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Save failed');
      setMsg({
        tone: 'ok',
        text: recalculate ? `Saved · recalculated ${j.recalculated} jobs` : 'Saved',
      });
    } catch (e: any) {
      setMsg({ tone: 'bad', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Scoring weights</h2>
            <p className="mt-1 text-xs text-ink/55">
              AI generates raw scores 0–1 per signal. Final score = weighted average. Weights are relative.
            </p>
          </div>
          <span className="text-xs text-ink/50 tabular-nums">Total: {totalWeight}</span>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {WEIGHT_LABELS.map((w) => (
            <div key={w.key}>
              <div className="flex items-baseline justify-between text-sm">
                <label className="text-ink/80">{w.label}</label>
                <span className="text-xs font-medium tabular-nums text-accent">{weights[w.key]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={weights[w.key]}
                onChange={(e) => setWeights({ ...weights, [w.key]: Number(e.target.value) })}
                className="range-accent mt-2"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Preferences</h2>
        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-ink/50">Toggles</div>
            <div className="flex flex-wrap gap-2">
              {TOGGLES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="toggle-pill"
                  data-on={!!prefs[t.key]}
                  onClick={() => setPrefs({ ...prefs, [t.key]: !prefs[t.key] } as Preferences)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">
                Salary floor (USD)
              </label>
              <input
                type="number"
                className="input mt-1.5"
                value={prefs.salary_floor}
                onChange={(e) => setPrefs({ ...prefs, salary_floor: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <ListEditor
              label="Preferred titles"
              items={prefs.preferred_titles}
              onChange={(v) => setPrefs({ ...prefs, preferred_titles: v })}
            />
            <ListEditor
              label="Preferred industries"
              items={prefs.preferred_industries}
              onChange={(v) => setPrefs({ ...prefs, preferred_industries: v })}
            />
            <ListEditor
              label="Preferred locations"
              items={prefs.preferred_locations}
              onChange={(v) => setPrefs({ ...prefs, preferred_locations: v })}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-secondary" onClick={() => save(false)} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className="btn-primary" onClick={() => save(true)} disabled={busy}>
          Save & recalculate all
        </button>
        {msg && (
          <span className={'text-sm ' + (msg.tone === 'ok' ? 'text-ok' : 'text-bad')}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}

function ListEditor({
  label, items, onChange,
}: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">{label}</label>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs">
            {it}
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-ink/40 hover:text-bad"
              aria-label={`Remove ${it}`}
            >
              ×
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-ink/40">None</span>}
      </div>
      <input
        className="input mt-2"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add and press Enter…"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            e.preventDefault();
            onChange([...items, draft.trim()]);
            setDraft('');
          }
        }}
      />
    </div>
  );
}
