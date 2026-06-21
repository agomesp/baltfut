# Database security tests

Re-runnable checks for the `votes` Row-Level-Security model (migration
`supabase/migrations/*_create_votes.sql`). They assert, against a real Postgres,
that:

- `service_role` can insert valid votes; the `UNIQUE(match_id, ip_hash)`
  constraint blocks one-IP-double-voting per match.
- CHECK constraints reject out-of-range scores, invalid sides, and markup in
  usernames.
- `anon` is **denied** the `id` and `ip_hash` columns and all writes
  (insert/update/delete), yet can still read the public columns and the
  `vote_results` / `vote_entries` views — which never expose `ip_hash`.

## Run locally (throwaway container)

```sh
docker run -d --name baltfut_pg -e POSTGRES_PASSWORD=postgres postgres:15-alpine
until docker exec baltfut_pg pg_isready -U postgres -q; do :; done

PSQL="docker exec -i baltfut_pg psql -U postgres -d postgres -v ON_ERROR_STOP=1"
$PSQL < scripts/db/rls_roles.sql                       # recreate anon/service_role
$PSQL < supabase/migrations/*_create_votes.sql         # apply the schema
$PSQL < scripts/db/rls_assertions.sql                  # PASS/FAIL assertions

docker rm -f baltfut_pg
```

A failed assertion raises an exception and aborts (non-zero exit), so this is
safe to gate CI on. `rls_roles.sql` mirrors the Supabase roles closely enough to
exercise the migration; production uses Supabase's own role bootstrap.
