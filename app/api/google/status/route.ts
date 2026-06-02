import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getRefreshToken, getStoredConnection } from '@/lib/google/credentials';
import { getDrive } from '@/lib/google/drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live Google Drive connection status for the dashboard chip.
 * - configured: client id + secret present (app can run the OAuth flow)
 * - connected:  a refresh token is resolvable (DB or env)
 * - live:       a real Drive call succeeded with that token (catches expiry)
 */
export async function GET() {
  const configured = !!(env.googleClientId && env.googleClientSecret);
  const rt = await getRefreshToken();
  const connected = !!rt;

  let live = false;
  let email: string | null = null;
  let detail: string | null = null;

  if (connected) {
    try {
      const drive = await getDrive();
      const res = await drive.about.get({ fields: 'user(emailAddress,displayName)' });
      live = true;
      email = res.data.user?.emailAddress || null;
    } catch (e: any) {
      const msg = e?.message || String(e);
      detail = /invalid_grant|token|unauthorized|\b401\b|\b403\b/i.test(msg)
        ? 'Token expired or revoked — reconnect.'
        : msg;
    }
  }

  // Prefer the email captured at connect time if the live call didn't return one.
  if (!email) email = (await getStoredConnection())?.email ?? null;

  return NextResponse.json({
    configured,
    connected,
    live,
    email,
    source: rt?.source ?? null,
    detail,
  });
}
