-- AI Hub — activity_log schema
-- Run this once in the Supabase Dashboard: Project > SQL Editor > New query.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).

create extension if not exists "pgcrypto";

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('AI', 'Agents', 'Bots', 'VPN', 'Friends', 'System')),
  title text not null,
  subtitle text,
  badge text not null default 'Info' check (badge in ('Success', 'Info', 'Error')),
  created_at timestamptz not null default now()
);

-- Safe to re-run against a table created before 'Bots' existed as a
-- category — the Bot BPJS screen writes this. 'Friends' is kept in the
-- allowed list even though the Friend System itself was removed, purely so
-- old rows already written with that category don't fail validation.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'activity_log_category_check'
  ) then
    alter table public.activity_log drop constraint activity_log_category_check;
  end if;
  alter table public.activity_log
    add constraint activity_log_category_check
    check (category in ('AI', 'Agents', 'Bots', 'VPN', 'Friends', 'System'));
end $$;

create index if not exists activity_log_user_created_idx
  on public.activity_log (user_id, created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists "Users can view own activity" on public.activity_log;
create policy "Users can view own activity"
  on public.activity_log for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own activity" on public.activity_log;
create policy "Users can insert own activity"
  on public.activity_log for insert
  with check (auth.uid() = user_id);

-- No update/delete policy: logs are append-only from the client on purpose.

-- Enable realtime updates for the Activity Log screen's live stream.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_log'
  ) then
    alter publication supabase_realtime add table public.activity_log;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles — directory of display names + role (perawat/dokter/general).
-- The Friend System (friendships table + its UI) was removed: Bot BPJS now
-- targets a doctor by typed name/instansi per session instead of a
-- pre-approved account relationship — see bpjs_sessions below. `role` is
-- kept only so a signed-in user can label themself for their own records.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'general' check (role in ('general', 'perawat', 'dokter')),
  bio text,
  created_at timestamptz not null default now()
);

-- Safe to re-run against a profiles table created before role/bio existed.
alter table public.profiles add column if not exists role text not null default 'general';
alter table public.profiles add column if not exists bio text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('general', 'perawat', 'dokter'));
  end if;
end $$;

create index if not exists profiles_display_name_idx
  on public.profiles (lower(display_name));

alter table public.profiles enable row level security;

drop policy if exists "Anyone signed in can read profiles" on public.profiles;
create policy "Anyone signed in can read profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users can upsert their own profile" on public.profiles;
create policy "Users can upsert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Removed tables from the old Friend System — drop them if an earlier
-- schema.sql run already created them. Both `messages` (1:1 chat between
-- friends) and `friendships` existed only to support each other and were
-- never load-bearing for any other feature once Bot BPJS switched to a
-- typed doctor name instead of an accepted-friend account relationship.
-- CASCADE is safe here: the only dependents are the old bpjs_sessions
-- policies that referenced friendships in their USING clause — those get
-- replaced with friendship-free versions further down in this file anyway.
drop table if exists public.messages cascade;
drop table if exists public.friendships cascade;

-- ---------------------------------------------------------------------------
-- Bot BPJS / Jarvis — voice-documented nurse-patient sessions.
-- See PRD-AI-Hub-Jarvis-BPJS.md §7.3. Every table here holds sensitive
-- health data (NFR-10): RLS restricts every row to just the signed-in nurse
-- who recorded it (perawat_id) — nobody else can read or write these rows.
--
-- There is deliberately no doctor *account* relationship here anymore (the
-- Friend System this used to depend on was removed) — the target doctor is
-- just a typed name + instansi per session, same as writing it by hand on
-- a referral form. The finished documentation is handed to that doctor
-- directly by the nurse (copy/paste, PDF, or DOCX — see §8 "Alur Export"),
-- not through an in-app review screen on the doctor's own account.
-- ---------------------------------------------------------------------------

