import { KanbanBoard } from '@/components/KanbanBoard';
import { GenerateResumeButton } from '@/components/GenerateResumeButton';
import { ResumeChoice } from '@/components/ResumeChoice';
import { listApplications } from '@/lib/db/applications';
import { hasSupabase } from '@/lib/supabase/server';
import { STAGES } from '@/lib/db/types';
import { docUrl } from '@/lib/google/drive';

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  if (!hasSupabase()) return <div className="card p-6 text-sm">Configure Supabase to view applications.</div>;
  let apps: any[] = [];
  let err: string | null = null;
  try {
    apps = await listApplications();
  } catch (e: any) {
    err = e.message;
  }
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Pipeline</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-ink/60">Drag cards across stages. Table view below.</p>
      </div>
      {err && (
        <div className="rounded-xl border border-bad/20 bg-bad/5 px-4 py-3 text-sm text-bad">{err}</div>
      )}
      <KanbanBoard initial={apps} />
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Position</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 text-right font-medium">Match</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Applied</th>
              <th className="px-4 py-2.5 font-medium">Résumé</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="border-t border-ink/5">
                <td className="px-4 py-2.5">{a.company}</td>
                <td className="px-4 py-2.5">{a.title}</td>
                <td className="px-4 py-2.5 text-ink/75">{STAGES.find((s) => s.id === a.stage)?.label || a.stage}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {a.match_score != null ? Math.round(a.match_score * 100) + '%' : '—'}
                </td>
                <td className="px-4 py-2.5 capitalize text-ink/75">{a.source}</td>
                <td className="px-4 py-2.5 tabular-nums text-ink/75">
                  {a.date_applied ? new Date(a.date_applied).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ResumeChoice appId={a.id} resumeVersionId={a.resume_version_id ?? null} />
                    {a.resume_versions?.pdf_storage_path && (
                      <a
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                        href={`/api/resume-versions/${a.resume_versions.id}/download?format=pdf`}
                        target="_blank"
                        rel="noreferrer"
                        title="Download the tailored résumé PDF"
                      >
                        PDF ↓
                      </a>
                    )}
                    {a.resume_versions?.google_drive_file_id && (
                      <a
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                        href={docUrl(a.resume_versions.google_drive_file_id)}
                        target="_blank"
                        rel="noreferrer"
                        title="Open the tailored résumé in Google Docs"
                      >
                        Docs ↗
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right space-x-3">
                  {a.url && (
                    <a className="text-accent hover:underline" href={a.url} target="_blank" rel="noreferrer">
                      open ↗
                    </a>
                  )}
                  {a.job_id && (
                    <GenerateResumeButton jobId={a.job_id} hasVersion={!!a.resume_version_id} />
                  )}
                </td>
              </tr>
            ))}
            {apps.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink/50">No applications yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
