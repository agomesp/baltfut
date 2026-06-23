-- Supabase blocks an unqualified DELETE ("DELETE requires a WHERE clause"), so
-- the set_promos() RPC failed. Replace it with a qualified delete (position is
-- the NOT NULL primary key, so `where position is not null` matches every row).
create or replace function public.set_promos(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  delete from public.promos where position is not null;
  insert into public.promos (position, product, price, link, image, store, coupon)
  select x.position, x.product, x.price, x.link, x.image, x.store, x.coupon
  from jsonb_to_recordset(items) as x(
    position smallint, product text, price text, link text, image text, store text, coupon text
  );
end;
$func$;
revoke all on function public.set_promos(jsonb) from public, anon, authenticated;
grant execute on function public.set_promos(jsonb) to service_role;
