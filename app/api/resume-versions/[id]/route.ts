import { NextRequest, NextResponse } from 'next/server';
import { updateResumeVersion } from '@/lib/db/resume-versions';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const out = await updateResumeVersion(params.id, body);
    return NextResponse.json({ version: out });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
