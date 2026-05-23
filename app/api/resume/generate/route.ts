import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { getJob } from '@/lib/db/jobs';
import { getMasterResume } from '@/lib/db/resumes';
import { aiComplete, extractJson } from '@/lib/ai/provider';
import { TAILOR_SYSTEM, buildTailorPrompt, ResumeSections } from '@/lib/ai/prompts';
import { renderResumeDocx } from '@/lib/resume/generate-docx';
import { renderResumePdf } from '@/lib/resume/generate-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { job_id } = await req.json();
    if (!job_id) return NextResponse.json({ error: 'job_id required' }, { status: 400 });

    const job = await getJob(job_id);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const master = await getMasterResume();
    if (!master?.parsed_json && !master?.parsed_text) {
      return NextResponse.json({ error: 'No master resume parsed' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: existingScore } = await sb
      .from('job_scores')
      .select('final_score')
      .eq('job_id', job_id)
      .maybeSingle();

    const masterSections: ResumeSections =
      master.parsed_json || { summary: master.parsed_text?.slice(0, 1500) };

    const raw = await aiComplete({
      system: TAILOR_SYSTEM,
      prompt: buildTailorPrompt({
        master: masterSections,
        jobTitle: job.title,
        jobCompany: job.company,
        jobDescription: job.description || '',
        matchScoreBefore: existingScore?.final_score ?? null,
      }),
      json: true,
      maxTokens: 4000,
    });

    const tailored = extractJson<{
      resume: ResumeSections;
      keywords_emphasized: string[];
      match_score_after: number;
      changes_summary: string[];
    }>(raw);

    const docxBuf = await renderResumeDocx(tailored.resume);
    const pdfBuf = await renderResumePdf(tailored.resume);

    const stamp = Date.now();
    const safe = (s: string) => (s || 'job').replace(/[^\w.-]+/g, '_').slice(0, 40);
    const baseName = `${safe(job.company || 'company')}-${safe(job.title)}-${stamp}`;
    const docxPath = `generated/${baseName}.docx`;
    const pdfPath = `generated/${baseName}.pdf`;

    const up1 = await sb.storage.from(env.storageBucket).upload(docxPath, docxBuf, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });
    if (up1.error) throw up1.error;
    const up2 = await sb.storage.from(env.storageBucket).upload(pdfPath, pdfBuf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (up2.error) throw up2.error;

    const { data: appRow } = await sb
      .from('applications')
      .select('id')
      .eq('job_id', job_id)
      .maybeSingle();

    const insert = await sb
      .from('resume_versions')
      .insert({
        base_resume_id: master.id,
        job_id,
        application_id: appRow?.id || null,
        company: job.company,
        role: job.title,
        docx_storage_path: docxPath,
        pdf_storage_path: pdfPath,
        match_score_before: existingScore?.final_score ?? null,
        match_score_after: tailored.match_score_after ?? null,
        keywords_emphasized_json: tailored.keywords_emphasized || [],
      })
      .select()
      .single();
    if (insert.error) throw insert.error;

    if (appRow) {
      await sb
        .from('applications')
        .update({ resume_version_id: insert.data.id, updated_at: new Date().toISOString() })
        .eq('id', appRow.id);
    }

    return NextResponse.json({
      ok: true,
      version: insert.data,
      changes_summary: tailored.changes_summary || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
