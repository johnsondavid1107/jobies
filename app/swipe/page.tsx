import { SwipeDeck } from '@/components/SwipeDeck';
import { getSwipeQueue } from '@/lib/db/queue';
import { hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function SwipePage() {
  if (!hasSupabase()) {
    return (
      <div className="card p-6 text-sm">
        Configure Supabase to enable the swipe queue.
      </div>
    );
  }
  let jobs: any[] = [];
  let err: string | null = null;
  try {
    jobs = await getSwipeQueue();
  } catch (e: any) {
    err = e.message;
  }
  return (
    <div className="space-y-4">
      <div>
        {/* <p className="text-[11px] font-medium uppercase tracking-wider text-black/45">Triage</p> */}
        {/* <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Swipe queue</h1> */}
      </div>
      {err && <div className="card p-4 text-sm text-red-600">{err}</div>}
      <SwipeDeck initial={jobs} />
    </div>
  );
}
