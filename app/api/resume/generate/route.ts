import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { getRefreshToken } from '@/lib/google/credentials';
import { getJob } from '@/lib/db/jobs';
import { getMasterResume, getTemplateResume } from '@/lib/db/resumes';
import { aiComplete, extractJson } from '@/lib/ai/provider';
import { TAILOR_SYSTEM, buildTailorPrompt, ResumeSections } from '@/lib/ai/prompts';
import { renderResumeFromTemplate } from '@/lib/resume/render-from-template';
import { normalizeResumeSections } from '@/lib/resume/normalize';
import { docxToPdf, docUrl } from '@/lib/google/drive';
import { scoreWithResume } from '@/lib/scoring/score';

function sectionsToText(s: ResumeSections): string {
  const parts: string[] = [];
  if (s.summary) parts.push(s.summary);
  for (const e of s.experience || []) {
    parts.push(`${e.title} — ${e.company}${e.location ? ' (' + e.location + ')' : ''} ${e.start || ''}–${e.end || ''}`);
    for (const b of e.bullets || []) parts.push('• ' + b);
  }
  for (const ed of s.education || []) {
    parts.push(`${ed.degree || ''} ${ed.school}${ed.notes ? ' — ' + ed.notes : ''}`);
  }
  if (s.skills?.length) parts.push('Skills: ' + s.skills.join(', '));
  for (const p of s.projects || []) {
    parts.push(`${p.name}${p.description ? ': ' + p.description : ''}`);
    for (const b of p.bullets || []) parts.push('• ' + b);
  }
  if (s.certifications?.length) parts.push('Certifications: ' + s.certifications.join(', '));
  for (const o of s.other || []) parts.push(`${o.heading}: ${(o.items || []).join('; ')}`);
  return parts.join('\n');
}

/**
 * Fill any section the master populated but the tailored output left empty.
 * Guards against the LLM silently dropping experience/education (which would
 * otherwise render a blank résumé). Mutates `tailored` in place.
 */
