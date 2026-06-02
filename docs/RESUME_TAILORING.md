# Résumé Tailoring & Editing

How a job-specific résumé is produced, stored, edited, and re-scored. There are **two
distinct phases**. Google Drive is involved **only in Phase 2**.

---

## Phase 1 — AI tailoring (on `/swipe`, no Google)

```
 ┌─────────────┐   confirm    ┌──────────────────────────┐
 │ "Tailor     │  modal       │ POST /api/resume/generate │
 │  résumé" ───┼────────────► │  (server, runtime=nodejs) │
 │  top card   │  "Yes"       └────────────┬─────────────┘
 └─────────────┘                           │
                                           ▼
   1. getJob(job_id)            load the job
   2. getMasterResume()         your standard résumé content (parsed JSON) — LLM input
   3. aiComplete(TAILOR_SYSTEM) LLM rewrites → ResumeSections JSON (content only)
   4. getTemplateResume()       your tagged .docx design (required — else 400)
      renderResumeFromTemplate  content → .docx in YOUR design  (docxtemplater)
      docxToPdf() via Drive     .docx → matching .pdf; keeps the Google Doc id
   5. Supabase Storage upload   bucket `resumes`, generated/<co>-<role>-<ts>.{docx,pdf}
   6. scoreWithResume()         honest before/after (does NOT touch job_scores)
   7. INSERT resume_versions    metadata + storage paths + scores + google_drive_file_id
   8. applications.resume_version_id → new row (if an application exists)
                                           │
                                           ▼
                        card shows updated score ring + "78% → 91%" pill
```

**The confirm modal is the spend guard** — no AI tokens are used until you click "Yes".

**After Phase 1 the tailored résumé lives in two places, both inside this app's stack:**

| What | Where |
|------|-------|
| Rendered DOCX + PDF | Supabase Storage, `resumes` bucket, `generated/…` |
| Metadata (company, role, scores, keywords, file paths) | `resume_versions` table |

The LLM only ever emits **content** (`ResumeSections` JSON). It never produces or reads a
file, and it never touches Google.

---

## Phase 2 — Editing via Google Docs (on `/resume-versions`, manual)

A separate, optional step you trigger later from the versions table.

```
 ┌──────────────┐                 ┌──────────────────────────────────┐
 │ "Edit in     │ POST            │ /api/resume-versions/[id]/open-in-docs │
 │  Docs"  ─────┼───────────────► │  • download DOCX from Supabase     │
 └──────────────┘                 │  • upload to Drive → Google Doc    │
                                   │  • store google_drive_file_id      │
                                   │  • return docs.google.com/…/edit   │
                                   └────────────────┬───────────────────┘
                                                    ▼
                              opens in a new tab → you edit freely in Docs
                                                    │
 ┌──────────────┐                 ┌─────────────────▼──────────────────┐
 │ "Sync"  ─────┼───────────────► │ /api/resume-versions/[id]/sync     │
 └──────────────┘                 │  • export Doc → fresh DOCX + PDF   │
                                   │  • save to Supabase (new timestamp)│
                                   │  • re-score edited text            │
                                   │  • INSERT new resume_versions row, │
                                   │    parent_version_id = source      │
                                   │  • repoint application to latest   │
                                   └────────────────────────────────────┘
```

- **The Google Doc is canonical once you start editing.** Sync exports DOCX **and** PDF
  straight from Drive, so they carry your Docs formatting (and therefore look different
  from a freshly tailored Phase-1 PDF — see Formatting below).
- **Re-clicking "Edit in Docs"** reopens the same Doc (the stored `google_drive_file_id`),
  it does not create a duplicate.
- **Each Sync = a new version row**, chained via `parent_version_id` (shown as the
  `↳ edit` chip + "edited · 5m ago" marker). The same live Doc backs the whole chain.

---

## Setup (one-time)

1. **Google Cloud Console:** enable the Drive API; OAuth consent screen → External,
   add yourself as a **test user**; create an OAuth **Desktop app** client. Scope:
   `https://www.googleapis.com/auth/drive.file` (least privilege — only files the app
   creates).
2. **Mint a refresh token:**
   `GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… node scripts/google-auth.mjs`
3. **`.env.local`:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.
4. **Schema** (already applied): `resume_versions.google_drive_file_id`,
   `parent_version_id`, `last_synced_at`.

