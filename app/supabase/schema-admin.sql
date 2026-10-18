-- AI Hub — tabel untuk Panel Admin (admin/). Jalankan SEKALI di Supabase ->
-- SQL Editor (aman dijalankan berulang), sesudah schema.sql. Setelah itu semua
-- pengelolaan (bot, provider, pengumuman, maintenance, pengguna) dilakukan dari
-- panel admin; tidak perlu membuka dashboard Supabase lagi.
--
-- Prinsip akses (pagar akademik §2 butir 5): aplikasi/pengguna hanya BACA
-- konfigurasi di bawah. Tidak ada policy insert/update/delete, jadi hanya
-- service_role (dipegang server panel admin, tidak pernah ke browser) yang bisa
-- menulis. Tidak ada tabel data pasien yang dilonggarkan RLS-nya.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- app_settings — pengaturan global key/value (mis. 'maintenance').
-- is_public = true -> boleh dibaca tanpa login (layar login perlu tahu
-- sedang maintenance). Jangan taruh rahasia di sini.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
drop policy if exists "Read public settings" on public.app_settings;
create policy "Read public settings"
  on public.app_settings for select
  using (is_public or auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- announcements — pemberitahuan ke pengguna (info, peringatan, jadwal
-- maintenance). Tampil di aplikasi selama active dan berada dalam jendela
-- starts_at..ends_at (ends_at kosong = tanpa batas).
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  kind text not null default 'info' check (kind in ('info', 'success', 'warning', 'maintenance')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists announcements_window_idx on public.announcements (active, starts_at desc);

alter table public.announcements enable row level security;
drop policy if exists "Read active announcements" on public.announcements;
create policy "Read active announcements"
  on public.announcements for select
  using (active and auth.role() in ('authenticated', 'anon'));

-- ---------------------------------------------------------------------------
-- remote_bots — kartu di Bot Hub yang ditambahkan admin tanpa rilis ulang.
-- kind 'route' = membuka halaman dalam aplikasi (mis. /vpn, /papan-komunikasi);
-- kind 'link'  = membuka URL luar. Bot bawaan (BPJS, Papan, Anamnesis) tetap
-- ada di kode karena butuh jembatan native.
-- ---------------------------------------------------------------------------
create table if not exists public.remote_bots (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  title text not null check (char_length(title) between 1 and 60),
  subtitle text not null default '' check (char_length(subtitle) <= 140),
  icon text not null default 'bot',
  kind text not null default 'link' check (kind in ('route', 'link')),
  target text not null check (char_length(target) between 1 and 500),
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.remote_bots enable row level security;
drop policy if exists "Read active bots" on public.remote_bots;
create policy "Read active bots"
  on public.remote_bots for select
  using (active and auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- remote_providers — katalog provider AI tambahan (format openai-compatible,
-- anthropic, gemini). Kunci API tetap milik pengguna (BYOK); tabel ini hanya
-- menyimpan endpoint/model bawaan dan pola bentuk kunci untuk deteksi otomatis.
-- ---------------------------------------------------------------------------
create table if not exists public.remote_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  label text not null check (char_length(label) between 1 and 60),
  vendor text not null default '',
  type text not null default 'chat' check (type in ('chat', 'agent')),
  format text not null default 'openai' check (format in ('openai', 'anthropic', 'gemini')),
  endpoint text not null check (endpoint ~ '^https?://'),
  model text not null default '',
  key_pattern text,
  icon text not null default 'spark',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.remote_providers enable row level security;
drop policy if exists "Read active providers" on public.remote_providers;
create policy "Read active providers"
  on public.remote_providers for select
  using (active and auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- admin_audit_log — jejak semua perubahan lewat panel admin. Hanya nama
-- field/ID yang dicatat, bukan isi data pasien. RLS aktif tanpa policy =
-- tertutup untuk aplikasi; hanya service_role.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin text not null,
  action text not null,
  resource text not null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Realtime: aplikasi langsung menampilkan pengumuman/maintenance baru.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['app_settings', 'announcements'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Nilai awal: maintenance mati.
insert into public.app_settings (key, value, is_public)
values ('maintenance', '{"enabled": false, "message": "", "starts_at": null, "ends_at": null, "block": true}'::jsonb, true)
on conflict (key) do nothing;
