-- The public views: no private column leaks, unpublished meetings are
-- invisible, a withheld entry keeps its position but loses its identity.
begin;
select plan(14);

select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name like 'public\_%'
     and column_name in ('service_number', 'birth_year', 'competitor_id', 'organiser_name',
                         'organiser_email', 'key_hash', 'payload', 'do_not_publish', 'army_opt_out')),
  0::bigint,
  'no public view exposes a private column'
);

set local role anon;
select is((select count(*) from public_meetings), 1::bigint, 'anon sees the published demo meeting');
select is((select count(*) from public_races), 1::bigint, 'anon sees its race');
select is((select count(*) from public_race_results), 4::bigint, 'anon sees a result row per competitor');
select is(
  (select display_name from public_race_results where withheld order by entry_id limit 1),
  'Withheld', 'a withheld entry shows no name'
);
select is(
  (select team from public_race_results where withheld order by entry_id limit 1),
  null, 'a withheld entry shows no unit'
);
select isnt(
  (select position from public_race_results where withheld order by entry_id limit 1),
  null, 'a withheld entry keeps its position'
);
select is(
  (select display_name from public_race_results where bib_number = 1),
  'Sgt CLARK Carl', 'names are rendered as on the results sheet'
);
-- Two-run race with only run 1 in: no totals yet, but a run-1 standing
select is((select count(*) from public_race_results where total_time is not null), 0::bigint, 'no total until both runs are in');
select is((select bib_number from public_race_results where run_1_position = 1), 1, 'run-1 leader is bib 1');
reset role;

-- Unpublish: everything disappears from the public views
update meetings set is_published = false where id = '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4';
set local role anon;
select is((select count(*) from public_meetings), 0::bigint, 'an unpublished meeting is invisible');
select is((select count(*) from public_race_results), 0::bigint, 'and so are its results');
reset role;

-- The organiser results view shows a signed-in non-admin nothing unpublished
set local role authenticated;
select is((select count(*) from race_result_rows), 0::bigint, 'race_result_rows hides unpublished meetings from non-admins');
reset role;
update meetings set is_published = true where id = '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4';
set local role authenticated;
select is((select count(*) from race_result_rows), 4::bigint, 'race_result_rows shows a published meeting to anyone signed in');
reset role;

select * from finish();
rollback;
