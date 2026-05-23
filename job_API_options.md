  Already wired (per-company public ATS APIs — no key, no scraping)
  - Greenhouse, Lever, Ashby — these cover a huge slice of YC / tech / startup jobs. You feed in company slugs.
  
  Same pattern, worth adding (free, no key):
  - SmartRecruiters — api.smartrecruiters.com/v1/companies/{slug}/postings. Used by Bosch, Ubisoft, Square, lots of
  mid-market.
  - Workable — apply.workable.com/api/v1/widget/accounts/{slug}. Common at startups.
  - Recruitee — {slug}.recruitee.com/api/offers/. EU-heavy.
  - Personio — {slug}.jobs.personio.com/xml. EU-heavy, decent JSON also exposed.
  
  Aggregators (free, no/low key, good quality):
  - Remotive — remotive.com/api/remote-jobs. No key. Manually curated, remote-only, very low scam rate. Strong recommend.
  - Remote OK — remoteok.com/api. No key. Remote tech.
  - Arbeitnow — arbeitnow.com/api/job-board-api. No key. EU + remote.
  - The Muse — themuse.com/api/public/jobs. No key. Broader (marketing, ops, design, eng).
  - Adzuna — already wired; needs free key. 
  - USAJobs — data.usajobs.gov (free key). Only relevant if you'd take federal roles.
  
  Hacker News "Who is Hiring" — monthly thread, queryable via the Algolia HN API (no key). Great for senior IC roles at small
   companies.

  LinkedIn / Indeed / WTJ — the honest answer:
  LinkedIn killed its public Jobs API; Indeed shuttered its publisher program; WTJ's "API" is a sales-gated partner product
  (that's why you couldn't find a key). The only realistic ingestion paths are Apify actors (~$5–20/mo at your volume) — not
  free, but lawful-ish per actor's ToS handling. Not recommended as a foundation.

  My pick to add next, in priority order:
  1. Remotive (instant value, no setup)
  2. SmartRecruiters + Workable (per-company, same shape as your existing 3)
  3. The Muse (broadens beyond tech)
  4. HN "Who is Hiring" via Algolia (uniquely good signal for small co's)