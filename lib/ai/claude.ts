import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';
import type { AiResult, CompleteOpts } from './provider';

let client: Anthropic | null = null;
function get() {
  if (!client) client = new Anthropic({ apiKey: env.anthropicKey });
  return client;
}

export async function completeWithClaude(opts: CompleteOpts): Promise<AiResult> {
  const res = await get().messages.create({
    model: env.anthropicModel,
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system + (opts.json ? '\n\nReturn ONLY valid JSON. No commentary.' : ''),
    messages: [{ role: 'user', content: opts.prompt }],
  });
  const text = res.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');
  return {
    text,
    usage: {
      provider: 'anthropic',
      model: env.anthropicModel,
      input_tokens: res.usage?.input_tokens ?? 0,
      output_tokens: res.usage?.output_tokens ?? 0,
    },
  };
}
