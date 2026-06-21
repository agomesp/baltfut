-- Recreate the Supabase roles closely enough to exercise the migration's
-- security model in a plain Postgres container.
create role anon          nologin noinherit;
create role authenticated nologin noinherit;
create role service_role  nologin noinherit bypassrls;

grant usage on schema public to anon, authenticated, service_role;

-- NOTE: we deliberately do NOT grant service_role via default privileges here.
-- Production has "Automatically expose new tables" OFF, so new tables get no
-- grants by default — not even to service_role. Migrations must grant
-- service_role explicitly, and these assertions verify that.
