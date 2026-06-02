// One-time helper to mint a Google OAuth refresh token for the Drive round-trip.
//
// Prereqs (Google Cloud Console):
//   1. Enable the Google Drive API on your project.
//   2. OAuth consent screen: External, publishing "Testing", add your Google
//      account as a test user.
//   3. Create an OAuth 2.0 Client ID of type "Desktop app".
//
// Run:
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-auth.mjs
//
// It prints a consent URL. Open it, approve, paste the code back here. The
// script prints GOOGLE_REFRESH_TOKEN — add all three to .env.local.

import { createInterface } from 'readline';
import { google } from 'googleapis';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment first.');
  process.exit(1);
}

// "Out-of-band" redirect: Google shows the code on screen for you to paste.
const REDIRECT = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);

const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // force a refresh_token even on re-auth
  scope: SCOPES,
});

console.log('\n1. Open this URL and approve access:\n');
console.log(url);
console.log('\n2. Paste the authorization code here:\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('Code: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2.getToken(code.trim());
    if (!tokens.refresh_token) {
      console.error(
        '\nNo refresh_token returned. Revoke the app at https://myaccount.google.com/permissions and retry.',
      );
      process.exit(1);
    }
    console.log('\nAdd this to .env.local:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } catch (e) {
    console.error('\nToken exchange failed:', e.message || e);
    process.exit(1);
  }
});
