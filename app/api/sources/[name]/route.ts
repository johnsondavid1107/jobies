import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { name: string } }) {
  try {
    const body = await req.json();
    const patch: Record<string, any> = {};
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
    if (body.config_json && typeof body.config_json === 'object') patch.config_json = body.config_json;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('job_sources')
      .update(patch)
      .eq('name', params.name)
      .select('name, enabled, config_json')
      .single();
    if (error) throw error;
    return NextResponse.json({ source: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
