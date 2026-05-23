import { supabaseAdmin } from '@/lib/supabase/server';
import { DEFAULT_PREFERENCES, DEFAULT_WEIGHTS, Preferences, ScoringWeights } from './types';

export const PROFILE_ID = 'default';

export interface Profile {
  id: string;
  resume_text: string | null;
  preferences_json: Preferences;
  scoring_weights_json: ScoringWeights;
}

export async function getProfile(): Promise<Profile> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('profiles').select('*').eq('id', PROFILE_ID).maybeSingle();
  if (error) throw error;
  if (!data) {
    const row = {
      id: PROFILE_ID,
      resume_text: null,
      preferences_json: DEFAULT_PREFERENCES,
      scoring_weights_json: DEFAULT_WEIGHTS,
    };
    await sb.from('profiles').insert(row);
    return row;
  }
  return {
    id: data.id,
    resume_text: data.resume_text,
    preferences_json: { ...DEFAULT_PREFERENCES, ...(data.preferences_json || {}) },
    scoring_weights_json: { ...DEFAULT_WEIGHTS, ...(data.scoring_weights_json || {}) },
  };
}

export async function updateProfile(patch: Partial<Profile>) {
  const sb = supabaseAdmin();
  const { error } = await sb.from('profiles').update(patch).eq('id', PROFILE_ID);
  if (error) throw error;
}
