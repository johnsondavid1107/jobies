import { ResumeSections } from '@/lib/ai/prompts';

/**
 * Coerce a parsed résumé object into the app's `ResumeSections` shape.
 *
 * Accepts EITHER the app schema (`header`/`experience`/`bullets`/…) OR the
 * popular JSON Resume schema (`basics`/`work`/`position`/`highlights`/…). The
 * parsing LLM has historically emitted JSON Resume keys, which silently dropped
 * everything except `summary` downstream (the template renderer and tailor LLM
 * only read the app keys). Normalizing at the boundary makes the pipeline
 * resilient to both shapes — no re-upload required for résumés already stored
 * in the wrong shape.
 */
export function normalizeResumeSections(raw: any): ResumeSections {
  if (!raw || typeof raw !== 'object') return {};

  const arr = (v: any): string[] =>
    Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : String(x ?? ''))).filter(Boolean) : [];
  const hasAny = (o: Record<string, any>) => Object.values(o).some((v) => v != null && v !== '');

  const basics = raw.basics || {};
  const headerSrc = raw.header || {};

  const rawLoc = headerSrc.location ?? basics.location;
  const location =
    typeof rawLoc === 'string'
      ? rawLoc
      : rawLoc
      ? [rawLoc.city, rawLoc.region || rawLoc.state, rawLoc.countryCode].filter(Boolean).join(', ') || undefined
      : undefined;

  const links =
    Array.isArray(headerSrc.links) && headerSrc.links.length
      ? arr(headerSrc.links)
      : Array.isArray(basics.profiles)
      ? basics.profiles.map((p: any) => p?.url || p?.username).filter(Boolean)
      : undefined;

  const header = {
    name: headerSrc.name ?? basics.name,
    email: headerSrc.email ?? basics.email,
    phone: headerSrc.phone ?? basics.phone,
    location,
    links,
  };

  const expSrc = raw.experience ?? raw.work ?? [];
  const experience = (Array.isArray(expSrc) ? expSrc : []).map((e: any) => ({
    company: e.company ?? e.name ?? '',
    title: e.title ?? e.position ?? '',
    location: e.location ?? undefined,
    start: e.start ?? e.startDate ?? undefined,
    end: e.end ?? e.endDate ?? undefined,
    bullets: arr(e.bullets ?? e.highlights),
  }));

  const eduSrc = raw.education ?? [];
  const education = (Array.isArray(eduSrc) ? eduSrc : []).map((ed: any) => ({
    school: ed.school ?? ed.institution ?? '',
    degree: ed.degree ?? ([ed.studyType, ed.area].filter(Boolean).join(' ') || undefined),
    start: ed.start ?? ed.startDate ?? undefined,
    end: ed.end ?? ed.endDate ?? undefined,
    notes: ed.notes ?? undefined,
  }));

  const skills = Array.isArray(raw.skills)
    ? raw.skills
        .map((s: any) =>
          typeof s === 'string' ? s : s?.name || (Array.isArray(s?.keywords) ? s.keywords.join(', ') : ''),
        )
        .filter(Boolean)
    : undefined;

  const projects = Array.isArray(raw.projects)
    ? raw.projects.map((p: any) => ({
        name: p.name || '',
        description: p.description || undefined,
        bullets: arr(p.bullets ?? p.highlights),
      }))
    : undefined;

  const certSrc = raw.certifications ?? raw.certificates;
  const certifications = Array.isArray(certSrc)
    ? certSrc.map((c: any) => (typeof c === 'string' ? c : c?.name)).filter(Boolean)
    : undefined;

  const other = Array.isArray(raw.other)
    ? raw.other.map((o: any) => ({ heading: o.heading || '', items: arr(o.items) }))
    : undefined;

  return {
    header: hasAny(header) ? header : undefined,
    summary: raw.summary ?? basics.summary ?? undefined,
    experience: experience.length ? experience : undefined,
    education: education.length ? education : undefined,
    skills,
    projects,
    certifications,
    other,
  };
}
