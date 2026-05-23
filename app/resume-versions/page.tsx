import { listResumeVersions } from '@/lib/db/resume-versions';
import { hasSupabase } from '@/lib/supabase/server';
import { VersionRow } from '@/components/ResumeVersionRow';

export const dynamic = 'force-dynamic';

export default async function ResumeVersionsPage() {
  if (!hasSupabase()) return <div className="card p-6 text-sm">Configure Supabase to view resume versions.</div>;
  let versions: any[] = [];
  let err: string | null = null;
  try {
    versions = await listResumeVersions();
  } catch (e: any) {
    err = e.message;
  }
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Tailored</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Resume versions</h1>
        <p className="mt-1 text-sm text-ink/60">Tailored DOCX + PDF versions, linked to jobs and applications.</p>
      </div>
      {err && (
        <div className="rounded-xl border border-bad/20 bg-bad/5 px-4 py-3 text-sm text-bad">{err}</div>
      )}
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Match</th>
              <th className="px-4 py-2.5 font-medium">Keywords</th>
              <th className="px-4 py-2.5 font-medium">Files</th>
              <th className="px-4 py-2.5 font-medium">Used</th>
              <th className="px-4 py-2.5 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => <VersionRow key={v.id} v={v} />)}
            {versions.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink/50">No tailored resumes yet. Generate one from an application.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