create table if not exists public.bpjs_sessions (
  id uuid primary key default gen_random_uuid(),
  perawat_id uuid not null references auth.users (id) on delete cascade,
  dokter_nama text not null,
  dokter_instansi text,
  pasien_nama text not null,
  status text not null default 'recording'
    check (status in ('recording', 'processing', 'siap_dikirim', 'terkirim')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- bpjs_reviews (doctor-account review verdicts) referenced dokter_id, and
-- was removed along with the Friend System's doctor accounts — drop it
-- *before* the migration below, so its policies don't block dropping that
-- column from bpjs_sessions.
drop table if exists public.bpjs_reviews cascade;

-- Migration for a database that already ran the old (friendship-based)
-- version of this table: drop the doctor-account column/constraints it
-- had, and backfill the new typed-name column from whatever profile name
-- was linked, so existing rows keep a usable value instead of erroring.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bpjs_sessions' and column_name = 'dokter_id'
  ) then
    alter table public.bpjs_sessions add column if not exists dokter_nama text;
    alter table public.bpjs_sessions add column if not exists dokter_instansi text;
    update public.bpjs_sessions s
      set dokter_nama = coalesce(p.display_name, 'Dokter')
      from public.profiles p
      where p.id = s.dokter_id and s.dokter_nama is null;
    update public.bpjs_sessions set dokter_nama = 'Dokter' where dokter_nama is null;
    alter table public.bpjs_sessions alter column dokter_nama set not null;
    alter table public.bpjs_sessions drop constraint if exists bpjs_sessions_no_self;
    -- Every old policy anywhere that reads bpjs_sessions.dokter_id (on this
    -- table and its children) has to go before the column itself can drop —
    -- Postgres won't let a column disappear while a policy still names it.
    -- All of these get recreated below in their friendship-free form.
    drop policy if exists "Nurse and target doctor can view a session" on public.bpjs_sessions;
    drop policy if exists "Nurse can start a session with an accepted friend" on public.bpjs_sessions;
    drop policy if exists "Nurse or target doctor can update a session" on public.bpjs_sessions;
    drop policy if exists "Nurse and target doctor can view transcripts" on public.bpjs_transcripts;
    drop policy if exists "Nurse and target doctor can view documentation" on public.bpjs_documents;
    alter table public.bpjs_sessions drop column dokter_id;
  end if;
  if exists (
    select 1 from pg_constraint where conname = 'bpjs_sessions_status_check'
  ) then
    alter table public.bpjs_sessions drop constraint bpjs_sessions_status_check;
    -- Old status values ('sent', 'pending_review', 'needs_revision',
    -- 'matches_bpjs_form') came from the doctor-review flow that no longer
    -- exists — map them onto the closest new status so existing rows don't
    -- just become invalid data once the stricter check is added back.
    update public.bpjs_sessions
      set status = case
        when status in ('sent', 'pending_review') then 'siap_dikirim'
        when status in ('matches_bpjs_form', 'needs_revision') then 'terkirim'
        else status
      end
      where status not in ('recording', 'processing', 'siap_dikirim', 'terkirim');
    alter table public.bpjs_sessions
      add constraint bpjs_sessions_status_check
      check (status in ('recording', 'processing', 'siap_dikirim', 'terkirim'));
  end if;
end $$;

create index if not exists bpjs_sessions_perawat_idx on public.bpjs_sessions (perawat_id, created_at desc);

alter table public.bpjs_sessions enable row level security;

drop policy if exists "Nurse can view their own sessions" on public.bpjs_sessions;
create policy "Nurse can view their own sessions"
  on public.bpjs_sessions for select
  using (auth.uid() = perawat_id);

drop policy if exists "Nurse can create their own sessions" on public.bpjs_sessions;
create policy "Nurse can create their own sessions"
  on public.bpjs_sessions for insert
  with check (auth.uid() = perawat_id);

drop policy if exists "Nurse can update their own sessions" on public.bpjs_sessions;
create policy "Nurse can update their own sessions"
  on public.bpjs_sessions for update
  using (auth.uid() = perawat_id);

drop policy if exists "Nurse can delete their own sessions" on public.bpjs_sessions;
create policy "Nurse can delete their own sessions"
  on public.bpjs_sessions for delete
  using (auth.uid() = perawat_id);

create table if not exists public.bpjs_transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bpjs_sessions (id) on delete cascade,
  speaker text not null check (speaker in ('perawat', 'pasien')),
  text_segment text not null,
  timestamp_offset_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bpjs_transcripts_session_idx
  on public.bpjs_transcripts (session_id, timestamp_offset_ms);

alter table public.bpjs_transcripts enable row level security;

drop policy if exists "Nurse and target doctor can view transcripts" on public.bpjs_transcripts;
drop policy if exists "Nurse can view transcripts for their own session" on public.bpjs_transcripts;
create policy "Nurse can view transcripts for their own session"
  on public.bpjs_transcripts for select
  using (
    exists (
      select 1 from public.bpjs_sessions s
      where s.id = session_id and auth.uid() = s.perawat_id
    )
  );

drop policy if exists "Nurse can add transcript segments to their session" on public.bpjs_transcripts;
create policy "Nurse can add transcript segments to their session"
  on public.bpjs_transcripts for insert
  with check (
    exists (
      select 1 from public.bpjs_sessions s
      where s.id = session_id and auth.uid() = s.perawat_id
    )
  );

create table if not exists public.bpjs_documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bpjs_sessions (id) on delete cascade,
  ringkasan text,
  dokumentasi_terstruktur jsonb not null default '{}'::jsonb,
  alur_percakapan jsonb not null default '[]'::jsonb,
  generated_by_llm_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bpjs_documents_session_idx on public.bpjs_documents (session_id);

alter table public.bpjs_documents enable row level security;

drop policy if exists "Nurse and target doctor can view documentation" on public.bpjs_documents;
drop policy if exists "Nurse can view documentation for their own session" on public.bpjs_documents;
create policy "Nurse can view documentation for their own session"
  on public.bpjs_documents for select
  using (
    exists (
      select 1 from public.bpjs_sessions s
      where s.id = session_id and auth.uid() = s.perawat_id
    )
  );

drop policy if exists "Nurse can generate documentation for their session" on public.bpjs_documents;
create policy "Nurse can generate documentation for their session"
  on public.bpjs_documents for insert
  with check (
    exists (
      select 1 from public.bpjs_sessions s
      where s.id = session_id and auth.uid() = s.perawat_id
    )
  );

drop policy if exists "Nurse can update documentation for their session" on public.bpjs_documents;
create policy "Nurse can update documentation for their session"
  on public.bpjs_documents for update
  using (
    exists (
      select 1 from public.bpjs_sessions s
      where s.id = session_id and auth.uid() = s.perawat_id
    )
  );

-- (bpjs_reviews already dropped earlier in this file, before the
-- bpjs_sessions.dokter_id migration that needed it gone first.)

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bpjs_sessions'
  ) then
    alter publication supabase_realtime add table public.bpjs_sessions;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AI provider/agent credentials — synced via the user's account instead of