function backfillFromMaster(tailored: ResumeSections, master: ResumeSections) {
  const empty = (v: any) => v == null || (Array.isArray(v) && v.length === 0);
  if (empty(tailored.experience) && !empty(master.experience)) tailored.experience = master.experience;
  if (empty(tailored.education) && !empty(master.education)) tailored.education = master.education;
  if (empty(tailored.skills) && !empty(master.skills)) tailored.skills = master.skills;
  if (empty(tailored.projects) && !empty(master.projects)) tailored.projects = master.projects;
  if (empty(tailored.certifications) && !empty(master.certifications)) tailored.certifications = master.certifications;
  if (empty(tailored.other) && !empty(master.other)) tailored.other = master.other;
  if (!tailored.summary && master.summary) tailored.summary = master.summary;
  if (!tailored.header && master.header) tailored.header = master.header;
}

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

    // The uploaded template is the source of truth for formatting. Check it
    // BEFORE the AI call — no template → fail fast and free, never burn tokens
    // on a rewrite we can't render.
    const template = await getTemplateResume();
    if (!template?.storage_path) {
      return NextResponse.json(
        { error: 'Upload a résumé template on the Resume page before tailoring (your design lives in the template).' },
        { status: 400 },
      );
    }

    const sb = supabaseAdmin();
    const { data: existingScore } = await sb
      .from('job_scores')
      .select('final_score')
      .eq('job_id', job_id)
      .maybeSingle();

    // Normalize to the app's ResumeSections shape. The stored parsed_json may be
    // in the JSON Resume schema (basics/work/highlights/…); without this the LLM
    // and template renderer only ever see `summary`, producing an empty résumé.
    const masterSections: ResumeSections = normalizeResumeSections(
      master.parsed_json || { summary: master.parsed_text?.slice(0, 1500) },
    );

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

    // Normalize the LLM output too — it's told to mirror the input shape, so if
    // anything drifts to JSON Resume keys the renderer would silently blank it.
    const tailoredResume = normalizeResumeSections(tailored.resume);

    // Safety net: the LLM occasionally drops whole sections (notably experience
    // and education for roles far from the user's background), which renders a
    // near-empty résumé. Backfill from the master any section the master had but
    // the tailored output left empty — better un-tailored than blank.
    backfillFromMaster(tailoredResume, masterSections);

    // Template existence was verified above (before the AI call). Now download
    // it to render the tailored content into the user's design.
    const tplDl = await sb.storage.from(env.storageBucket).download(template.storage_path);
    if (tplDl.error || !tplDl.data) throw tplDl.error || new Error('Failed to download template');
    const templateBuf = Buffer.from(await tplDl.data.arrayBuffer());

    const stamp = Date.now();
    const safe = (s: string) => (s || 'job').replace(/[^\w.-]+/g, '_').slice(0, 40);
    const baseName = `${safe(job.company || 'company')}-${safe(job.title)}-${stamp}`;
    const docxPath = `generated/${baseName}.docx`;
    const pdfPath = `generated/${baseName}.pdf`;

    // DOCX: render only from the user's template. Tag/format errors throw a
    // readable message (renderResumeFromTemplate) that flows back to the UI.
    const docxBuf = renderResumeFromTemplate(templateBuf, tailoredResume);

    const up1 = await sb.storage.from(env.storageBucket).upload(docxPath, docxBuf, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });
    if (up1.error) throw up1.error;

    // PDF: best-effort via Drive so it matches the DOCX exactly. Never fall back
    // to a mismatched generic renderer — if Drive is off/expired, skip the PDF
    // and keep the (correct) DOCX, surfacing a non-fatal warning. The converted
    // Doc is kept and reused as the editable Doc for "Edit in Docs".
    let pdfStoragePath: string | null = null;
    let googleFileId: string | null = null;
    let warning: string | undefined;
    const googleReady = !!(env.googleClientId && env.googleClientSecret) && !!(await getRefreshToken());
    if (googleReady) {
      try {
        const docName = `${job.company || 'Resume'} — ${job.title || 'Tailored'}`.slice(0, 120);
        const { pdf, fileId } = await docxToPdf(docName, docxBuf);
        googleFileId = fileId;
        const up2 = await sb.storage.from(env.storageBucket).upload(pdfPath, pdf, {
          contentType: 'application/pdf',
          upsert: true,
        });
        if (up2.error) throw up2.error;
        pdfStoragePath = pdfPath;
      } catch (e: any) {
        const authIssue = /invalid_grant|token|unauthorized|\b401\b|\b403\b/i.test(e?.message || '');
        warning = authIssue
          ? 'DOCX ready; PDF skipped — Google token expired. Re-run scripts/google-auth.mjs to refresh it.'
          : 'DOCX ready; PDF skipped — Google Drive conversion failed.';
      }
    } else {
      warning = 'DOCX ready; PDF skipped — Google Drive not connected (connect it from the dashboard).';
    }

    // The tailored résumé belongs in the Applications pipeline. Reuse the job's
    // application if it has one; otherwise create one now (stage 'interested')
    // so a résumé tailored straight from /swipe isn't orphaned.
    let appRow = (
      await sb.from('applications').select('id').eq('job_id', job_id).maybeSingle()
    ).data;
    if (!appRow) {
      const created = await sb
        .from('applications')
        .insert({
          job_id,
          company: job.company,
          title: job.title,
          url: job.url,
          location: job.location,
          remote_type: job.remote_type,
          source: job.source,
          match_score: existingScore?.final_score ?? null,
          stage: 'interested',
        })
        .select('id')
        .single();
      if (!created.error) appRow = created.data;
    }

    // Rescore the tailored résumé against the JD using the real scorer
    // (not the LLM's self-estimate). Does NOT touch job_scores — the swipe
    // queue still reflects the master-résumé score.
    let rescored: number | null = null;
    try {
      const r = await scoreWithResume(sectionsToText(tailoredResume), job);
      rescored = r.final_score;
    } catch {
      rescored = tailored.match_score_after ?? null;
    }

    const insert = await sb
      .from('resume_versions')
      .insert({
        base_resume_id: master.id,
        job_id,
        application_id: appRow?.id || null,
        company: job.company,
        role: job.title,
        docx_storage_path: docxPath,
        pdf_storage_path: pdfStoragePath,
        google_drive_file_id: googleFileId,
        match_score_before: existingScore?.final_score ?? null,
        match_score_after: rescored,
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
      score_before: existingScore?.final_score ?? null,
      score_after: rescored,
      doc_url: googleFileId ? docUrl(googleFileId) : null,
      ...(warning ? { warning } : {}),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
