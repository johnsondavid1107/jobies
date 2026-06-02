# Tailor-Resume TODO

## Next up (queue/swipe UX + scoring gate — see docs/handoff.md for full context)
- **(DONE 2026-06-02) Scoring gate — score only location-eligible jobs.** Stage 4 of `/api/jobs/refresh` now filters `upserted` through `isLocationEligible(remote_type, location, description)` before computing `toScore`; the upsert (store-everything) is unchanged, and ineligible postings stay unscored until the filter loosens. Verify in a refresh run: `scored` < `added` when non-US/non-remote postings arrive. Original rationale: tokens were being spent scoring jobs that `getSwipeQueue` later hides. **Principle: STORE everything, SCORE only eligible, FILTER at read.**
- **"Show me more from what I already have" button at end of swipe deck.** Empty-state today only has "Refresh jobs now" (hits external sources + `router.refresh()`). Add a distinct button that pulls the NEXT batch from the EXISTING pool (next unswiped-by-recency) WITHOUT calling `/api/jobs/refresh`. Needs `getSwipeQueue` to accept an offset/cursor (swiped jobs are already excluded). Pairs with Decision A (score-ordering + real pagination).
- **Hard-remove rejected jobs from the pool.** Today `rejected` is only recorded in `swipes` (soft-excluded via a join); the `jobs` row lingers. User wants "not interested → remove from table." ⚠️ CAUTION: a naive DELETE from `jobs` breaks dedup — the same posting re-appears AND gets re-scored on the next refresh, because the `swipes` row is the only memory of it. Use a tombstone (keep the `swipes` row, or add a `rejected` flag on `jobs`) instead of losing dedup memory. NOTE: interested/save/already_applied ALREADY auto-create an `applications` row (`recordSwipe`) — "interested → Applications" is done.
- **(DONE 2026-06-02) Render dates on the swipe card.** `SwipeCard` now shows "Posted {Mon D} · Stored N days ago" under the location line (`fmtPosted`/`fmtStored` in `components/SwipeDeck.tsx`), from `date_posted`/`discovered_at` on `QueueJob`. Makes the limit-by-recency behavior visible.
- **(DONE 2026-06-02) Delete (×) on Kanban cards.** Hover-revealed × on each `components/KanbanBoard.tsx` card → inline "Remove this card?" confirm → optimistic remove + `DELETE /api/applications/[id]` (`deleteApplication`). Use case: showed Interested but never applied. `resume_versions.application_id` is ON DELETE SET NULL (tailored résumé survives); the job's `swipes` row is left intact so the posting stays out of the deck and isn't re-fetched. NOTE: this is a softer sibling of pipeline item #3 (hard-remove rejected jobs) — that one is about `rejected`/Skip in the deck, still open.
- **(Decision A) Raise/refactor the swipe-queue limit (currently 50).** Push score-ordering + a location pre-filter into the DB query so the limit means "best N" not "most-recent N"; raise N≈150; add an offset for the "show me more" button. Needs an index on `final_score`. Implications: deck stops being recency-biased (older high-score jobs surface), bounded per-load cost on the ~3k pool.

## Bugs
- (fix landed, verify) Empty tailored resume — prompt now requires all entries + backfill safety net
- (fix landed, verify) Tailored resume too short — prompt now targets ~1 page / 450–550 words

## Features
- (fixed, verify) Surface tailored resumes in the Versions tab — was Next.js fetch-cache serving stale empty results; admin client now uses no-store
- (landed, verify in UI) Dashboard search controls — Adzuna queries + boards pool with validate-on-add; Refresh removed from swipe header
- Keep progress toast visible across tab switches until user closes it or clicks a link
- (landed) Refresh-jobs progress UI — `/api/jobs/refresh` now streams NDJSON RefreshEvents; dashboard shows a focused modal with per-source stages (fetch → dedup → score) + live counts, click-out → fixed progress toast (work continues), green completion toast with new/eligible counts + "Go to swipe deck" link. Route refactored to batch dedup/score-existence queries (full run ~85s vs prior timeout). See `components/JobRefresh.tsx`, `lib/jobs/refresh-events.ts`.

## Location filter rework (landed, verify in UI)
- `lib/db/queue.ts` — `isLocationEligible` rewritten: country-level US + remote-in-description eligible; non-US denylist drops only clear non-US locales; ambiguous → show
- Verify: previously-dropped jobs (US-NY abbrev, "United States" + fully-remote body, country-level US) now appear in the swipe queue
- Nice-to-have follow-up (different session): trim `NON_US_TOKENS` to countries + region tags only — see handoff

## Investigate
- Review dashboard analytics for accuracy

## Tooling notes
- Look up how to enable SendMessage (resume sub-agents) for future Claude sessions
