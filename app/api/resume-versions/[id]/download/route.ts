import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Download a tailored résumé file. Mints a fresh Supabase signed URL at click
 * time and 302-redirects to it, so links embedded in pages (e.g. the
 * applications hub) never go stale from the 1-hour signed-URL expiry.
 *
 * `?format=pdf` (default) or `?format=docx`.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const format = req.nextUrl.searchParams.get('format') === 'docx' ? 'docx' : 'pdf';
    const sb = supabaseAdmin();
    const { data: v, error } = await sb
      .from('resume_versions')
      .select('docx_storage_path, pdf_storage_path')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!v) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

    const path = format === 'docx' ? v.docx_storage_path : v.pdf_storage_path;
    if (!path) {
      return NextResponse.json(
        { error: `No ${format.toUpperCase()} available for this version.` },
        { status: 404 },
      );
    }

    const { data: signed, error: signErr } = await sb.storage
      .from(env.storageBucket)
      .createSignedUrl(path, 3600);
    if (signErr || !signed?.signedUrl) throw signErr || new Error('Could not sign URL');

    return NextResponse.redirect(signed.signedUrl);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
