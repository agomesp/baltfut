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
  select count(*) into n from (select match_id from public.votes) s;
  if n <> 3 then raise exception 'FAIL E1: expected 3 public rows, got %', n; end if;
  raise notice 'PASS E1: anon read % public vote rows', n;

  select count(*) into n from public.vote_entries;
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

select 'ALL RLS CHECKS PASSED' as result;
