-- Stylized promo images: a permanent, background-removed CUTOUT of each deal's
-- photo, hosted in Supabase storage. Two wins in one column:
--   1. no white card — the client renders the product floating on the dark theme;
--   2. permanence — the Telegram `telesco.pe` image URLs EXPIRE, the cutout doesn't.
-- The isolated `scripts/promo-cutouts` pipeline fills this column after each pull.
--
-- The table-level anon SELECT grant (from the promos migration) already covers a
-- new column, so no grant change is needed here.
alter table public.promos add column if not exists image_cutout text;

-- Replace set_promos to PRESERVE existing cutouts across the atomic feed-replace,
-- matched by link — so a deal whose link survives a pull keeps its cutout and the
-- pipeline never re-cuts it. New deals get NULL until the pipeline runs.
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

  delete from public.promos;
  insert into public.promos (position, product, price, link, image, store, coupon, image_cutout)
  select x.position, x.product, x.price, x.link, x.image, x.store, x.coupon, old_cut ->> x.link
  from jsonb_to_recordset(items) as x(
    position smallint, product text, price text, link text, image text, store text, coupon text
  );
end;
$func$;
revoke all on function public.set_promos(jsonb) from public, anon, authenticated;
grant execute on function public.set_promos(jsonb) to service_role;
