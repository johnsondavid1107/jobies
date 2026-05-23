import mammoth from 'mammoth';
import { aiComplete, extractJson } from '@/lib/ai/provider';
import { PARSE_RESUME_SYSTEM, buildParsePrompt, ResumeSections } from '@/lib/ai/prompts';

export async function parseDocxBuffer(buf: Buffer): Promise<string> {
  const res = await mammoth.extractRawText({ buffer: buf });
  return res.value.replace(/\r/g, '').trim();
}

export async function parsePdfBuffer(buf: Buffer): Promise<string> {
  // Lazy import to avoid pdf-parse test harness issues at build time.
  const pdfParse = (await import('pdf-parse')).default;
  const res = await pdfParse(buf);
  return (res.text || '').trim();
}

export async function parseResumeFile(filename: string, buf: Buffer): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.docx')) return parseDocxBuffer(buf);
  if (lower.endsWith('.pdf')) return parsePdfBuffer(buf);
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return buf.toString('utf8').trim();
  throw new Error('Unsupported resume format: ' + filename);
}

export async function structureResume(text: string): Promise<ResumeSections> {
  const raw = await aiComplete({
    system: PARSE_RESUME_SYSTEM,
    prompt: buildParsePrompt(text),
    json: true,
    maxTokens: 3000,
  });
  try {
    return extractJson<ResumeSections>(raw);
  } catch {
    // Fall back to a minimal one-section resume
    return { summary: text.slice(0, 1500) };
  }
}