> ⚠️ **7-day token expiry.** While the OAuth app is in **Testing** mode, refresh tokens
> expire after 7 days — Sync/Edit-in-Docs will then return auth errors. Re-run
> `scripts/google-auth.mjs` to mint a fresh token, **or** click **Publish app** on the
> consent screen (safe: `drive.file` is non-sensitive and does not trigger Google
> verification) to stop the expiry.

---

## Formatting — your design is the source of truth

Tailored output is rendered into **your own `.docx` template**, so it matches your design
exactly, automatically, with no per-résumé reformatting. The LLM only supplies content; the
template owns all formatting.

```
your master.docx (tagged with {placeholders})  ── uploaded once on /resume ──► stored as type='template'
tailored ResumeSections (LLM content) ──docxtemplater──► DOCX in your design
                                       ──Drive convert──► PDF matching the DOCX
```

**Rules (the template is canonical):**

- **No template uploaded → tailoring is blocked** with a clear message. We never silently
  emit a generic résumé.
- **PDF is derived from the template DOCX via Google Drive**, so it matches. If Drive is
  unconfigured or the token expired, the (correct) DOCX is still produced and the PDF is
  skipped with a non-fatal warning — we never substitute a mismatched generic PDF.
- `lib/resume/generate-docx.ts` and `generate-pdf.ts` (pdfkit) are **no longer used by the
  tailor flow**. (The `serverComponentsExternalPackages: ['pdfkit']` config stays as hygiene.)

### How to author your template

Upload a `.docx` on the **Resume page** (template slot). Put your real design in it and drop
in these tags where content should go (bullets/loops can use Word's native list styling on
the looped paragraph instead of a literal marker):

```
{name}
{contact}
{#summary}{summary}{/summary}
{#experience}
{title} — {company}{#location}, {location}{/location}
{dates}
{#bullets}{.}{/bullets}
{/experience}
{#education}{school}{#degree} — {degree}{/degree} / {dates} / {notes}{/education}
{skillsLine}
{#projects}{name} / {description} / {#bullets}{.}{/bullets}{/projects}
{#certifications}{.}{/certifications}
{#other}{heading} / {#items}{.}{/items}{/other}
```

Available tags (all optional; pre-computed for you in `lib/resume/render-from-template.ts`):

| Tag | Meaning |
|-----|---------|
| `{name}` `{email}` `{phone}` `{location}` | header fields |
| `{contact}` | header fields joined with ` · ` |
| `{#links}{.}{/links}` | header links (loop) |
| `{summary}` | summary paragraph |
| `{#experience}…{/experience}` | per-role loop: `{title}` `{company}` `{location}` `{start}` `{end}` `{dates}`, `{#bullets}{.}{/bullets}` |
| `{#education}…{/education}` | `{school}` `{degree}` `{start}` `{end}` `{dates}` `{notes}` |
| `{skillsLine}` or `{#skills}{.}{/skills}` | skills joined, or as a loop |
| `{#projects}…{/projects}` | `{name}` `{description}`, `{#bullets}{.}{/bullets}` |
| `{#certifications}{.}{/certifications}` | certifications (loop) |
| `{#other}…{/other}` | `{heading}`, `{#items}{.}{/items}` |

Templates are **validated at upload** (`lintTemplate`): a misspelled tag, an unclosed loop,
or a non-`.docx` file is rejected immediately with a message naming the exact offending
tag(s) — so problems surface when you upload, not at your first tailor.

---

## Key files

- `app/api/resume/generate/route.ts` — Phase 1 orchestration
- `lib/ai/prompts.ts` — `TAILOR_SYSTEM` + `buildTailorPrompt()` (the rewrite instructions)
- `lib/resume/render-from-template.ts` — docxtemplater render + `toTemplateData` (the design path)
- `lib/resume/generate-docx.ts`, `generate-pdf.ts` — legacy house-style renderers (no longer used by tailoring)
- `lib/resume/parse.ts` — master ingestion (text extraction for LLM matching)
- `lib/google/drive.ts` — `uploadDocxAsGoogleDoc`, `exportDoc`, `docUrl`
- `app/api/resume-versions/[id]/open-in-docs/route.ts`, `…/sync/route.ts` — Phase 2
- `components/SwipeDeck.tsx` — Tailor button + confirm modal
- `components/ResumeVersionRow.tsx` — Edit-in-Docs / Sync buttons
- `scripts/google-auth.mjs` — refresh-token minter
