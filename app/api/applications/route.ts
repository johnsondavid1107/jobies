import { NextResponse } from 'next/server';
import { listApplications } from '@/lib/db/applications';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const apps = await listApplications();
    return NextResponse.json({ applications: apps });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
