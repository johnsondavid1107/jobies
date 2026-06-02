import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('job_sources')
      .select('name, enabled, config_json')
      .order('name');
    if (error) throw error;
    return NextResponse.json({ sources: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
