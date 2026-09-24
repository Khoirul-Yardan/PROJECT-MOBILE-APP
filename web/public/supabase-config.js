// Same project + publishable (anon) key the Flutter shell used to use
// directly. Safe to ship in client code: every row is scoped to the signed-in
// user via Row Level Security (see app/supabase/schema.sql) — the anon key
// alone cannot read or write another user's data. The secret/service_role
// key must NEVER be added here.
export const SUPABASE_URL = 'https://zcydtoywdcfjmhofdwwq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_p8YiCyAUSuawGmeYqHjETA_419maiMf';
