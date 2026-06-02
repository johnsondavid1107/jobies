import { NextResponse } from 'next/server';
import { supabaseAdmin, hasSupabase } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { getTemplateResume } from '@/lib/db/resumes';
import { docUrl } from '@/lib/google/drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEMPLATE_DOC_KEY = 'template_doc';

/**
 * Current persisted résumé template, for the dashboard card. Confirms which
 * template is loaded (it survives restarts — latest `type='template'` row) and
 * surfaces a Supabase download plus a Google Docs link when one's been minted.
 */
export async function GET() {
  if (!hasSupabase()) return NextResponse.json({ exists: false, configured: false });
  try {
    const template = await getTemplateResume();
    if (!template?.storage_path) return NextResponse.json({ exists: false, configured: true });

    const sb = supabaseAdmin();
    const { data: signed } = await sb.storage
      .from(env.storageBucket)
      .createSignedUrl(template.storage_path, 3600);

    // Docs link only if we've already converted *this* template (id-matched).
    const { data: setting } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', TEMPLATE_DOC_KEY)
      .maybeSingle();
    const v = setting?.value as { resume_id?: string; file_id?: string } | undefined;
    const docs_url = v?.file_id && v.resume_id === template.id ? docUrl(v.file_id) : null;

    return NextResponse.json({
      exists: true,
      configured: true,
      filename: template.filename,
      uploaded_at: template.created_at,
      download_url: signed?.signedUrl || null,
      docs_url,
    });
  } catch (e: any) {
    return NextResponse.json({ exists: false, error: e.message || String(e) }, { status: 500 });
  }
}
