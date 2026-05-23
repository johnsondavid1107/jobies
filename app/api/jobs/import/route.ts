import { NextRequest, NextResponse } from 'next/server';
import { extractManualJob } from '@/lib/sources/manual';
import { upsertJob } from '@/lib/db/jobs';
import { scoreAndPersist } from '@/lib/scoring/score';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = await extractManualJob({ url: body.url, text: body.text });
    const job = await upsertJob(raw);
    try {
      await scoreAndPersist(job);
    } catch (e: any) {
      // Scoring failure is non-fatal; the job is still saved.
      return NextResponse.json({ ok: true, job, scoring_error: e.message });
    }
    return NextResponse.json({ ok: true, job });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
