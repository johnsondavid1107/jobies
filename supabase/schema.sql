-- Job Applicant Assistant schema. Single-user MVP, no RLS.
create extension if not exists "pgcrypto";

create table if not exists profiles (
  id text primary key default 'default',
  created_at timestamptz not null default now(),
  resume_text text,
  preferences_json jsonb not null default '{}'::jsonb,
  scoring_weights_json jsonb not null default '{}'::jsonb
);

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('master','generated','template')),
  filename text not null,
  storage_path text not null,
  parsed_text text,
  parsed_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_job_id text,
  title text not null,
  company text,
  description text,
  url text,
  location text,
  remote_type text,
  salary_min numeric,
  salary_max numeric,
  date_posted timestamptz,
  discovered_at timestamptz not null default now(),
  raw_data_json jsonb,
  duplicate_group_id uuid,
  unique (source, source_job_id)
);
create index if not exists jobs_discovered_idx on jobs (discovered_at desc);

create table if not exists job_scores (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  resume_match_score numeric,
  title_match_score numeric,
  industry_match_score numeric,
  seniority_match_score numeric,
  salary_match_score numeric,
  location_match_score numeric,
  swipe_learning_score numeric,
  quality_score numeric,
  final_score numeric,
  ai_explanation text,
  focus_suggestions jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists job_scores_job_unique on job_scores (job_id);

create table if not exists swipes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  action text not null check (action in ('interested','rejected','save_for_later','already_applied')),
  created_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete set null,
  company text,
  title text,
  url text,
  salary_range text,
  location text,
  remote_type text,
  source text,
  stage text not null default 'interested',
  date_discovered timestamptz default now(),
  date_applied timestamptz,
  notes text,
  match_score numeric,
  resume_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resume_versions (
  id uuid primary key default gen_random_uuid(),
  base_resume_id uuid references resumes(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  application_id uuid references applications(id) on delete set null,
  company text,
  role text,
  docx_storage_path text,
  pdf_storage_path text,
  match_score_before numeric,
  match_score_after numeric,
  keywords_emphasized_json jsonb,
  used_to_apply boolean not null default false,
  notes text,
  google_drive_file_id text,
  parent_version_id uuid references resume_versions(id) on delete set null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table applications
  drop constraint if exists applications_resume_version_fk,
  add constraint applications_resume_version_fk
    foreign key (resume_version_id) references resume_versions(id) on delete set null;

create table if not exists ai_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete set null,
  prompt text,
  response text,
  type text,
  created_at timestamptz not null default now()
);

-- App-level key/value settings. Holds the Google OAuth refresh token, so RLS is
-- ON with NO policies: only the service-role key (the server) can read/write it;
-- the public anon key is blocked from ever reading the token.
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

create table if not exists job_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  enabled boolean not null default true,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Default profile + scoring weights
insert into profiles (id, scoring_weights_json, preferences_json)
values (
  'default',
  '{
     "resume": 30, "title": 15, "industry": 10, "seniority": 10,
     "salary": 10, "location": 10, "swipe": 10, "quality": 5
   }'::jsonb,
  '{
     "allow_senior_titles": true,
     "allow_stretch_roles": true,
     "broaden_industries": true,
     "strict_salary_floor": false,
     "salary_floor": 0,
     "remote_only": false,
     "exploration_mode": false,
     "exclude_scams": true,
     "preferred_titles": [],
     "preferred_industries": [],
     "preferred_locations": []
   }'::jsonb
) on conflict (id) do nothing;

insert into job_sources (name, enabled, config_json) values
  ('manual', true, '{}'::jsonb),
  ('adzuna', false, '{"country":"us","queries":[{"what":"software engineer","where":"remote"}]}'::jsonb),
  ('greenhouse', false, '{"boards":[]}'::jsonb),
  ('lever', false, '{"boards":[]}'::jsonb),
  ('ashby', false, '{"boards":[]}'::jsonb),
  ('wtj', false, '{"note":"stub"}'::jsonb),
  ('remotive', true, '{"limit":50}'::jsonb)
on conflict (name) do nothing;
