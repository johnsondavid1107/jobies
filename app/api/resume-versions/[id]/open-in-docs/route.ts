import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { uploadDocxAsGoogleDoc, docUrl } from '@/lib/google/drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = supabaseAdmin();
    const { data: version, error } = await sb
      .from('resume_versions')
      .select('id, company, role, docx_storage_path, google_drive_file_id')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

    // Reuse the live Doc if one already exists — don't create duplicates.
    if (version.google_drive_file_id) {
      return NextResponse.json({ ok: true, url: docUrl(version.google_drive_file_id) });
    }

    if (!version.docx_storage_path) {
      return NextResponse.json({ error: 'Version has no DOCX to open' }, { status: 400 });
    }

    const dl = await sb.storage.from(env.storageBucket).download(version.docx_storage_path);
    if (dl.error || !dl.data) throw dl.error || new Error('Failed to download DOCX');
    const docx = Buffer.from(await dl.data.arrayBuffer());

    const name = `${version.company || 'Resume'} — ${version.role || 'Tailored'}`.slice(0, 120);
    const { fileId } = await uploadDocxAsGoogleDoc(name, docx);

    const up = await sb
      .from('resume_versions')
      .update({ google_drive_file_id: fileId })
      .eq('id', params.id);
    if (up.error) throw up.error;

    return NextResponse.json({ ok: true, url: docUrl(fileId) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
