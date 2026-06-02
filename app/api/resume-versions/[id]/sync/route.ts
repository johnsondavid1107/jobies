import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { getJob } from '@/lib/db/jobs';
import { exportDoc } from '@/lib/google/drive';
import { scoreWithResume } from '@/lib/scoring/score';

export const runtime = 'nodejs';
export const maxDuration = 60;

const safe = (s: string) => (s || 'job').replace(/[^\w.-]+/g, '_').slice(0, 40);

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = supabaseAdmin();
    const { data: source, error } = await sb
      .from('resume_versions')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!source) return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    if (!source.google_drive_file_id) {
      return NextResponse.json(
        { error: 'No linked Google Doc — open it in Docs first' },
        { status: 400 },
      );
    }

    // Pull the live Doc back as DOCX + PDF (the Doc is canonical).
    const { docx, pdf } = await exportDoc(source.google_drive_file_id);

    const stamp = Date.now();
    const baseName = `${safe(source.company || 'company')}-${safe(source.role || 'role')}-${stamp}`;
    const docxPath = `generated/${baseName}.docx`;
    const pdfPath = `generated/${baseName}.pdf`;

    const up1 = await sb.storage.from(env.storageBucket).upload(docxPath, docx, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });
    if (up1.error) throw up1.error;
    const up2 = await sb.storage.from(env.storageBucket).upload(pdfPath, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (up2.error) throw up2.error;

    // Re-score the edited text against the JD (does NOT touch job_scores).
    let rescored: number | null = source.match_score_after ?? null;
    if (source.job_id) {
      try {
        const { value: text } = await mammoth.extractRawText({ buffer: docx });
        const job = await getJob(source.job_id);
        if (job && text.trim()) {
          const r = await scoreWithResume(text, job);
          rescored = r.final_score;
        }
      } catch {
        // keep the source's prior score on rescore failure
      }
    }

    // Each sync snapshots the live Doc into a new version row, chained to its source.
    const insert = await sb
      .from('resume_versions')
      .insert({
        base_resume_id: source.base_resume_id,
        job_id: source.job_id,
        application_id: source.application_id,
        company: source.company,
        role: source.role,
        parent_version_id: source.id,
        google_drive_file_id: source.google_drive_file_id,
        docx_storage_path: docxPath,
        pdf_storage_path: pdfPath,
        match_score_before: source.match_score_after ?? null,
        match_score_after: rescored,
        keywords_emphasized_json: source.keywords_emphasized_json || [],
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (insert.error) throw insert.error;

    // Point the linked application at the latest version.
    if (source.application_id) {
      await sb
        .from('applications')
        .update({ resume_version_id: insert.data.id, updated_at: new Date().toISOString() })
        .eq('id', source.application_id);
    }

    return NextResponse.json({
      ok: true,
      version: insert.data,
      score_before: source.match_score_after ?? null,
      score_after: rescored,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
