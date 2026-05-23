import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { AiResult, CompleteOpts } from './provider';

let client: OpenAI | null = null;
function get() {
  if (!client) client = new OpenAI({ apiKey: env.openaiKey });
  return client;
}

export async function completeWithOpenAI(opts: CompleteOpts): Promise<AiResult> {
  const res = await get().chat.completions.create({
    model: env.openaiModel,
    max_tokens: opts.maxTokens ?? 2000,
    response_format: opts.json ? { type: 'json_object' } : undefined,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.prompt },
    ],
  });
  return {
    text: res.choices[0]?.message?.content || '',
    usage: {
      provider: 'openai',
      model: env.openaiModel,
      input_tokens: res.usage?.prompt_tokens ?? 0,
      output_tokens: res.usage?.completion_tokens ?? 0,
    },
  };
}
