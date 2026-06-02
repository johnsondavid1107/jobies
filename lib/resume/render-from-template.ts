import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { ResumeSections } from '@/lib/ai/prompts';

/**
 * Flatten ResumeSections into a tag-friendly object for docxtemplater.
 * Every key is always present (default '' / []) so optional template tags
 * never throw, and derived fields (contact line, date ranges) are precomputed
 * so the template author doesn't have to assemble them.
 */
function toTemplateData(s: ResumeSections) {
  const h = s.header || {};
  const range = (start?: string, end?: string) => [start, end].filter(Boolean).join(' – ');
  return {
    name: h.name || '',
    email: h.email || '',
    phone: h.phone || '',
    location: h.location || '',
    links: h.links || [],
    contact: [h.email, h.phone, h.location, ...(h.links || [])].filter(Boolean).join(' · '),
    summary: s.summary || '',
    experience: (s.experience || []).map((e) => ({
      company: e.company || '',
      title: e.title || '',
      location: e.location || '',
      start: e.start || '',
      end: e.end || '',
      dates: range(e.start, e.end),
      bullets: e.bullets || [],
    })),
    education: (s.education || []).map((ed) => ({
      school: ed.school || '',
      degree: ed.degree || '',
      start: ed.start || '',
      end: ed.end || '',
      dates: range(ed.start, ed.end),
      notes: ed.notes || '',
    })),
    skills: s.skills || [],
    skillsLine: (s.skills || []).join(' · '),
    projects: (s.projects || []).map((p) => ({
      name: p.name || '',
      description: p.description || '',
      bullets: p.bullets || [],
    })),
    certifications: s.certifications || [],
    other: (s.other || []).map((o) => ({
      heading: o.heading || '',
      items: o.items || [],
    })),
  };
}

/** Format docxtemplater's aggregated tag errors into one actionable message. */
function formatTagErrors(err: any): string | null {
  const errors = err?.properties?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const parts = errors.map((e: any) => {
    const tag = e?.properties?.xtag || e?.properties?.id || e?.properties?.tag || '?';
    const explanation = e?.properties?.explanation || e?.message || 'invalid tag';
    return `{${tag}} — ${explanation}`;
  });
  return `Template tag error(s): ${parts.join('; ')}. Fix these in your template .docx and re-upload.`;
}

/**
 * Render tailored content into the user's own .docx template, preserving its
 * exact design. The template is the source of truth for formatting.
 */
export function renderResumeFromTemplate(templateDocx: Buffer, sections: ResumeSections): Buffer {
  let zip: PizZip;
  try {
    zip = new PizZip(templateDocx);
  } catch {
    throw new Error("Uploaded template isn't a valid .docx file.");
  }

  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
  } catch (err: any) {
    const msg = formatTagErrors(err);
    if (msg) throw new Error(msg);
    throw new Error("Uploaded template isn't a valid .docx file.");
  }

  try {
    doc.render(toTemplateData(sections));
  } catch (err: any) {
    const msg = formatTagErrors(err);
    if (msg) throw new Error(msg);
    throw err;
  }

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// Fully-populated sample so every documented tag resolves during linting; any
// tag the linter still can't resolve is therefore an unknown/typo'd tag.
const PROBE: ResumeSections = {
  header: { name: 'x', email: 'x', phone: 'x', location: 'x', links: ['x'] },
  summary: 'x',
  experience: [{ company: 'x', title: 'x', location: 'x', start: 'x', end: 'x', bullets: ['x'] }],
  education: [{ school: 'x', degree: 'x', start: 'x', end: 'x', notes: 'x' }],
  skills: ['x'],
  projects: [{ name: 'x', description: 'x', bullets: ['x'] }],
  certifications: ['x'],
  other: [{ heading: 'x', items: ['x'] }],
};

/**
 * Validate an uploaded template at upload time. Throws a readable message for:
 *  - a non-.docx / corrupt file,
 *  - structural tag errors (unclosed/unopened loops, malformed tags),
 *  - unknown/misspelled tags not in the documented set.
 * docxtemplater silently renders unknown scalar tags as blank, so we detect them
 * by rendering against PROBE (everything populated) with a recording nullGetter.
 */
export function lintTemplate(templateDocx: Buffer): void {
  let zip: PizZip;
  try {
    zip = new PizZip(templateDocx);
  } catch {
    throw new Error("Uploaded template isn't a valid .docx file.");
  }

  const unknown = new Set<string>();
  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: (part: any) => {
        if (part?.value) unknown.add(part.value);
        return '';
      },
    });
  } catch (err: any) {
    const msg = formatTagErrors(err);
    if (msg) throw new Error(msg);
    throw new Error("Uploaded template isn't a valid .docx file.");
  }

  try {
    doc.render(toTemplateData(PROBE));
  } catch (err: any) {
    const msg = formatTagErrors(err);
    if (msg) throw new Error(msg);
    throw err;
  }

  if (unknown.size) {
    const tags = [...unknown].map((t) => `{${t}}`).join(', ');
    throw new Error(
      `Unknown template tag(s): ${tags}. Use only the documented tags (see docs/RESUME_TAILORING.md) and re-upload.`,
    );
  }
}
