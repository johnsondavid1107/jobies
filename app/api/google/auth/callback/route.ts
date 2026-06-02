import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { oauthClient, saveConnection } from '@/lib/google/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * OAuth callback: exchanges the authorization code for tokens, captures the
 * refresh token, and persists it to the DB (app_settings). Redirects back to
 * the dashboard with a status flag.
 */
export async function GET(req: NextRequest) {
  const dash = new URL('/dashboard', req.nextUrl.origin);
  const code = req.nextUrl.searchParams.get('code');
  const oauthErr = req.nextUrl.searchParams.get('error');

  if (oauthErr) {
    dash.searchParams.set('google', 'error');
    dash.searchParams.set('detail', oauthErr);
    return NextResponse.redirect(dash);
  }
  if (!code) {
    dash.searchParams.set('google', 'error');
    dash.searchParams.set('detail', 'no_code');
    return NextResponse.redirect(dash);
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/google/auth/callback`;
    const client = oauthClient(redirectUri);
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      // Happens if the user previously granted without a fresh consent prompt.
      dash.searchParams.set('google', 'error');
      dash.searchParams.set('detail', 'no_refresh_token');
      return NextResponse.redirect(dash);
    }

    // Best-effort: capture which Google account was connected.
    let email: string | null = null;
    try {
      client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: client });
      const about = await drive.about.get({ fields: 'user(emailAddress)' });
      email = about.data.user?.emailAddress || null;
    } catch {
      /* non-fatal — email is just a nicety */
    }

    await saveConnection(tokens.refresh_token, email);
    dash.searchParams.set('google', 'connected');
    return NextResponse.redirect(dash);
  } catch (e: any) {
    dash.searchParams.set('google', 'error');
    dash.searchParams.set('detail', (e?.message || 'exchange_failed').slice(0, 120));
    return NextResponse.redirect(dash);
  }
}
