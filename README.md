# Job Applicant Assistant (JAA)

A personal, single-user AI-powered job search OS. It pulls postings from multiple sources, scores them against your resume and preferences using an LLM, lets you triage them Tinder-style, tracks applications through a Kanban board, and produces tailored resume versions (DOCX + PDF) for specific jobs — with strict anti-fabrication guardrails.

No auth, no multi-tenancy. The whole thing is built around one user (you) running it locally or on a personal Vercel deployment.

---

## What it does — in one sentence per surface

| Surface | What it does |
| --- | --- |
| **`/swipe`** | Card deck of scored, location-eligible jobs. Drag, click, or use arrow keys to reject / save / mark-as-applied / mark-as-interested. |
| **`/applications`** | Kanban board of jobs you've moved past the swipe stage — drag cards between stages (interested → applied → interview → offer → rejected). Also has a table view. |
| **`/resume`** | Upload your master resume (DOCX or PDF). Parsed text becomes the source of truth that drives scoring and tailoring. |
| **`/resume-versions`** | Library of every tailored resume the app has generated, with the job it was tailored for, downloadable as DOCX + PDF. |
| **`/import`** | Paste a job URL or job description to manually add a job to the pool. |
| **`/scoring`** | Tune the eight signal weights (resume, title, industry, seniority, salary, location, swipe-learning, quality) and preferences (allow-stretch, exclude-scams, etc.). |
| **`/dashboard`** | Analytics: jobs seen/liked/skipped/applied, total LLM tokens used per provider/model, approximate USD cost. Refresh-jobs button. |

---

## Quick start

```bash
npm install
cp .env.example .env.local
# Fill in keys — the app boots without them and tells you what's missing in a banner.
npm run dev
```

Visit <http://localhost:3000>.

### Required setup

1. **Supabase**
   - Create a project. Put `URL`, `anon key`, `service_role key` into `.env.local`.
   - Open the SQL editor and run `supabase/schema.sql` — creates all tables and seeds the default profile + scoring weights + source rows.
   - In Storage, create a private bucket named `resumes` (override via `SUPABASE_STORAGE_BUCKET`).

2. **At least one AI provider key**
   - `ANTHROPIC_API_KEY` (primary, defaults to `claude-opus-4-7`)
   - `OPENAI_API_KEY` (fallback)
   - The provider abstraction (`lib/ai/provider.ts`) tries Claude first, then falls back to OpenAI on failure. Every call is auto-logged to `ai_outputs` with token counts for the dashboard.

3. **Enable job sources** (all disabled by default)
   - In the Supabase SQL editor: `update job_sources set enabled = true where name = '<source>';`
   - Then either provide env keys (Adzuna), board slugs (Greenhouse/Lever/Ashby), or use the defaults (Remotive).

### Schema migrations applied after the initial `schema.sql`

If the file is older than your DB, run these in order:

```sql
-- Dashboard token tracking (added 2026-05)
alter table ai_outputs
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer;
```

---

## Job sources

All sources implement the same `JobSourceAdapter` interface (`lib/sources/types.ts`) and produce a normalized `RawJob`. To add a source, drop a file in `lib/sources/` and register it in `registry.ts`.

