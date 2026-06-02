import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Validate a board slug by hitting the ATS's public API directly. Returns
 * { ok, openings } so the dashboard can confirm a board exists and show the
 * job count before the user commits the slug to their pool.
 */
export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get('source') || '';
  const slug = (req.nextUrl.searchParams.get('slug') || '').trim().toLowerCase();
  if (!slug) return NextResponse.json({ ok: false, error: 'Missing slug' }, { status: 400 });

  try {
    let url = '';
    if (source === 'greenhouse') url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
    else if (source === 'lever') url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    else if (source === 'ashby') url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    else return NextResponse.json({ ok: false, error: 'Unknown source' }, { status: 400 });

    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ ok: false, status: res.status });
    const data = await res.json();
    const openings = Array.isArray(data) ? data.length : Array.isArray(data?.jobs) ? data.jobs.length : 0;
    return NextResponse.json({ ok: true, openings });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 });
  }
}
