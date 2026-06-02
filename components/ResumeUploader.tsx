'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export function ResumeUploader({ type = 'master' }: { type?: 'master' | 'template' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const isTemplate = type === 'template';

  const upload = useCallback(async (f: File) => {
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('type', type);
      const res = await fetch('/api/resume/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Upload failed');
      }
      setDone(f.name);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [router, type]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) upload(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  }

  const stateBorder =
    busy ? 'border-accent bg-accent/[0.06]' :
    done ? 'border-ok bg-ok/[0.05]' :
    err ? 'border-bad bg-bad/[0.04]' :
    dragOver ? 'border-accent bg-accent/[0.08] ring-2 ring-accent/20' :
    'border-ink/15 bg-white hover:border-ink/30';

  return (
    <label
      className={
        'card flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-10 text-center transition-all duration-200 ' +
        stateBorder
      }
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className={'flex h-12 w-12 items-center justify-center rounded-full ' + (
        busy ? 'bg-accent/15 text-accent' :
        done ? 'bg-ok/15 text-ok' :
        err ? 'bg-bad/15 text-bad' :
        'bg-ink/[0.06] text-ink/60'
      )}>
        {busy ? (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : done ? '✓' : err ? '!' : '↑'}
      </div>
      <div>
        <div className="text-sm font-medium">
          {busy ? 'Uploading…' :
           done ? `Uploaded ${done}` :
           err ? 'Upload failed' :
           dragOver ? 'Drop to upload' :
           isTemplate ? 'Drop a .docx template or click to browse' : 'Drop a resume or click to browse'}
        </div>
        <div className="mt-1 text-xs text-ink/55">
          {err || (isTemplate
            ? '.docx only · your design + {placeholder} tags'
            : 'DOCX preferred · PDF, TXT, MD also supported')}
        </div>
      </div>
      <input
        type="file"
        accept={isTemplate ? '.docx' : '.docx,.pdf,.txt,.md'}
        className="hidden"
        onChange={onChange}
        disabled={busy}
      />
    </label>
  );
}
