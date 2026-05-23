import { NextRequest, NextResponse } from 'next/server';
import { recordSwipe } from '@/lib/db/swipes';
import { SwipeAction } from '@/lib/db/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: SwipeAction = body.action;
    if (!body.job_id || !action) {
      return NextResponse.json({ error: 'job_id and action required' }, { status: 400 });
    }
    await recordSwipe(body.job_id, action);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