| Source | What it pulls | Configuration |
| --- | --- | --- |
| **manual** | Whatever you paste at `/import` (URL fetch + AI parse, or raw JD text) | None |
| **remotive** | Public remote-job board, all categories | `config_json.limit` (default 50) |
| **greenhouse** | Public Greenhouse company boards | `GREENHOUSE_BOARDS` env (comma-separated company slugs) or `config_json.boards` |
| **lever** | Public Lever company boards | `LEVER_BOARDS` env or `config_json.boards` |
| **ashby** | Public Ashby company boards | `ASHBY_BOARDS` env or `config_json.boards` |
| **adzuna** | Adzuna aggregator API | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY`; `config_json.queries: [{what, where}]` |
| **wtj** | Stub. Welcome to the Jungle has no free public API — wire via Apify if needed | `APIFY_API_TOKEN` |

### How refresh works

`POST /api/jobs/refresh` (or the **Refresh jobs** button on `/swipe` and `/dashboard`):
1. Reads every enabled row from `job_sources`
2. Calls each adapter's `fetch()`
3. Upserts each `RawJob` into the `jobs` table (`(source, source_job_id)` is unique, so re-pulls are idempotent)
4. For any job without a `job_scores` row, runs AI scoring and persists the result. **Already-scored jobs are skipped** — refreshes get faster over time.

> ⚠️ **Known issue:** A cold refresh against a large Greenhouse board can run for 15+ minutes scoring hundreds of new jobs. The route's `maxDuration = 60` only applies on Vercel; locally it runs to completion. The frontend "Refresh jobs" button will hang for that long. Future work: chunk per-source or make the route fire-and-forget with progress polling.

---

## Features in detail

### Swipe queue (`/swipe`)

Card-deck triage UI. Each card shows:
- Title, company, location, remote type
- Match score as a ring badge (color hue maps to score band: ≥75% green, ≥55% accent, lower gray)
- Salary range (if known), source pill, "Open posting ↗" link
- AI explanation ("Why this fits")
- Application focus bullets (what to emphasize when applying)
- Raw description (scrollable inside the card)

**Interactions:**
- **Drag** the top card — horizontal commits to skip (left) or interested (right) past 130px **or** with a velocity flick (>600 px/s). Up commits to "save for later". Direction-aware exit: the card flies off in the direction of the gesture.
- **Buttons**: Skip / Save / Applied / Interested
- **Keyboard**: ← skip, → interested, ↑ save, ↓ already applied

**Location filter (hard-coded):** Only jobs that are remote, or based in NYC / NJ are shown. Multi-location strings pass if **any** segment matches. Defined in `lib/db/queue.ts → isLocationEligible()`. This is intentionally not configurable.

### Application tracker (`/applications`)

Kanban view (drag cards between stages) plus a table view. Stages: interested → applied → interview → offer → rejected. Jobs land here automatically when you mark them "interested" or "already applied" on the swipe screen.

### Resume parsing & tailoring (`/resume`, `/resume-versions`)

- Upload DOCX or PDF master resume. Parsed text is stored in `profiles.resume_text` and becomes the source of truth.
- The **Generate tailored resume** button on a job runs an AI rewrite step that produces a job-specific DOCX **and** PDF, stored in Supabase Storage and indexed in `resume_versions`.
- Both files are downloadable from `/resume-versions`, which also shows the job, company, and a delta (`match_score_before` → `match_score_after`).

### AI scoring (`/scoring`)

Every job gets eight subscores from the LLM, weighted into one `final_score` ∈ [0,1]:

| Signal | Default weight | What it measures |
| --- | --- | --- |
| resume_match | 30 | Overlap of your master resume with the JD |
| title_match | 15 | How close the job title is to your trajectory |
| industry_match | 10 | Industry alignment |
| seniority_match | 10 | Seniority fit (junior/mid/senior/staff) |
| salary_match | 10 | Compensation vs your preferences |
| location_match | 10 | Geographic / remote alignment |
| swipe_learning | 10 | Adjusts based on your last 30 swipes (the LLM sees them as priors) |
| quality | 5 | Generic posting quality (clear JD, real company, etc.) |

The prompt (`lib/ai/prompts.ts → SCORE_SYSTEM`) also emits `ai_explanation` and `focus_suggestions` for the UI.

Tune weights and preferences on `/scoring`. Hit **Recalculate all scores** to re-aggregate without re-calling the LLM.

### Dashboard (`/dashboard`)

Analytics on your activity and AI spend.

**Activity KPIs**
- Jobs in pool (total in `jobs` table)
- Seen (total `swipes` rows)
- Liked / Skipped / Saved (`swipes.action` counts)
- Applications (total `applications` rows)

**LLM usage**
- Total input/output tokens
- **Approximate USD cost** computed from a per-model price table in `lib/dashboard/pricing.ts` — update this when public list prices shift.
- Per-model breakdown table: provider, model, calls, input/output tokens, cost.

**Buttons**
- **Refresh stats** — re-queries the stats endpoint
- **Refresh jobs** — triggers `POST /api/jobs/refresh` (subject to the long-running caveat above)

Tracking begins from the first AI call after you've added the token columns to `ai_outputs` (see the migration above). Historical calls won't have token data.

### "Pool" semantics for rejected jobs

Once you swipe on a job — for any action — it never appears in the swipe queue again. The `jobs` row stays; `swipes` is the "do not show" list (queue filter at `lib/db/queue.ts:23-31`).

**Why soft-removal:** The `(source, source_job_id)` unique constraint means refresh runs upsert in place — a hard-deleted job would be re-fetched, **re-scored (costs AI tokens)**, and re-shown. Soft-removal is also what keeps the dashboard's "skipped" count meaningful.

---

## Architecture

- **Framework:** Next.js 14 App Router, TypeScript, Tailwind
- **DB + storage:** Supabase Postgres + Storage. No RLS (single-user)
- **AI:** Anthropic SDK + OpenAI SDK, with a provider abstraction (`lib/ai/provider.ts`) that does Claude → OpenAI fallback and auto-logs token usage
- **Animation:** `framer-motion` with custom easing curves (Emil Kowalski-style — see `tailwind.config.ts` and `app/globals.css`)
- **Docs out:** `docx` (pure Node) for DOCX, `pdfkit` for PDF — both Vercel-friendly
- **Drag/drop Kanban:** `@dnd-kit`

### File tour

```
app/
  api/                # Next.js route handlers (REST endpoints)
    jobs/refresh/     # POST: pull from all enabled sources, score new jobs
    swipes/           # POST: record swipe; promotes to applications if interested/applied
    dashboard/stats/  # GET: counts + token usage + cost
    resume/           # upload, parse, generate tailored DOCX/PDF
    ...
  swipe/, dashboard/, applications/, resume/, scoring/, import/
  layout.tsx          # Nav + ConfigBanner
  globals.css         # Design tokens (easings, button primitives, card)

