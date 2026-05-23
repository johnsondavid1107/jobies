import { configStatus } from '@/lib/env';

export function ConfigBanner() {
  const s = configStatus();
  const missing: string[] = [];
  if (!s.supabase) missing.push('Supabase');
  if (!s.ai) missing.push('Anthropic or OpenAI');
  if (missing.length === 0) return null;
  return (
    <div className="border-b border-warn/25 bg-warn/[0.08] text-warn">
      <div className="mx-auto max-w-6xl px-4 py-2 text-sm">
        Missing config: <strong>{missing.join(', ')}</strong>. See <code>.env.example</code> and{' '}
        <code>README.md</code>.
      </div>
    </div>
  );
}
