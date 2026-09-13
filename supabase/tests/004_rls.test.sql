-- No base table is readable by the public roles: row level security is on
-- everywhere and anon/authenticated hold no grants except on reference data.
begin;
select plan(11);

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'row level security is enabled on every public table'
);

set local role anon;
select throws_ok(
  $$ select * from meetings $$, '42501', null,
  'anon cannot read meetings directly'
);
select throws_ok(
  $$ select * from competitors $$, '42501', null,
  'anon cannot read competitors'
);
select throws_ok(
  $$ select * from results $$, '42501', null,
  'anon cannot read results'
);
select lives_ok(
  $$ select * from seasons $$,
  'anon may read seasons'
);
select lives_ok(
  $$ select * from race_factors $$,
  'anon may read race factors'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ select * from meeting_api_keys $$, '42501', null,
  'a signed-in user without a grant cannot read API keys'
);
select lives_ok(
  $$ select * from admin_users $$,
  'a signed-in user may query admin_users (their own rows only)'
);
select is(
  (select count(*) from admin_users), 0::bigint,
  'no user claims: sees no admin rows'
);
select is(is_chairman(), false, 'no user claims: not chairman');
select is(is_meeting_admin('0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4'), false, 'no user claims: not a meeting admin');
reset role;

select * from finish();
rollback;
