-- The cast-vote Edge Function inserts as `service_role`. With the project's
-- "Automatically expose new tables" setting OFF, a newly created table receives
-- NO grants by default — not even to service_role. service_role's BYPASSRLS
-- skips RLS *policies* but NOT table-level GRANTs, so inserts were failing with
-- "42501 permission denied for table votes".
--
-- Grant service_role explicit access to the votes table (it remains the only
-- writer; anon/authenticated still have read-only on safe columns).
grant select, insert, update, delete on public.votes to service_role;
