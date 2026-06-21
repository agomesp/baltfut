-- Recreate the Supabase roles closely enough to exercise the migration's
-- security model in a plain Postgres container.
create role anon          nologin noinherit;
create role authenticated nologin noinherit;
create role service_role  nologin noinherit bypassrls;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants service_role full table access; mirror that for tables created
-- after this point (i.e. by the migration, which runs as the bootstrap superuser).
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
