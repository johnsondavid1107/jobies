import { NextResponse } from 'next/server';
import { getJob } from '@/lib/db/jobs';
import { scoreAndPersist } from '@/lib/scoring/score';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const job = await getJob(params.id);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    const score = await scoreAndPersist(job);
    return NextResponse.json({ ok: true, score });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
