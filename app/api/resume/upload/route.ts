import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { parseResumeFile, structureResume } from '@/lib/resume/parse';
import { lintTemplate } from '@/lib/resume/render-from-template';
import { updateProfile } from '@/lib/db/profile';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    const type = form.get('type') === 'template' ? 'template' : 'master';
    const buf = Buffer.from(await file.arrayBuffer());
    const sb = supabaseAdmin();

    // Template: the design + {placeholder} tags live here. Store the raw .docx
    // untouched — no text/JSON parsing, no profile update. docxtemplater needs a
    // real .docx, so reject other formats up front.
    if (type === 'template') {
      if (!file.name.toLowerCase().endsWith('.docx')) {
        return NextResponse.json(
          { error: 'Template must be a .docx file (it holds your design + {placeholder} tags).' },
          { status: 400 },
        );
      }
      // Validate tags up front so problems surface here, not at first tailor.
      try {
        lintTemplate(buf);
      } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Invalid template' }, { status: 400 });
      }
      const tplPath = `templates/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
      const tplUp = await sb.storage.from(env.storageBucket).upload(tplPath, buf, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });
      if (tplUp.error) throw tplUp.error;
      const tplIns = await sb
        .from('resumes')
        .insert({ type: 'template', filename: file.name, storage_path: tplPath })
        .select()
        .single();
      if (tplIns.error) throw tplIns.error;
      return NextResponse.json({ ok: true, resume: tplIns.data });
    }

    const text = await parseResumeFile(file.name, buf);
    const path = `master/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const up = await sb.storage.from(env.storageBucket).upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });
    if (up.error) throw up.error;

    let parsedJson: any = null;
    try {
      parsedJson = await structureResume(text);
    } catch {
      // AI not configured or failed; preserve text only
    }

    const ins = await sb
      .from('resumes')
      .insert({
        type: 'master',
        filename: file.name,
        storage_path: path,
        parsed_text: text,
        parsed_json: parsedJson,
      })
      .select()
      .single();
    if (ins.error) throw ins.error;

    await updateProfile({ resume_text: text });

    return NextResponse.json({ ok: true, resume: ins.data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
