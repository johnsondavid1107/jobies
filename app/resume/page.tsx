import { ResumeUploader } from '@/components/ResumeUploader';
import { getMasterResume } from '@/lib/db/resumes';
import { hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ResumePage() {
  let resume: any = null;
  let configError: string | null = null;
  if (hasSupabase()) {
    try {
      resume = await getMasterResume();
    } catch (e: any) {
      configError = e.message;
    }
  } else {
    configError = 'Supabase not configured';
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Profile</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Resume hub</h1>
        <p className="mt-1 text-sm text-ink/60">Upload your master resume. We parse it for AI matching and tailoring.</p>
      </div>

      <ResumeUploader />

      {configError && (
        <div className="rounded-xl border border-warn/25 bg-warn/5 px-4 py-3 text-sm text-warn">
          {configError}
        </div>
      )}

      {resume && (
        <div className="card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">Current master</div>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">{resume.filename}</h3>
            </div>
            <span className="text-xs tabular-nums text-ink/50">
              {new Date(resume.created_at).toLocaleString()}
            </span>
          </div>
          <pre className="mt-4 max-h-[500px] overflow-auto whitespace-pre-wrap rounded-xl border border-ink/5 bg-ink/[0.025] p-4 text-xs leading-relaxed text-ink/80">
{resume.parsed_text || '(no parsed text)'}
          </pre>
        </div>
      )}
    </div>
  );
}
