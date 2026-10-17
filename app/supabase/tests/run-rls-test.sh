#!/bin/bash
# Uji RLS schema.sql di Postgres Docker terpisah (BUKAN Supabase asli).
# Pakai: bash app/supabase/tests/run-rls-test.sh
set -e
cd "$(dirname "$0")"
NAME=pg-rls-test
docker rm -f $NAME >/dev/null 2>&1 || true
docker run -d --name $NAME -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16-alpine >/dev/null
for i in $(seq 1 40); do docker exec $NAME pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 3
run() { docker exec -i $NAME psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
run < rls_bootstrap.sql
run < ../schema.sql >/dev/null
run < ../migrasi_komunikasi_rooms.sql >/dev/null
run < ../schema.sql >/dev/null && echo "schema.sql dijalankan ulang: idempoten OK"
docker exec -i $NAME psql -U postgres -q < rls_test.sql
docker rm -f $NAME >/dev/null
