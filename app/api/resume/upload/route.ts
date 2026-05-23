import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { parseResumeFile, structureResume } from '@/lib/resume/parse';
import { updateProfile } from '@/lib/db/profile';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await parseResumeFile(file.name, buf);

    const sb = supabaseAdmin();
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
