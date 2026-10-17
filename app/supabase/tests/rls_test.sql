-- Uji RLS dua akun + akses anon. Dijalankan setelah rls_bootstrap.sql, schema.sql, migrasi_komunikasi_rooms.sql.
\set ON_ERROR_STOP off
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set SA '11111111-1111-1111-1111-11111111111a'

reset role;
create table public.test_results(name text, ok boolean);
create table public.test_vars(k text primary key, v text);
grant all on public.test_results, public.test_vars to public;
insert into auth.users values (:'A'), (:'B');

-- ===== seed sebagai A =====
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false), set_config('request.jwt.claim.role', 'authenticated', false);
insert into public.profiles(id, display_name, role) values (:'A', 'Perawat A', 'perawat');
insert into public.activity_log(user_id, category, title) values (:'A', 'Bots', 'log A');
insert into public.bpjs_sessions(id, perawat_id, dokter_nama, pasien_nama) values (:'SA', :'A', 'dr. X', 'Pasien A');
insert into public.bpjs_transcripts(session_id, speaker, text_segment) values (:'SA', 'pasien', 'nyeri dada');
insert into public.bpjs_documents(session_id, ringkasan) values (:'SA', 'ringkasan A');
insert into public.api_credentials(user_id, provider_id, label, encrypted_key, iv) values (:'A', 'gemini', 'Gemini', 'enc', 'iv');
insert into public.chat_messages(user_id, provider_id, provider_label, role, content) values (:'A', 'gemini', 'Gemini', 'user', 'halo');
insert into public.vpn_configs(user_id, protocol, encrypted_config, iv) values (:'A', 'openvpn', 'enc', 'iv');
insert into public.komunikasi_events(user_id, jenis) values (:'A', 'nyeri');
insert into public.komunikasi_rooms(owner_id, nama) values (:'A', 'Bed 3');
insert into public.test_vars select 'token', token from public.komunikasi_rooms where owner_id = :'A';
insert into public.test_results select 'A melihat data miliknya (bpjs_sessions)', (select count(*) from public.bpjs_sessions) = 1;

-- ===== B tidak boleh melihat/ubah data A =====
select set_config('request.jwt.claim.sub', :'B', false);
insert into public.test_results select 'B tidak melihat ' || t, c = 0 from (
  select 'activity_log' t, count(*) c from public.activity_log union all
  select 'bpjs_sessions', count(*) from public.bpjs_sessions union all
  select 'bpjs_transcripts', count(*) from public.bpjs_transcripts union all
  select 'bpjs_documents', count(*) from public.bpjs_documents union all
  select 'api_credentials', count(*) from public.api_credentials union all
  select 'chat_messages', count(*) from public.chat_messages union all
  select 'vpn_configs', count(*) from public.vpn_configs union all
  select 'komunikasi_events', count(*) from public.komunikasi_events union all
  select 'komunikasi_rooms', count(*) from public.komunikasi_rooms) x;

do $$ declare n int; begin
  update public.bpjs_sessions set pasien_nama = 'dirusak' where id = '11111111-1111-1111-1111-11111111111a';
  get diagnostics n = row_count;
  insert into public.test_results values ('B tidak bisa UPDATE sesi A', n = 0);
  delete from public.api_credentials where user_id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  insert into public.test_results values ('B tidak bisa DELETE kredensial A', n = 0);
end $$;

do $$ begin
  begin
    insert into public.bpjs_transcripts(session_id, speaker, text_segment) values ('11111111-1111-1111-1111-11111111111a', 'pasien', 'sisipan B');
    insert into public.test_results values ('B tidak bisa INSERT transkrip ke sesi A', false);
  exception when others then
    insert into public.test_results values ('B tidak bisa INSERT transkrip ke sesi A', true);
  end;
  begin
    insert into public.bpjs_sessions(perawat_id, dokter_nama, pasien_nama) values ('00000000-0000-0000-0000-00000000000a', 'd', 'palsu');
    insert into public.test_results values ('B tidak bisa membuat sesi atas nama A', false);
  exception when others then
    insert into public.test_results values ('B tidak bisa membuat sesi atas nama A', true);
  end;
  begin
    insert into public.api_credentials(user_id, provider_id, label, encrypted_key, iv) values ('00000000-0000-0000-0000-00000000000a', 'x', 'x', 'e', 'i');
    insert into public.test_results values ('B tidak bisa menanam kredensial di akun A', false);
  exception when others then
    insert into public.test_results values ('B tidak bisa menanam kredensial di akun A', true);
  end;
