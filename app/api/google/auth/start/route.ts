import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { oauthClient, GOOGLE_SCOPES } from '@/lib/google/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Kick off the Google OAuth web flow. Redirects to Google's consent screen with
 * a redirect_uri pointing back at our callback. The redirect_uri is derived from
 * the request origin, so it must be registered on the OAuth client:
 *   <origin>/api/google/auth/callback
 * (Desktop-type clients accept http://localhost loopback URIs automatically.)
 */
export async function GET(req: NextRequest) {
  if (!env.googleClientId || !env.googleClientSecret) {
    return NextResponse.json(
      { error: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before connecting.' },
      { status: 400 },
    );
  }
  const redirectUri = `${req.nextUrl.origin}/api/google/auth/callback`;
  const url = oauthClient(redirectUri).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token even on re-auth
    scope: GOOGLE_SCOPES,
  });
  return NextResponse.redirect(url);
}
