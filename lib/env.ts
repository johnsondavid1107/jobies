export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'resumes',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-4-7',
  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  adzunaId: process.env.ADZUNA_APP_ID || '',
  adzunaKey: process.env.ADZUNA_APP_KEY || '',
  adzunaCountry: process.env.ADZUNA_COUNTRY || 'us',
  apifyToken: process.env.APIFY_API_TOKEN || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
};

export function configStatus() {
  return {
    supabase: !!(env.supabaseUrl && env.supabaseAnonKey),
    supabaseAdmin: !!env.supabaseServiceKey,
    anthropic: !!env.anthropicKey,
    openai: !!env.openaiKey,
    ai: !!(env.anthropicKey || env.openaiKey),
    adzuna: !!(env.adzunaId && env.adzunaKey),
    google: !!(env.googleClientId && env.googleClientSecret && env.googleRefreshToken),
  };
}
