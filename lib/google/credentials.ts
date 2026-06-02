import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const SETTINGS_KEY = 'google_oauth';

export interface GoogleConnection {
  refresh_token: string;
  email: string | null;
  connected_at: string;
}

/** OAuth2 client built from the env client id/secret. `redirectUri` is needed
 *  only for the interactive web flow (start/callback); token refresh doesn't use it. */
export function oauthClient(redirectUri?: string) {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new Error('Google OAuth not configured (need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
  }
  return new google.auth.OAuth2(env.googleClientId, env.googleClientSecret, redirectUri);
}

/** Read the stored connection from the DB (the source of truth once connected in-app). */
export async function getStoredConnection(): Promise<GoogleConnection | null> {
  try {
    const { data } = await supabaseAdmin()
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();
    const v = data?.value as GoogleConnection | undefined;
    return v?.refresh_token ? v : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the active refresh token: DB-stored connection first (set via the
 * dashboard Connect flow), then the legacy `GOOGLE_REFRESH_TOKEN` env var.
 */
export async function getRefreshToken(): Promise<{ token: string; source: 'db' | 'env' } | null> {
  const conn = await getStoredConnection();
  if (conn?.refresh_token) return { token: conn.refresh_token, source: 'db' };
  if (env.googleRefreshToken) return { token: env.googleRefreshToken, source: 'env' };
  return null;
}

/** Persist a refresh token (+ optional email) obtained from the OAuth callback. */
export async function saveConnection(refresh_token: string, email: string | null): Promise<void> {
  const value: GoogleConnection = { refresh_token, email, connected_at: new Date().toISOString() };
  const { error } = await supabaseAdmin()
    .from('app_settings')
    .upsert({ key: SETTINGS_KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}
