-- AI Hub — activity_log schema
-- Run this once in the Supabase Dashboard: Project > SQL Editor > New query.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).

create extension if not exists "pgcrypto";

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('AI', 'Agents', 'VPN', 'System')),
  title text not null,
  subtitle text,
  badge text not null default 'Info' check (badge in ('Success', 'Info', 'Error')),
  created_at timestamptz not null default now()
);

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
