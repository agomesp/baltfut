-- Regression fix: the previous migration (20260707120000) reintroduced an
-- unqualified DELETE in set_promos, which Supabase blocks ("DELETE requires a WHERE
-- clause") — so the promos cron 400'd. Restore the qualified delete (position is the
-- NOT NULL primary key) while KEEPING the cutout-preserve-by-link behaviour.
--
-- NB: the CI Postgres doesn't enforce safe-updates, so the RLS assertions can't
-- catch this — only the live REST path does.
create or replace function public.set_promos(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  old_cut jsonb;
begin
  -- snapshot link -> image_cutout for the deals that currently have a cutout
  select coalesce(jsonb_object_agg(link, image_cutout), '{}'::jsonb)
    into old_cut
  from public.promos
  where image_cutout is not null;

  delete from public.promos where position is not null;
  insert into public.promos (position, product, price, link, image, store, coupon, image_cutout)
  select x.position, x.product, x.price, x.link, x.image, x.store, x.coupon, old_cut ->> x.link
  from jsonb_to_recordset(items) as x(
    position smallint, product text, price text, link text, image text, store text, coupon text
  );
end;
$func$;
revoke all on function public.set_promos(jsonb) from public, anon, authenticated;
grant execute on function public.set_promos(jsonb) to service_role;
