import { NextRequest, NextResponse } from 'next/server';
import { getProfile, updateProfile } from '@/lib/db/profile';
import { recalculateAllFinalScores } from '@/lib/scoring/score';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({ profile: await getProfile() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const patch: any = {};
    if (body.scoring_weights_json) patch.scoring_weights_json = body.scoring_weights_json;
    if (body.preferences_json) patch.preferences_json = body.preferences_json;
    await updateProfile(patch);
    let recalculated = 0;
    if (body.recalculate) recalculated = await recalculateAllFinalScores();
    return NextResponse.json({ ok: true, recalculated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
