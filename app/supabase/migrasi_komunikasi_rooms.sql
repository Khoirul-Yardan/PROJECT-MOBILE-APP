-- ---------------------------------------------------------------------------
-- Papan Komunikasi: tautan ruangan untuk pasien/keluarga (tanpa login)
-- ---------------------------------------------------------------------------
-- Perawat membuat "ruangan" (mis. Bed 3) dan membagikan tautannya. Pasien
-- atau keluarga membuka tautan itu tanpa akun; pesan masuk ke komunikasi_events
-- milik perawat pemilik ruangan lewat dua fungsi SECURITY DEFINER di bawah.
-- Anon TIDAK mendapat akses tabel apa pun secara langsung - hanya dua RPC ini.
-- Jalankan di Supabase -> SQL Editor (aman dijalankan berulang).

create table if not exists public.komunikasi_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  nama text not null check (char_length(nama) between 1 and 40),
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.komunikasi_rooms enable row level security;

drop policy if exists "Owner manages own rooms" on public.komunikasi_rooms;
create policy "Owner manages own rooms"
  on public.komunikasi_rooms for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

alter table public.komunikasi_events
  add column if not exists room_id uuid references public.komunikasi_rooms (id) on delete set null;

create or replace function public.komunikasi_room_info(p_token text)
returns table (nama text)
language sql security definer set search_path = public as $$
  select r.nama from public.komunikasi_rooms r where r.token = p_token and r.aktif;
$$;

create or replace function public.komunikasi_kirim(
  p_token text, p_jenis text, p_detail jsonb, p_mendesak boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  r public.komunikasi_rooms;
begin
  select * into r from public.komunikasi_rooms where token = p_token and aktif;
  if not found then return false; end if;
  if p_jenis is null or char_length(p_jenis) > 30 then return false; end if;
  if char_length(coalesce(p_detail, '{}'::jsonb)::text) > 1000 then return false; end if;
  -- Anti-spam: tautan ini publik, batasi 20 pesan per 10 detik per ruangan.
  if (select count(*) from public.komunikasi_events
      where room_id = r.id and created_at > now() - interval '10 seconds') >= 20 then
    return false;
  end if;
  insert into public.komunikasi_events (user_id, room_id, pasien_ref, jenis, detail, mendesak)
  values (r.owner_id, r.id, r.nama, p_jenis, coalesce(p_detail, '{}'::jsonb), coalesce(p_mendesak, false));
  return true;
end;
$$;

revoke all on function public.komunikasi_room_info(text) from public;
revoke all on function public.komunikasi_kirim(text, text, jsonb, boolean) from public;
grant execute on function public.komunikasi_room_info(text) to anon, authenticated;
grant execute on function public.komunikasi_kirim(text, text, jsonb, boolean) to anon, authenticated;
