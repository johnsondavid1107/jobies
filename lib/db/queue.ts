import { supabaseAdmin } from '@/lib/supabase/server';

export interface QueueJob {
  id: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string | null;
  location: string | null;
  remote_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  source: string;
  date_posted: string | null;
  discovered_at: string;
  final_score: number | null;
  ai_explanation: string | null;
  focus_suggestions: string[] | null;
}

export async function getSwipeQueue(limit = 50): Promise<QueueJob[]> {
  const sb = supabaseAdmin();
  const { data: swiped } = await sb.from('swipes').select('job_id');
  const swipedIds = (swiped || []).map((s) => s.job_id);
  let query = sb
    .from('jobs')
    .select('*, job_scores(final_score, ai_explanation, focus_suggestions)')
    .order('discovered_at', { ascending: false })
    .limit(limit);
  if (swipedIds.length > 0) {
    query = query.not('id', 'in', `(${swipedIds.map((id) => `"${id}"`).join(',')})`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || [])
    .filter((j: any) => isLocationEligible(j.remote_type, j.location, j.description))
    .map((j: any) => {
    const score = Array.isArray(j.job_scores) ? j.job_scores[0] : j.job_scores;
    return {
      id: j.id,
      title: j.title,
      company: j.company,
      description: j.description,
      url: j.url,
      location: j.location,
      remote_type: j.remote_type,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      source: j.source,
      date_posted: j.date_posted,
      discovered_at: j.discovered_at,
      final_score: score?.final_score ?? null,
      ai_explanation: score?.ai_explanation ?? null,
      focus_suggestions: score?.focus_suggestions ?? null,
    } as QueueJob;
  });
  rows.sort((a, b) => (b.final_score ?? -1) - (a.final_score ?? -1));
  return rows;
}

// Eligibility model: country-level US + remote (location OR description) pass.
// Empty/ambiguous locations pass — user can Skip in the deck. Drop only when the
// location clearly names a non-US country/region AND nothing signals US or remote.
const REMOTE_TOKENS = /\b(remote|worldwide|anywhere|work from home|wfh|distributed team)\b/i;

const US_LOCATION_TOKENS = /\b(united states|u\.s\.a\.?|u\.s\.|usa|us|north america|americas|nyc|new york|manhattan|brooklyn|queens|bronx|staten island|new jersey|jersey city|newark|hoboken|ny|nj)\b/i;

// Description-only remote signal: looks for "remote" with a US-friendly qualifier
// nearby so we don't accept "remote, EU only" as eligible. Falls back to a generic
// "fully remote" / "100% remote" which usually means open globally.
const REMOTE_IN_DESCRIPTION = /\b(remote (within|in|across|throughout)?\s*(the\s*)?(us|usa|u\.s\.|united states|north america|anywhere)|us[- ]remote|usa[- ]remote|remote[- ]us|fully remote|100% remote|work from anywhere)\b/i;

const NON_US_TOKENS = /\b(united kingdom|uk only|england|scotland|wales|ireland|dublin|london|manchester|edinburgh|glasgow|belfast|germany|berlin|munich|hamburg|frankfurt|cologne|france|paris|lyon|marseille|spain|madrid|barcelona|valencia|italy|rome|milan|turin|netherlands|amsterdam|rotterdam|utrecht|belgium|brussels|antwerp|luxembourg|switzerland|zurich|geneva|basel|sweden|stockholm|gothenburg|norway|oslo|denmark|copenhagen|finland|helsinki|iceland|reykjavik|poland|warsaw|krakow|portugal|lisbon|porto|austria|vienna|czech republic|czechia|prague|hungary|budapest|romania|bucharest|bulgaria|sofia|greece|athens|croatia|zagreb|serbia|belgrade|slovakia|bratislava|slovenia|ljubljana|estonia|tallinn|latvia|riga|lithuania|vilnius|turkey|istanbul|ankara|russia|moscow|st petersburg|saint petersburg|ukraine|kyiv|kiev|belarus|minsk|israel|tel aviv|jerusalem|haifa|uae|dubai|abu dhabi|saudi arabia|riyadh|qatar|doha|kuwait|bahrain|oman|egypt|cairo|morocco|casablanca|south africa|johannesburg|cape town|nigeria|lagos|abuja|kenya|nairobi|ghana|accra|ethiopia|addis ababa|australia|sydney|melbourne|brisbane|perth|adelaide|canberra|new zealand|auckland|wellington|japan|tokyo|osaka|kyoto|china|beijing|shanghai|shenzhen|guangzhou|hong kong|singapore|south korea|seoul|busan|taiwan|taipei|india|bangalore|bengaluru|mumbai|new delhi|delhi|hyderabad|chennai|kolkata|pune|gurgaon|gurugram|noida|ahmedabad|jaipur|pakistan|karachi|islamabad|lahore|bangladesh|dhaka|sri lanka|colombo|philippines|manila|cebu|vietnam|hanoi|ho chi minh|thailand|bangkok|indonesia|jakarta|bali|malaysia|kuala lumpur|brazil|brasil|sao paulo|são paulo|rio de janeiro|brasilia|belo horizonte|mexico|mexico city|cdmx|guadalajara|monterrey|argentina|buenos aires|chile|santiago|colombia|bogota|bogotá|medellin|medellín|peru|lima|uruguay|montevideo|venezuela|caracas|ecuador|quito|costa rica|san jose costa rica|panama|panama city|dominican republic|cuba|havana|canada|toronto|vancouver|montreal|montréal|ottawa|calgary|edmonton|winnipeg|halifax|quebec|québec|ontario|british columbia|alberta|emea|apac|latam|emea\/apac|europe only|eu only|eu\/uk|uk\/eu|emea only|apac only|latam only)\b/i;

export function isLocationEligible(
  remoteType: string | null,
  location: string | null,
  description: string | null = null
): boolean {
  if (remoteType && remoteType.toLowerCase() === 'remote') return true;

  const loc = location || '';
  if (US_LOCATION_TOKENS.test(loc)) return true;
  if (REMOTE_TOKENS.test(loc)) return true;

  if (description && REMOTE_IN_DESCRIPTION.test(description)) return true;

  // No positive signal. Only drop when location clearly names a non-US locale.
  if (loc && NON_US_TOKENS.test(loc)) return false;

  // Empty or ambiguous — show it; user can Skip/Interested.
  return true;
}
