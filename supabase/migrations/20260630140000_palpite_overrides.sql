-- Manual per-match palpite window. Lets the admin extend the default kickoff+grace
-- cutoff for ONE match, reopen a finished match, or close it early — pushed live to
-- every screen (Realtime broadcast) AND honored by the cast-vote Edge Function so
-- real viewers can actually submit during the window (not just see the form).
--
-- One row per match means "there is a manual window": palpites are open iff
-- `now <= open_until` (this fully overrides the finished state and the default
-- grace; see `palpitesClosedWithOverride` in _shared/deadline.ts). No row → the
-- default rule applies. To close a match early, set `open_until` in the past; to
-- return to automatic, DELETE the row.
--
-- SECURITY (mirrors the votes/promos model):
--   * Written ONLY via service_role (the admin tool); anon/authenticated get a
--     read-only column SELECT (match_id + open_until — no PII, it's public info
--     that "palpites are open for match X until T"). ip_hash etc. are unaffected.
--   * RLS enabled + forced; the only policy is a public SELECT.
--   * Grants gotcha: a new table gets ZERO grants on this project — grant both
--     anon (read) and service_role (write) explicitly.
create table public.palpite_overrides (
  match_id   text primary key,
  open_until timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.palpite_overrides is
  'Manual per-match palpite window. Row present => palpites open iff now <= open_until (overrides the default finished/kickoff+grace cutoff). Written via service_role (admin); read by anon for the live UI and by cast-vote for the server cutoff.';

alter table public.palpite_overrides enable row level security;
alter table public.palpite_overrides force row level security;

-- Grants gotcha: new table → ZERO grants. Grant both, minimally.
revoke all on public.palpite_overrides from anon, authenticated;
grant select (match_id, open_until) on public.palpite_overrides to anon, authenticated;
grant select, insert, update, delete on public.palpite_overrides to service_role;

create policy "Public can read palpite windows"
  on public.palpite_overrides for select to anon, authenticated using (true);
