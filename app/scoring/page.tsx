import { ScoringPanel } from '@/components/ScoringPanel';
import { getProfile } from '@/lib/db/profile';
import { hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ScoringPage() {
  if (!hasSupabase()) return <div className="card p-6 text-sm">Configure Supabase to manage scoring.</div>;
  const profile = await getProfile();
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">Tuning</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Scoring controls</h1>
        <p className="mt-1 text-sm text-ink/60">
          Adjust how recommendations are ranked. Soft scoring — no hard filters by title.
        </p>
      </div>
      <ScoringPanel
        initialWeights={profile.scoring_weights_json}
        initialPreferences={profile.preferences_json}
      />
    </div>
  );
}
