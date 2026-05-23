import { aiComplete, extractJson } from '@/lib/ai/provider';
import { EXTRACT_JOB_SYSTEM } from '@/lib/ai/prompts';
import { RawJob } from './types';

export async function extractManualJob(input: { url?: string; text?: string }): Promise<RawJob> {
  let text = (input.text || '').trim();
  let fetchedUrl = input.url?.trim() || null;

  if (!text && fetchedUrl) {
    try {
      const r = await fetch(fetchedUrl, { redirect: 'follow' });
      const html = await r.text();
      text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      /* ignore — AI can still try with URL-only */
    }
  }

  let parsed: any = {};
  try {
    const raw = await aiComplete({
      system: EXTRACT_JOB_SYSTEM,
      prompt: JSON.stringify({ url: fetchedUrl, text: text.slice(0, 12000) }),
      json: true,
      maxTokens: 1500,
    });
    parsed = extractJson(raw);
  } catch {
    parsed = { title: 'Untitled job', description: text.slice(0, 4000) };
  }

  const id = (fetchedUrl || (parsed.title + ':' + (parsed.company || '')) || String(Date.now())).slice(0, 200);
  return {
    source: 'manual',
    source_job_id: id,
    title: parsed.title || 'Untitled job',
    company: parsed.company || null,
    description: parsed.description || text.slice(0, 8000) || null,
    url: parsed.url || fetchedUrl,
    location: parsed.location || null,
    remote_type: parsed.remote_type || 'unknown',
    salary_min: parsed.salary_min ?? null,
    salary_max: parsed.salary_max ?? null,
    date_posted: new Date().toISOString(),
    raw_data_json: { manual_input: input, ai_extracted: parsed },
  };
}
