import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/server';
import { completeWithClaude } from './claude';
import { completeWithOpenAI } from './openai';

export interface CompleteOpts {
  system: string;
  prompt: string;
  maxTokens?: number;
  json?: boolean;
  // Optional metadata for telemetry; auto-logged to ai_outputs.
  jobId?: string;
  type?: string;
}

export interface AiUsage {
  provider: 'anthropic' | 'openai';
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export interface AiResult {
  text: string;
  usage: AiUsage;
}

export async function aiComplete(opts: CompleteOpts): Promise<string> {
  const errors: string[] = [];
  if (env.anthropicKey) {
    try {
      const r = await completeWithClaude(opts);
      void logUsage(r, opts);
      return r.text;
    } catch (e: any) {
      errors.push(`claude: ${e?.message || e}`);
    }
  }
  if (env.openaiKey) {
    try {
      const r = await completeWithOpenAI(opts);
      void logUsage(r, opts);
      return r.text;
    } catch (e: any) {
      errors.push(`openai: ${e?.message || e}`);
    }
  }
  if (errors.length === 0) throw new Error('No AI provider configured');
  throw new Error('All AI providers failed: ' + errors.join('; '));
}

async function logUsage(r: AiResult, opts: CompleteOpts) {
  try {
    await supabaseAdmin().from('ai_outputs').insert({
      job_id: opts.jobId ?? null,
      prompt: opts.type ?? 'complete',
      response: r.text.slice(0, 4000),
      type: opts.type ?? 'complete',
      provider: r.usage.provider,
      model: r.usage.model,
      input_tokens: r.usage.input_tokens,
      output_tokens: r.usage.output_tokens,
    });
  } catch {
    // telemetry must never break the main path
  }
}

export function extractJson<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : trimmed;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first === -1 || last === -1) throw new Error('No JSON object found');
  return JSON.parse(body.slice(first, last + 1)) as T;
}
