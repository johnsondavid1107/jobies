import { ResumeUploader } from '@/components/ResumeUploader';
import { getMasterResume, getTemplateResume } from '@/lib/db/resumes';
import { hasSupabase, supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Signed download URL (1h) for a stored résumé file, or null. */
async function signedUrl(storagePath: string | null | undefined): Promise<string | null> {
  if (!storagePath) return null;
  const { data } = await supabaseAdmin().storage.from(env.storageBucket).createSignedUrl(storagePath, 3600);
  return data?.signedUrl || null;
}

export default async function ResumePage() {
  let resume: any = null;
  let template: any = null;
  let masterUrl: string | null = null;
  let templateUrl: string | null = null;
  let configError: string | null = null;
  if (hasSupabase()) {
    try {
      resume = await getMasterResume();
      template = await getTemplateResume();
      masterUrl = await signedUrl(resume?.storage_path);
      templateUrl = await signedUrl(template?.storage_path);
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
            <div className="flex items-center gap-3 text-xs">
              {masterUrl && (
                <a className="font-medium text-accent hover:underline" href={masterUrl} target="_blank" rel="noreferrer">
                  Download original
                </a>
              )}
              <span className="tabular-nums text-ink/50">{new Date(resume.created_at).toLocaleString()}</span>
            </div>
          </div>
          <pre className="mt-4 max-h-[500px] overflow-auto whitespace-pre-wrap rounded-xl border border-ink/5 bg-ink/[0.025] p-4 text-xs leading-relaxed text-ink/80">
{resume.parsed_text || '(no parsed text)'}
          </pre>
        </div>
      )}

      <div className="pt-2">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Formatting template</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Résumé template</h2>
        <p className="mt-1 text-sm text-ink/60">
          Upload a <code className="rounded bg-ink/[0.06] px-1 py-0.5 text-xs">.docx</code> with your design and{' '}
          <code className="rounded bg-ink/[0.06] px-1 py-0.5 text-xs">{'{placeholder}'}</code> tags. Tailored
          résumés render into this exact layout. See{' '}
          <code className="rounded bg-ink/[0.06] px-1 py-0.5 text-xs">docs/RESUME_TAILORING.md</code> for the tag scheme.
        </p>
      </div>

      <ResumeUploader type="template" />

      {template && (
        <div className="card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-ink/50">Current template</div>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">{template.filename}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {templateUrl && (
                <a className="font-medium text-accent hover:underline" href={templateUrl} target="_blank" rel="noreferrer">
                  Download
                </a>
              )}
              <span className="tabular-nums text-ink/50">{new Date(template.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
