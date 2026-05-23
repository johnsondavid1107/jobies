import { NextRequest, NextResponse } from 'next/server';
import { updateApplication } from '@/lib/db/applications';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = await updateApplication(params.id, body);
    return NextResponse.json({ application: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
