'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Master = { filename: string; url: string | null; text: string | null } | null;
type Tailored = {
  id: string;
  filename: string;
  docxUrl: string | null;
  pdfUrl: string | null;
  score: number | null;
  text: string | null;
} | null;
type Options = {
  selected: 'master' | 'tailored';
  selectedVersionId: string | null;
  master: Master;
  tailored: Tailored;
};

export function ResumeChoice({
  appId,
  resumeVersionId,
}: {
  appId: string;
  resumeVersionId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [opts, setOpts] = useState<Options | null>(null);
  const [tab, setTab] = useState<'master' | 'tailored'>(resumeVersionId ? 'tailored' : 'master');

  const isEnhanced = !!resumeVersionId;

  async function openModal() {
    setOpen(true);
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${appId}/resume-options`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load options');
      setOpts(data);
      setTab(data.selected);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function choose(useTailored: boolean) {
    setSaving(true);
    setErr(null);
    try {
      const resume_version_id = useTailored ? opts?.tailored?.id ?? null : null;
      const res = await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_version_id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save choice');
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const active = tab === 'tailored' ? opts?.tailored : opts?.master;
  const currentlySelectedTab =
    (opts?.selected === 'tailored' && tab === 'tailored') || (opts?.selected === 'master' && tab === 'master');

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors ' +
          (isEnhanced
            ? 'bg-accent/10 text-accent hover:bg-accent/15'
            : 'bg-ink/[0.05] text-ink/65 hover:bg-ink/[0.08]')
        }
        title="Preview and choose which résumé this application uses"
      >
        {isEnhanced ? 'Enhanced' : 'Master'}
        <span className="text-[10px] opacity-60">▾</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="card flex max-h-[85vh] w-full max-w-2xl flex-col p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink/8 px-5 py-3.5">
              <h3 className="text-sm font-semibold tracking-tight">Résumé for this application</h3>
              <button
                type="button"
                onClick={() => !saving && setOpen(false)}
                className="text-ink/50 hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* tabs */}
            <div className="flex gap-1 px-5 pt-3">
              {(['master', 'tailored'] as const).map((t) => {
                const avail = t === 'master' ? !!opts?.master : !!opts?.tailored;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!avail && !loading}
                    onClick={() => setTab(t)}
                    className={
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ' +
                      (tab === t ? 'bg-ink/[0.07] text-ink' : 'text-ink/55 hover:text-ink')
                    }
                  >
                    {t === 'master' ? 'Master' : 'Tailored'}
                    {t === 'tailored' && opts?.tailored?.score != null && (
                      <span className="ml-1.5 text-ok">{opts.tailored.score}%</span>
                    )}
                    {opts?.selected === t && <span className="ml-1.5 text-[10px] text-accent">• in use</span>}
                  </button>
                );
              })}
            </div>

            {/* body */}
            <div className="min-h-[200px] flex-1 overflow-auto px-5 py-3">
              {loading && <div className="py-12 text-center text-sm text-ink/50">Loading preview…</div>}
              {!loading && err && <div className="py-3 text-sm text-bad">{err}</div>}
              {!loading && !err && tab === 'tailored' && !opts?.tailored && (
                <div className="py-10 text-center text-sm text-ink/55">
                  No tailored version yet. Tailor this job from the swipe deck or the “Tailor” action to generate one.
                </div>
              )}
              {!loading && !err && active && (
                <pre className="whitespace-pre-wrap break-words rounded-lg border border-ink/5 bg-ink/[0.02] p-3 text-xs leading-relaxed text-ink/80">
{active.text || '(could not extract a text preview — use the download links below to open the file)'}
                </pre>
              )}
            </div>

            {/* footer: downloads + choose */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 px-5 py-3.5">
              <div className="flex items-center gap-3 text-xs">
                {tab === 'master' && opts?.master?.url && (
                  <a className="font-medium text-accent hover:underline" href={opts.master.url} target="_blank" rel="noreferrer">
                    Download original
                  </a>
                )}
                {tab === 'tailored' && opts?.tailored?.docxUrl && (
                  <a className="font-medium text-accent hover:underline" href={opts.tailored.docxUrl} target="_blank" rel="noreferrer">
                    DOCX
                  </a>
                )}
                {tab === 'tailored' && opts?.tailored?.pdfUrl && (
                  <a className="font-medium text-accent hover:underline" href={opts.tailored.pdfUrl} target="_blank" rel="noreferrer">
                    PDF
                  </a>
                )}
              </div>
              <button
                type="button"
                disabled={saving || loading || currentlySelectedTab || (tab === 'tailored' && !opts?.tailored)}
                onClick={() => choose(tab === 'tailored')}
                className="btn-primary text-xs disabled:opacity-40"
              >
                {currentlySelectedTab
                  ? 'In use'
                  : saving
                  ? 'Saving…'
                  : tab === 'master'
                  ? 'Use Master'
                  : 'Use Tailored'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