components/
  SwipeDeck.tsx       # Centerpiece. Direction-aware exit, velocity dismiss, drag overlays.
  KanbanBoard.tsx     # Application stage board
  ResumeUploader.tsx, GenerateResumeButton.tsx, ResumeVersionRow.tsx
  JobImportForm.tsx, ScoringPanel.tsx, ConfigBanner.tsx

lib/
  ai/
    provider.ts       # aiComplete() — Claude → OpenAI fallback, auto-logs token usage
    claude.ts, openai.ts
    prompts.ts        # SCORE_SYSTEM, TAILOR_SYSTEM, prompt builders
  sources/
    types.ts          # JobSourceAdapter interface
    registry.ts       # name → adapter map + env-based config merging
    {adzuna,greenhouse,lever,ashby,remotive,manual,wtj}.ts
  db/
    queue.ts          # getSwipeQueue() + isLocationEligible() filter
    jobs.ts, swipes.ts, applications.ts, resumes.ts, resume-versions.ts, profile.ts
    types.ts
  scoring/score.ts    # scoreAndPersist(), computeFinalScore(), recalculateAllFinalScores()
  resume/parse.ts     # DOCX/PDF → text
  dashboard/pricing.ts # Per-model USD price table for cost calc
  supabase/server.ts  # supabaseAdmin() — service-role client
  env.ts              # Typed env accessor + configStatus()

supabase/schema.sql   # Tables + seed (sources, default profile, scoring weights)
```

### Adding a new job source

1. Create `lib/sources/<name>.ts` exporting an object that implements `JobSourceAdapter`.
2. Register it in `lib/sources/registry.ts`.
3. Insert a row into `job_sources` (or add to the seed in `supabase/schema.sql`).
4. `POST /api/jobs/refresh` will pick it up automatically.

---

## AI resume tailoring — guardrails

`lib/ai/prompts.ts → TAILOR_SYSTEM` enforces:
- **No invented experience, companies, titles, dates, metrics, tools, or certifications.**
- Only rewrite / reorder / emphasize / rephrase existing content from the master resume.
- Use JD terminology only where it accurately maps to existing experience.

If the model returns plausible-but-fabricated content, edit the master resume to be the source of truth — the tailor step only reshapes what's there.

---

## Operational notes

- **Idempotent refreshes.** Re-running refresh won't duplicate jobs (unique `(source, source_job_id)`), won't re-score already-scored jobs (existence check on `job_scores`), and won't re-show jobs you've swiped on.
- **Telemetry is best-effort.** Token-usage logging swallows errors so a Supabase hiccup never breaks an LLM call.
- **Dashboard cost is approximate.** Prices live in `lib/dashboard/pricing.ts`; update when public list prices change.
- **Location filter is hard-coded.** Edit `lib/db/queue.ts → ELIGIBLE_PATTERNS` to widen or narrow.

---

## Scripts

```bash
npm run dev         # next dev (http://localhost:3000)
npm run build       # next build
npm run start       # next start (after build)
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
```

---

## Future work / known gaps

- **Refresh route reliability** — long Greenhouse pulls exceed the route's `maxDuration`; needs chunking or fire-and-forget.
- **HTML in Greenhouse descriptions** — adapter stores encoded HTML as-is; descriptions show `&lt;h2&gt;…` artifacts. Fix in `lib/sources/greenhouse.ts` with the same `stripHtml()` Remotive uses.
- **Daily cron-based refresh** — currently manual.
- **Duplicate detection** — `jobs.duplicate_group_id` column exists but isn't populated.
- **Design pass on remaining surfaces** — `/swipe` got the heavier visual treatment; `/dashboard`, `/applications`, `/import`, etc. still use the older plain Tailwind look. Same tokens are available; just need application.
- **AI assistant Q&A panel** — placeholder in `ai_outputs` table.
- **Google Docs round-trip editing** — not wired.
