'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GenerateResumeButton({ jobId, hasVersion }: { jobId: string; hasVersion?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Generation failed');
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button onClick={go} disabled={busy} className="text-accent hover:underline disabled:opacity-50">
        {busy ? 'Generating…' : hasVersion ? 'Regenerate' : 'Tailor resume'}
      </button>
      {err && <span className="text-xs text-red-600">· {err}</span>}
    </span>
  );
}
