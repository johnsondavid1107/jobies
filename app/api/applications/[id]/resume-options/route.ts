import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { getMasterResume } from '@/lib/db/resumes';
import { getApplication } from '@/lib/db/applications';
import { parseResumeFile } from '@/lib/resume/parse';

export const runtime = 'nodejs';

const PREVIEW_CHARS = 8000;

async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin().storage.from(env.storageBucket).createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

/** Download a stored file and extract its text, truncated for preview. */
async function extractText(path: string | null | undefined, filename: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin().storage.from(env.storageBucket).download(path);
  if (error || !data) return null;
  try {
    const buf = Buffer.from(await data.arrayBuffer());
    const text = (await parseResumeFile(filename, buf)).trim();
    return text.length > PREVIEW_CHARS ? text.slice(0, PREVIEW_CHARS) + '\n\n… (truncated)' : text;
  } catch {
    return null;
  }
}

/**
 * Powers the per-application résumé picker modal: returns the master file and the
 * latest tailored version for this application, each with extracted text (to verify
 * the LLM reword) and signed download URLs, plus which one is currently selected.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = supabaseAdmin();
    const app = await getApplication(params.id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    // Master (original formatted file is the source of truth — never the plaintext blob).
    const master = await getMasterResume();
    const masterOut = master
      ? {
          filename: master.filename as string,
          url: await signedUrl(master.storage_path),
          text: await extractText(master.storage_path, master.filename),
        }
      : null;

    // Latest tailored version for this application (fall back to the job).
    let vq = sb
      .from('resume_versions')
      .select('id, company, role, docx_storage_path, pdf_storage_path, match_score_after, created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    vq = app.job_id ? vq.or(`application_id.eq.${params.id},job_id.eq.${app.job_id}`) : vq.eq('application_id', params.id);
    const { data: vrows, error: vErr } = await vq;
    if (vErr) throw vErr;
    const v = vrows?.[0] || null;

    const tailored = v
      ? {
          id: v.id as string,
          filename: `${v.company || 'Resume'} — ${v.role || 'Tailored'}.docx`,
          docxUrl: await signedUrl(v.docx_storage_path),
          pdfUrl: await signedUrl(v.pdf_storage_path),
          score: v.match_score_after != null ? Math.round(v.match_score_after * 100) : null,
          text: await extractText(v.docx_storage_path, 'tailored.docx'),
        }
      : null;

    const selected = app.resume_version_id ? 'tailored' : 'master';
    return NextResponse.json({ selected, selectedVersionId: app.resume_version_id || null, master: masterOut, tailored });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