-- only living in one device's local storage, so a key added on one browser/
-- device is still there after a reinstall or on another device.
--
-- `encrypted_key`/`iv` hold an AES-GCM ciphertext, not the raw key — see
-- web/public/credentials.js for the encryption. RLS is still the real
-- access control (nobody but the owning user can even read a row); the
-- client-side encryption is defense-in-depth on top of that, in case this
-- table is ever exposed some other way (e.g. an accidental dashboard
-- screen-share, CSV export, or a misconfigured read-only replica).
-- ---------------------------------------------------------------------------

-- One `provider_id` can now have more than one row ("slot") — e.g. two
-- Gemini API keys saved as labels "Gemini" and "Gemini 2". The Chat picker
-- still only shows one entry per provider_id (credentials.js groups them);
-- ai.js rotates to the next slot automatically when one hits a rate
-- limit/quota error, instead of the user juggling several "Gemini" chips.
create table if not exists public.api_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null,
  label text not null,
  type text not null default 'chat' check (type in ('chat', 'agent')),
  format text not null default 'openai',
  endpoint text,
  model text,
  encrypted_key text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_credentials_unique_slot unique (user_id, provider_id, label)
);

-- Migration for an existing table created before slots existed (safe to
-- re-run: both steps are no-ops once already applied).
alter table public.api_credentials drop constraint if exists api_credentials_unique_provider;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'api_credentials_unique_slot'
  ) then
    alter table public.api_credentials
      add constraint api_credentials_unique_slot unique (user_id, provider_id, label);
  end if;
end $$;

create index if not exists api_credentials_user_idx on public.api_credentials (user_id);

alter table public.api_credentials enable row level security;

drop policy if exists "Users can view own api credentials" on public.api_credentials;
create policy "Users can view own api credentials"
  on public.api_credentials for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own api credentials" on public.api_credentials;
create policy "Users can insert own api credentials"
  on public.api_credentials for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own api credentials" on public.api_credentials;
create policy "Users can update own api credentials"
  on public.api_credentials for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own api credentials" on public.api_credentials;
create policy "Users can delete own api credentials"
  on public.api_credentials for delete
  using (auth.uid() = user_id);
