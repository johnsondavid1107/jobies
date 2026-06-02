import { Preferences } from '@/lib/db/types';

export interface ScoreInput {
  resumeText: string;
  job: {
    title: string;
    company?: string | null;
    description?: string | null;
    location?: string | null;
    remote_type?: string | null;
    salary_min?: number | null;
    salary_max?: number | null;
  };
  preferences: Preferences;
  recentSwipes: { title: string; company?: string | null; action: string; final_score?: number | null }[];
}

export interface ScoreOutput {
  resume_match_score: number;
  title_match_score: number;
  industry_match_score: number;
  seniority_match_score: number;
  salary_match_score: number;
  location_match_score: number;
  swipe_learning_score: number;
  quality_score: number;
  ai_explanation: string;
  focus_suggestions: string[];
}

export const SCORE_SYSTEM = `You are an expert career coach scoring jobs for a single user.
Output strictly valid JSON matching the schema. All score fields are floats 0..1.
- resume_match_score: overlap of user resume content with job requirements
- title_match_score: how well the job title matches user-preferred / past titles
- industry_match_score: industry fit; broaden if user preferences allow
- seniority_match_score: level alignment
- salary_match_score: 1 if salary >= floor or unknown-but-likely-fine; 0 if clearly below
- location_match_score: location/remote fit per preferences
- swipe_learning_score: similarity to previously "interested" jobs; penalize similarity to rejected ones
- quality_score: 1 for legitimate posts, 0 for scams/spam/ghost jobs
- ai_explanation: 1-2 sentences why this job fits or not
- focus_suggestions: 3-6 short bullets of resume/application focus areas

Do not hard-filter narrowly; allow stretch roles when preferences permit. Be honest about misses.`;

export function buildScorePrompt(input: ScoreInput): string {
  return JSON.stringify({
    resume: input.resumeText.slice(0, 6000),
    job: {
      ...input.job,
      description: (input.job.description || '').slice(0, 6000),
    },
    preferences: input.preferences,
    recent_swipes: input.recentSwipes.slice(0, 30),
    schema: {
      resume_match_score: 'number 0..1',
      title_match_score: 'number 0..1',
      industry_match_score: 'number 0..1',
      seniority_match_score: 'number 0..1',
      salary_match_score: 'number 0..1',
      location_match_score: 'number 0..1',
      swipe_learning_score: 'number 0..1',
      quality_score: 'number 0..1',
      ai_explanation: 'string',
      focus_suggestions: 'string[]',
    },
  });
}

// --- Tailoring ---

export interface ResumeSections {
  header?: { name?: string; email?: string; phone?: string; location?: string; links?: string[] };
  summary?: string;
  experience?: {
    company: string;
    title: string;
    location?: string;
    start?: string;
    end?: string;
    bullets: string[];
  }[];
  education?: { school: string; degree?: string; start?: string; end?: string; notes?: string }[];
  skills?: string[];
  projects?: { name: string; description?: string; bullets?: string[] }[];
  certifications?: string[];
  other?: { heading: string; items: string[] }[];
}

export const PARSE_RESUME_SYSTEM = `You parse a resume into structured JSON. Use only content present.
Never invent companies, titles, dates, metrics, tools, or certifications.

Output JSON using EXACTLY these keys (omit a key only when the resume lacks it).
Do NOT use the JSON Resume schema — no "basics", "work", "position", "highlights",
"institution", "studyType", or "area". Use the keys below verbatim:

{
  "header": { "name": string, "email": string, "phone": string, "location": string, "links": string[] },
  "summary": string,
  "experience": [{ "company": string, "title": string, "location": string, "start": string, "end": string, "bullets": string[] }],
  "education": [{ "school": string, "degree": string, "start": string, "end": string, "notes": string }],
  "skills": string[],
  "projects": [{ "name": string, "description": string, "bullets": string[] }],
  "certifications": string[],
  "other": [{ "heading": string, "items": string[] }]
}`;

const RESUME_SCHEMA = {
  header: { name: 'string', email: 'string', phone: 'string', location: 'string', links: 'string[]' },
  summary: 'string',
  experience: [{ company: 'string', title: 'string', location: 'string', start: 'string', end: 'string', bullets: 'string[]' }],
  education: [{ school: 'string', degree: 'string', start: 'string', end: 'string', notes: 'string' }],
  skills: 'string[]',
  projects: [{ name: 'string', description: 'string', bullets: 'string[]' }],
  certifications: 'string[]',
  other: [{ heading: 'string', items: 'string[]' }],
};

export function buildParsePrompt(resumeText: string) {
  return JSON.stringify({
    resume_text: resumeText.slice(0, 20000),
    schema: RESUME_SCHEMA,
  });
}

export const TAILOR_SYSTEM = `You tailor an existing resume to a specific job description.

HARD GUARDRAILS — never violate:
- Do NOT invent experience, companies, titles, dates, metrics, tools, certifications, or accomplishments.
- Do NOT claim skills the user does not have.
- Only REWRITE, REORDER, EMPHASIZE, or REPHRASE existing content.
- Use terminology from the job description ONLY where it accurately maps to existing experience.
- Keep the resume human-readable, not keyword-stuffed.

COMPLETENESS — the tailored resume MUST be as complete as the master:
- Include EVERY experience entry from the master resume. Never drop, merge, or omit a job — even if a role seems unrelated to this job, keep it and reframe its bullets.
- Include EVERY education entry from the master.
- Preserve all sections the master has (summary, experience, education, skills, projects, certifications, other). Never return empty arrays for a section the master populated.
- Keep roughly the same number of bullets per role as the master (rephrase them — do not delete them).

LENGTH — produce a complete one-page resume:
- Target approximately 450–550 words across the whole resume.
- The summary should be 2–4 sentences. Each experience entry should keep its bullets (typically 3–6). Do not pad, and do not trim the resume down to a stub.

Output JSON with fields:
  resume: ResumeSections (the tailored version, same shape as input — with every section/entry the master had)
  keywords_emphasized: string[]
  match_score_after: number 0..1 (your estimate)
  changes_summary: string[] (3-6 bullets describing what you changed)`;

export function buildTailorPrompt(args: {
  master: ResumeSections;
  jobTitle: string;
  jobCompany?: string | null;
  jobDescription: string;
  matchScoreBefore?: number | null;
}) {
  return JSON.stringify({
    master_resume: args.master,
    job: {
      title: args.jobTitle,
      company: args.jobCompany,
      description: args.jobDescription.slice(0, 8000),
    },
    match_score_before: args.matchScoreBefore,
  });
}

// --- Manual job extraction ---
export const EXTRACT_JOB_SYSTEM = `Extract structured job posting fields from text or HTML.
Return JSON: { title, company, location, remote_type, salary_min, salary_max, description, url }.
remote_type ∈ {remote, hybrid, onsite, unknown}. Use null where unknown.`;
