-- The foundation tables, the columns other components depend on, and the
-- discipline factors the scoring package must agree with.
begin;
select plan(17);

select has_table('public', 'seasons', 'seasons exists');
select has_table('public', 'meetings', 'meetings exists');
select has_table('public', 'meeting_api_keys', 'meeting_api_keys exists');
select has_table('public', 'installations', 'installations exists');
select has_table('public', 'competitors', 'competitors exists');
select has_table('public', 'meeting_entries', 'meeting_entries exists');
select has_table('public', 'races', 'races exists');
select has_table('public', 'results', 'results exists');
select has_table('public', 'seed_list_snapshots', 'seed_list_snapshots exists');
select has_table('public', 'final_seed_list_rows', 'final_seed_list_rows exists');
select has_view('public', 'meeting_team_rosters', 'meeting_team_rosters view exists');

select has_column('public', 'meetings', 'feeds_meeting_id', 'meetings link up the ladder');
select has_column('public', 'meeting_entries', 'army_opt_out', 'entries carry the Army opt-out (B17.a)');
select has_column('public', 'races', 'is_championship', 'races know whether they count');

select results_eq(
  $$ select race_type::text, factor from race_factors order by race_type $$,
  $$ values ('AC', 1360), ('DH', 1250), ('GS', 1010), ('SG', 1190), ('SL', 730) $$,
  'discipline factors match RACE_FACTORS in packages/scoring'
);

-- A seeding race never counts as a championship race
select is(
  (select is_championship from races where id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'),
  false,
  'the seeded GS is not a championship race'
);

-- The roster view gathers members across race-specific and meeting-wide rows
select is(
  (select count(*) from meeting_team_rosters where team_id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'),
  2::bigint,
  'the demo team has two roster members'
);

select * from finish();
rollback;
