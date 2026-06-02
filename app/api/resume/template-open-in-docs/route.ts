import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { getTemplateResume } from '@/lib/db/resumes';
import { uploadDocxAsGoogleDoc, docUrl } from '@/lib/google/drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TEMPLATE_DOC_KEY = 'template_doc';

/**
 * Convert the current template .docx to a Google Doc so it can be viewed in
 * Drive. Reuses the previously minted Doc when the template is unchanged
 * (id-matched, stored in app_settings) — re-uploading a new template makes a
 * fresh Doc on next open. The Doc shows the raw {placeholder} tags, which is
 * exactly what you want to confirm the loaded design.
 */
export async function POST() {
  try {
    const template = await getTemplateResume();
    if (!template?.storage_path) {
      return NextResponse.json({ error: 'No template uploaded yet.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: setting } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', TEMPLATE_DOC_KEY)
      .maybeSingle();
    const v = setting?.value as { resume_id?: string; file_id?: string } | undefined;
    if (v?.file_id && v.resume_id === template.id) {
      return NextResponse.json({ ok: true, url: docUrl(v.file_id) });
    }

    const dl = await sb.storage.from(env.storageBucket).download(template.storage_path);
    if (dl.error || !dl.data) throw dl.error || new Error('Failed to download template');
    const docx = Buffer.from(await dl.data.arrayBuffer());

    const { fileId } = await uploadDocxAsGoogleDoc(
      `Résumé template — ${template.filename}`.slice(0, 120),
      docx,
    );

    const up = await sb.from('app_settings').upsert(
      {
        key: TEMPLATE_DOC_KEY,
        value: { resume_id: template.id, file_id: fileId },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
    if (up.error) throw up.error;

    return NextResponse.json({ ok: true, url: docUrl(fileId) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
