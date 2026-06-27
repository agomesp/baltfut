\set ON_ERROR_STOP on

-- A) service_role can insert valid predictions ------------------------------
do $$
begin
  set local role service_role;
  insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
  values
    ('1002','fifa.world','Allan', 2,1, repeat('a',64)),
    ('1002','fifa.world','Bea',   1,1, repeat('b',64)),
    ('1003','fifa.world','Cid',   3,1, repeat('c',64));
  raise notice 'PASS A: service_role inserted 3 valid predictions';
end $$;

-- B) one prediction per IP per match (duplicate match_id+ip_hash) ------------
do $$
begin
  set local role service_role;
  begin
    insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
    values ('1002','fifa.world','Allan2',0,0, repeat('a',64));
    raise exception 'FAIL B: duplicate (match_id, ip_hash) was allowed';
  exception when unique_violation then
    raise notice 'PASS B: duplicate IP per match rejected (unique_violation)';
  end;
end $$;

-- C) CHECK constraints reject bad data --------------------------------------
do $$
begin
  set local role service_role;
  begin
    insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
    values ('1099','fifa.world','X',99,0, repeat('d',64));
    raise exception 'FAIL C1: pred_home=99 accepted';
  exception when check_violation then raise notice 'PASS C1: out-of-range score rejected';
  end;
  begin
    insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
    values ('1099','fifa.world','<script>',0,0, repeat('f',64));
    raise exception 'FAIL C2: angle-bracket username accepted';
  exception when check_violation then raise notice 'PASS C2: markup username rejected';
  end;
end $$;

-- D) anon CANNOT read id or ip_hash -----------------------------------------
do $$
begin
  set local role anon;
  begin
    perform 1 from (select id from public.votes limit 1) s;
    raise exception 'FAIL D1: anon read id column';
  exception when insufficient_privilege then raise notice 'PASS D1: anon denied id column';
  end;
  begin
    perform 1 from (select ip_hash from public.votes limit 1) s;
    raise exception 'FAIL D2: anon read ip_hash column';
  exception when insufficient_privilege then raise notice 'PASS D2: anon denied ip_hash column';
  end;
end $$;

-- E) anon CAN read the public columns and the feed --------------------------
do $$
declare n int;
begin
  set local role anon;
  -- Scope to the test's own fixtures ('1002'/'1003'). Real matches use ESPN ids
  -- (e.g. '760452'), and data-seeding migrations populate the table before this
  -- runs, so asserting the whole-table count would be brittle. This still proves
  -- anon can read the public columns of the rows we inserted.
  select count(*) into n from (select match_id from public.votes where match_id in ('1002','1003')) s;
  if n <> 3 then raise exception 'FAIL E1: expected 3 test rows, got %', n; end if;
  raise notice 'PASS E1: anon read % public vote rows', n;

  select count(*) into n from public.vote_entries where match_id in ('1002','1003');
  if n <> 3 then raise exception 'FAIL E2: vote_entries returned %', n; end if;
  raise notice 'PASS E2: anon read vote_entries (% rows)', n;

  -- vote_match_counts aggregate (2 predictions on match 1002).
  select votes into n from public.vote_match_counts where match_id = '1002';
  if n <> 2 then raise exception 'FAIL E3: vote_match_counts(1002) = %', n; end if;
  raise notice 'PASS E3: vote_match_counts shows 2 for match 1002';
end $$;

-- F) vote_entries never exposes ip_hash -------------------------------------
do $$
begin
  set local role anon;
  begin
    perform 1 from (select ip_hash from public.vote_entries limit 1) s;
    raise exception 'FAIL F: vote_entries exposed ip_hash';
  exception when undefined_column then raise notice 'PASS F: ip_hash absent from vote_entries';
  end;
end $$;

-- G) anon CANNOT write ------------------------------------------------------
do $$
begin
  set local role anon;
  begin
    insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
    values ('1002','fifa.world','Hacker',0,0, repeat('z',64));
    raise exception 'FAIL G1: anon inserted a vote';
  exception when insufficient_privilege then raise notice 'PASS G1: anon insert denied';
  end;
  begin
    update public.votes set pred_home = 9 where match_id = '1002';
    raise exception 'FAIL G2: anon updated a vote';
  exception when insufficient_privilege then raise notice 'PASS G2: anon update denied';
  end;
  begin
    delete from public.votes where match_id = '1002';
    raise exception 'FAIL G3: anon deleted a vote';
  exception when insufficient_privilege then raise notice 'PASS G3: anon delete denied';
  end;
end $$;

-- H) one name per match, case-insensitive --------------------------------------
do $$
begin
  set local role service_role;
  begin
    -- 'allan' vs existing 'Allan' on match 1002 (different IP), should be rejected.
    insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
    values ('1002','fifa.world','allan',0,0, repeat('h',64));
    raise exception 'FAIL H: duplicate name on a match was allowed';
  exception when unique_violation then raise notice 'PASS H: duplicate name per match rejected';
  end;
end $$;

-- I) name_claims is fully locked to anon — the token_hash secret must never leak
--    (audit D2). anon has ZERO grants on this table.
do $$
begin
  set local role anon;
  begin
    perform 1 from (select token_hash from public.name_claims limit 1) s;
    raise exception 'FAIL I1: anon read name_claims.token_hash';
  exception when insufficient_privilege then raise notice 'PASS I1: anon denied name_claims.token_hash';
  end;
  begin
    insert into public.name_claims (name_lower, name, token_hash)
    values ('hacker','hacker', repeat('z',64));
    raise exception 'FAIL I2: anon wrote name_claims';
  exception when insufficient_privilege then raise notice 'PASS I2: anon write to name_claims denied';
  end;
end $$;

-- J) ...but the server (service_role) still holds its write grant on name_claims.
do $$
begin
  set local role service_role;
  insert into public.name_claims (name_lower, name, token_hash)
  values ('zztest','ZZTest', repeat('a',64))
  on conflict (name_lower) do nothing;
  raise notice 'PASS J: service_role can write name_claims';
end $$;

-- K) promos is anon read-only (audit D2): anon may SELECT, never write. ----------
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.promos;        -- anon CAN read (must not raise)
  raise notice 'PASS K1: anon read promos (% rows)', n;
  begin
    insert into public.promos (position, product, link) values (32000, 'x', 'x');
    raise exception 'FAIL K2: anon inserted a promo';
  exception when insufficient_privilege then raise notice 'PASS K2: anon insert promo denied';
  end;
  begin
    update public.promos set product = 'x' where position = 0;
    raise exception 'FAIL K3: anon updated a promo';
  exception when insufficient_privilege then raise notice 'PASS K3: anon update promo denied';
  end;
  begin
    delete from public.promos;
    raise exception 'FAIL K4: anon deleted promos';
  exception when insufficient_privilege then raise notice 'PASS K4: anon delete promo denied';
  end;
end $$;

-- L) set_promos: only service_role may execute the privileged feed-replace RPC
--    (audit D3). anon must not be able to wipe/replace the deals feed.
do $$
begin
  set local role anon;
  begin
    perform public.set_promos('[]'::jsonb);
    raise exception 'FAIL L1: anon executed set_promos';
  exception when insufficient_privilege then raise notice 'PASS L1: anon set_promos execute denied';
  end;
end $$;
do $$
begin
  set local role service_role;
  perform public.set_promos('[]'::jsonb);           -- execute grant intact (must not raise)
  raise notice 'PASS L2: service_role can execute set_promos';
end $$;

select 'ALL RLS CHECKS PASSED' as result;