end $$;

-- profil dibaca semua user login (desain: pencarian). Dicatat sebagai temuan informasional.
insert into public.test_results select 'INFO profiles milik A terbaca oleh B (by design)', (select count(*) from public.profiles where id = :'A') = 1;

-- ===== anon =====
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', 'anon', false);
insert into public.test_results select 'anon tidak melihat ' || t, c = 0 from (
  select 'bpjs_sessions' t, count(*) c from public.bpjs_sessions union all
  select 'bpjs_transcripts', count(*) from public.bpjs_transcripts union all
  select 'api_credentials', count(*) from public.api_credentials union all
  select 'komunikasi_events', count(*) from public.komunikasi_events union all
  select 'komunikasi_rooms', count(*) from public.komunikasi_rooms union all
  select 'profiles', count(*) from public.profiles) x;

insert into public.test_results select 'anon: room_info token valid -> nama ruangan', (select nama from public.komunikasi_room_info((select v from public.test_vars where k = 'token'))) = 'Bed 3';
insert into public.test_results select 'anon: kirim pesan token valid diterima', public.komunikasi_kirim((select v from public.test_vars where k = 'token'), 'haus', '{}'::jsonb, false);
insert into public.test_results select 'anon: token palsu ditolak', not public.komunikasi_kirim('tokenpalsu', 'haus', '{}'::jsonb, false);
insert into public.test_results select 'anon: jenis terlalu panjang ditolak', not public.komunikasi_kirim((select v from public.test_vars where k = 'token'), repeat('x', 31), '{}'::jsonb, false);
insert into public.test_results select 'anon: detail > 1000 karakter ditolak', not public.komunikasi_kirim((select v from public.test_vars where k = 'token'), 'haus', jsonb_build_object('x', repeat('y', 1100)), false);

do $$ declare ok_count int := 0; r boolean; i int; t text; begin
  select v into t from public.test_vars where k = 'token';
  for i in 1..30 loop
    r := public.komunikasi_kirim(t, 'haus', '{}'::jsonb, false);
    if r then ok_count := ok_count + 1; end if;
  end loop;
  insert into public.test_results values ('anon: anti-spam membatasi (diterima ' || ok_count || ' dari 30 tambahan)', ok_count < 30 and ok_count <= 20);
end $$;

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false), set_config('request.jwt.claim.role', 'authenticated', false);
insert into public.test_results select 'A menerima pesan dari tautan ruangan', (select count(*) from public.komunikasi_events where room_id is not null) >= 1;
update public.komunikasi_rooms set aktif = false where owner_id = :'A';

reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', 'anon', false);
insert into public.test_results select 'anon: tautan dinonaktifkan ditolak', not public.komunikasi_kirim((select v from public.test_vars where k = 'token'), 'haus', '{}'::jsonb, false);
do $$ begin
  begin
    insert into public.komunikasi_events(user_id, jenis) values ('00000000-0000-0000-0000-00000000000a', 'langsung');
    insert into public.test_results values ('anon tidak bisa INSERT langsung ke komunikasi_events', false);
  exception when others then
    insert into public.test_results values ('anon tidak bisa INSERT langsung ke komunikasi_events', true);
  end;
end $$;

reset role;
select case when ok then 'PASS' else 'FAIL' end as hasil, name from public.test_results order by ok, name;
select count(*) filter (where ok) as lulus, count(*) filter (where not ok) as gagal from public.test_results;
