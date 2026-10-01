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

-- Safe to re-run against a table created before 'Bots'/'Friends' existed as
-- categories — both the Bot BPJS screen and the Friends views write these.
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
-- Friend System — profiles (searchable) + friendships (requests/accepted)
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

-- Any signed-in user (including anonymous) can search the directory by name.
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

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

drop policy if exists "Users can view their own friendships" on public.friendships;
create policy "Users can view their own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

drop policy if exists "Users can respond to their friendships" on public.friendships;
create policy "Users can respond to their friendships"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Direct messages — one-to-one chat between friends, used by the unified
-- Chat screen (AI Assistant conversation OR a friend conversation).
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_no_self check (sender_id <> receiver_id)
);

create index if not exists messages_conversation_idx
  on public.messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at);

alter table public.messages enable row level security;

drop policy if exists "Users can view their own conversations" on public.messages;
create policy "Users can view their own conversations"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Bot BPJS / Jarvis — voice-documented nurse-patient sessions.
-- See PRD-AI-Hub-Jarvis-BPJS.md §7.3. Every table here holds sensitive
-- health data (NFR-10): RLS restricts every row to just the sending nurse
-- (perawat_id) and the target doctor (dokter_id) — nobody else, including
-- other authenticated users, can read or write these rows.
-- ---------------------------------------------------------------------------

create table if not exists public.bpjs_sessions (
  id uuid primary key default gen_random_uuid(),
  perawat_id uuid not null references auth.users (id) on delete cascade,
  dokter_id uuid not null references auth.users (id) on delete cascade,
  pasien_nama text not null,
  status text not null default 'recording'
    check (status in ('recording', 'processing', 'sent', 'pending_review', 'needs_revision', 'matches_bpjs_form')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bpjs_sessions_no_self check (perawat_id <> dokter_id)
);

create index if not exists bpjs_sessions_perawat_idx on public.bpjs_sessions (perawat_id, created_at desc);
create index if not exists bpjs_sessions_dokter_idx on public.bpjs_sessions (dokter_id, created_at desc);

alter table public.bpjs_sessions enable row level security;

drop policy if exists "Nurse and target doctor can view a session" on public.bpjs_sessions;
create policy "Nurse and target doctor can view a session"
  on public.bpjs_sessions for select
  using (auth.uid() = perawat_id or auth.uid() = dokter_id);

-- NFR-14: a session can only be opened by the nurse, and only ever targets a
-- doctor who has *already accepted* a friend request with that nurse —
-- prevents sending patient documentation to an unrelated/unknown account.
drop policy if exists "Nurse can start a session with an accepted friend" on public.bpjs_sessions;
create policy "Nurse can start a session with an accepted friend"
  on public.bpjs_sessions for insert
  with check (
    auth.uid() = perawat_id
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = perawat_id and f.addressee_id = dokter_id)
          or (f.requester_id = dokter_id and f.addressee_id = perawat_id)
        )
    )
  );

drop policy if exists "Nurse or target doctor can update a session" on public.bpjs_sessions;
create policy "Nurse or target doctor can update a session"
  on public.bpjs_sessions for update
  using (auth.uid() = perawat_id or auth.uid() = dokter_id);

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
create policy "Nurse and target doctor can view transcripts"
  on public.bpjs_transcripts for select
  using (
    exists (
      select 1 from public.bpjs_sessions s
      where s.id = session_id and (auth.uid() = s.perawat_id or auth.uid() = s.dokter_id)
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
create policy "Nurse and target doctor can view documentation"
  on public.bpjs_documents for select
  using (
    exists (
      select 1 from public.bpjs_sessions s
      where s.id = session_id and (auth.uid() = s.perawat_id or auth.uid() = s.dokter_id)
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

create table if not exists public.bpjs_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bpjs_sessions (id) on delete cascade,
  dokter_id uuid not null references auth.users (id) on delete cascade,
  verdict text not null check (verdict in ('matches_bpjs_form', 'needs_revision')),
  catatan text,
  reviewed_at timestamptz not null default now()
);

create index if not exists bpjs_reviews_session_idx on public.bpjs_reviews (session_id, reviewed_at desc);

alter table public.bpjs_reviews enable row level security;

drop policy if exists "Nurse and target doctor can view reviews" on public.bpjs_reviews;
create policy "Nurse and target doctor can view reviews"
  on public.bpjs_reviews for select
  using (
    exists (
      select 1 from public.bpjs_sessions s
      where s.id = session_id and (auth.uid() = s.perawat_id or auth.uid() = s.dokter_id)
    )
  );

-- Only the *target* doctor of the session may review it (§4.7 step 8) — not
-- just any doctor the nurse happens to be friends with.
drop policy if exists "Target doctor can review their assigned session" on public.bpjs_reviews;
create policy "Target doctor can review their assigned session"
  on public.bpjs_reviews for insert
  with check (
    auth.uid() = dokter_id
    and exists (
      select 1 from public.bpjs_sessions s
      where s.id = session_id and s.dokter_id = auth.uid()
    )
  );

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
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bpjs_reviews'
  ) then
    alter publication supabase_realtime add table public.bpjs_reviews;
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
  constraint api_credentials_unique_provider unique (user_id, provider_id)
);

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
