-- Applies the reference batch from packages/sync-contract/fixtures/batch.v1.json
-- (embedded verbatim; a Vitest test in that package fails if the two drift)
-- against the seeded demo meeting, then exercises idempotency, per-event
-- rejection, the race status machine and the API key touch.
begin;
select plan(35);

-- The app installation the batch claims to come from
insert into installations (id, meeting_id, app_version, schema_version, hostname)
values ('5f0c3e2a-7c1e-4a6b-9d3f-2b1c8e7a6d54', '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', '0.3.0', 1, 'RACE-SEC-LAPTOP');

create temporary table fixture as select $json$
{
  "installation_id": "5f0c3e2a-7c1e-4a6b-9d3f-2b1c8e7a6d54",
  "meeting_id": "0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4",
  "schema_version": 1,
  "app_version": "0.3.0",
  "hostname": "RACE-SEC-LAPTOP",
  "events": [
    {
      "event_id": 1,
      "entity_type": "meeting",
      "operation": "upsert",
      "key": {},
      "data": {
        "name": "Ex SPARTAN HIKE 2026",
        "description": "Qualifying Championship",
        "venue": "Serre Chevalier",
        "starts_on": "2026-01-05",
        "ends_on": "2026-01-10"
      },
      "occurred_at": "2026-01-04T18:00:00.000Z"
    },
    {
      "event_id": 2,
      "entity_type": "competitor",
      "operation": "upsert",
      "key": { "service_number": "30123456" },
      "data": {
        "first_name": "Ann",
        "last_name": "Able",
        "title": "Capt",
        "birth_year": 1994,
        "gender": "F",
        "country": "GBR"
      },
      "occurred_at": "2026-01-04T18:00:01.000Z"
    },
    {
      "event_id": 3,
      "entity_type": "meeting_entry",
      "operation": "upsert",
      "key": { "service_number": "30123456" },
      "data": {
        "title": "Capt",
        "regiment": "1 RHA",
        "arrival_army_seed": null,
        "arrival_corps_seed": 150.25,
        "is_novice": false,
        "is_junior": false,
        "is_senior": true,
        "is_veteran": false,
        "is_reserve": false,
        "is_female": true,
        "is_hc": false,
        "training_group": null,
        "do_not_publish": false,
        "army_opt_out": false
      },
      "occurred_at": "2026-01-04T18:00:02.000Z"
    },
    {
      "event_id": 4,
      "entity_type": "team",
      "operation": "upsert",
      "key": { "team_id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e" },
      "data": {
        "name": "1 RHA A",
        "team_type": "unit",
        "is_corps": false,
        "is_reserve": false,
        "is_female": false,
        "is_hc": false
      },
      "occurred_at": "2026-01-04T18:00:03.000Z"
    },
    {
      "event_id": 5,
      "entity_type": "team_members",
      "operation": "upsert",
      "key": {
        "team_id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        "race_id": null
      },
      "data": { "service_numbers": ["30123456"] },
      "occurred_at": "2026-01-04T18:00:04.000Z"
    },
    {
      "event_id": 6,
      "entity_type": "race",
      "operation": "upsert",
      "key": { "race_id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f" },
      "data": {
        "name": "Seeding Giant Slalom",
        "race_date": "2026-01-05",
        "race_type": "GS",
        "is_individual": true,
        "is_team": false,
        "is_training": false,
        "is_seeding": true,
        "women_separate": false,
        "number_runs": 2,
        "venue": "Serre Chevalier",
        "course_name": "Luc Alphand",
        "weather": "Sunny",
        "snow": "Packed",
        "temp_start": -4,
        "temp_finish": -1,
        "start_altitude": 2200,
        "finish_altitude": 1900,
        "homologation": "12345/01/24",
        "flip_count": 15,
        "flip_count_women": 5,
        "officials": {
          "tech_delegate": "Maj BAKER B GBR",
          "referee": "Capt CLARK C GBR",
          "asst_referee": null,
          "chief_of_race": "Lt Col DAVIES D GBR"
        },
        "status": "scheduled",
        "official_at": null,
        "dsq_notice_posted_at": null
      },
      "occurred_at": "2026-01-04T18:00:05.000Z"
    },
    {
      "event_id": 7,
      "entity_type": "race_run",
      "operation": "upsert",
      "key": {
        "race_id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
        "run_number": 1
      },
      "data": {
        "course_setter": "Capt EVANS Edward GBR",
        "number_gates": 42,
        "turning_gates": 40,
        "start_time": "09:30",
        "forerunners": ["FOX GBR", "GREEN GBR", null, null],
        "is_complete": false
      },
      "occurred_at": "2026-01-04T18:00:06.000Z"
    },
    {
      "event_id": 8,
      "entity_type": "start_list",
      "operation": "upsert",
      "key": { "race_id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f" },
      "data": {
        "entries": [
          {
            "service_number": "30123456",
            "bib_number": 1,
            "seed_points": 150.25
          }
        ]
      },
      "occurred_at": "2026-01-04T18:00:07.000Z"
    },
    {
      "event_id": 9,
      "entity_type": "result",
      "operation": "upsert",
      "key": {
        "race_id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
        "run_number": 1,
        "service_number": "30123456"
      },
      "data": {
        "race_time": 61.23,
        "is_dns": false,
        "is_dnf": false,
        "is_dsq": false,
        "is_ns": false,
        "dsq_gate": null,
        "dsq_reason": null
      },
      "occurred_at": "2026-01-05T10:14:03.120Z"
    },
    {
      "event_id": 10,
      "entity_type": "race_run",
      "operation": "upsert",
      "key": {
        "race_id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
        "run_number": 1
      },
      "data": {
        "course_setter": "Capt EVANS Edward GBR",
        "number_gates": 42,
        "turning_gates": 40,
        "start_time": "09:30",
        "forerunners": ["FOX GBR", "GREEN GBR", null, null],
        "is_complete": true
      },
      "occurred_at": "2026-01-05T11:00:00.000Z"
    },
    {
      "event_id": 11,
      "entity_type": "result",
      "operation": "delete",
      "key": {
        "race_id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
        "run_number": 2,
        "service_number": "30123456"
      },
      "data": null,
      "occurred_at": "2026-01-05T11:00:01.000Z"
    },
    {
      "event_id": 12,
      "entity_type": "competitor_merge",
      "operation": "upsert",
      "key": {
        "source_service_number": "30123457",
        "target_service_number": "30123456"
      },
      "data": {},
      "occurred_at": "2026-01-05T12:00:00.000Z"
    }
  ]
}
$json$::jsonb as batch;

-- 1. The whole reference batch applies cleanly
create temporary table first_run as
  select apply_sync_events(
    (select (batch->>'installation_id')::uuid from fixture),
    (select (batch->>'meeting_id')::uuid from fixture),
    (select (batch->>'schema_version')::int from fixture),
    (select batch->'events' from fixture)) as r;

select is((select (r->>'applied')::int from first_run), 12, 'every event in the reference batch is applied');
select is((select (r->>'duplicates')::int from first_run), 0, 'nothing was a duplicate the first time');
select is((select jsonb_array_length(r->'rejected') from first_run), 0, 'nothing was rejected');
select is((select (r->>'accepted_up_to_event_id')::bigint from first_run), 12::bigint, 'the whole batch is acknowledged');

select is((select name from meetings where id = '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4'), 'Ex SPARTAN HIKE 2026', 'meeting details updated');
select is((select level::text from meetings where id = '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4'), 'qualifying', 'level is not the app''s to change');
select is((select count(*) from competitors where service_number = '30123456'), 1::bigint, 'the competitor was created');
select is(
  (select regiment from meeting_entries e join competitors c on c.id = e.competitor_id where c.service_number = '30123456'),
  '1 RHA', 'the meeting entry was created');
select is(
  (select array_agg(c.service_number order by c.service_number) from team_members tm
     join meeting_entries e on e.id = tm.entry_id join competitors c on c.id = e.competitor_id
   where tm.team_id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' and tm.race_id is null),
  array['30123456'], 'the meeting-wide team roster was replaced whole');
select is(
  (select officials->>'tech_delegate' from races where id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'),
  'Maj BAKER B GBR', 'officials arrive as display strings');
select is(
  (select array_agg(bib_number order by bib_number) from start_list_entries where race_id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'),
  array[1], 'the start list was replaced whole');
select is(
  (select race_time from results r join meeting_entries e on e.id = r.entry_id join competitors c on c.id = e.competitor_id
   where r.race_id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f' and r.run_number = 1 and c.service_number = '30123456'),
  61.23::numeric, 'the result landed');
select is((select is_complete from race_runs where race_id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f' and run_number = 1), true, 'run 1 is locked');
select is((select status::text from races where id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'), 'live', 'one of two runs locked: the race is still live');
select is((select count(*) from sync_events where status = 'applied'), 12::bigint, 'twelve events logged as applied');
select isnt((select last_received_at from meetings where id = '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4'), null, 'meeting freshness stamped');

-- 2. Replaying the same batch changes nothing
create temporary table second_run as
  select apply_sync_events(
    (select (batch->>'installation_id')::uuid from fixture),
    (select (batch->>'meeting_id')::uuid from fixture),
    1,
    (select batch->'events' from fixture)) as r;
select is((select (r->>'applied')::int from second_run), 0, 'replay applies nothing');
select is((select (r->>'duplicates')::int from second_run), 12, 'replay counts every event as a duplicate');
select is((select (r->>'accepted_up_to_event_id')::bigint from second_run), 12::bigint, 'replay still acknowledges the batch');

-- 3. One bad event is rejected on its own; the rest of the batch lands
create temporary table third_run as
  select apply_sync_events(
    '5f0c3e2a-7c1e-4a6b-9d3f-2b1c8e7a6d54', '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', 1,
    $j$[
      {"event_id": 13, "entity_type": "meeting_entry", "operation": "upsert",
       "key": {"service_number": "99999999"},
       "data": {"title": null, "regiment": null, "arrival_army_seed": null, "arrival_corps_seed": null,
                "is_novice": false, "is_junior": false, "is_senior": true, "is_veteran": false, "is_reserve": false,
                "is_female": false, "is_hc": false, "training_group": null, "do_not_publish": false, "army_opt_out": false},
       "occurred_at": "2026-01-05T12:00:00.000Z"},
      {"event_id": 14, "entity_type": "race_run", "operation": "upsert",
       "key": {"race_id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f", "run_number": 2},
       "data": {"course_setter": null, "number_gates": 40, "turning_gates": 38, "start_time": "13:00",
                "forerunners": [null, null, null, null], "is_complete": true},
       "occurred_at": "2026-01-05T13:30:00.000Z"}
    ]$j$::jsonb) as r;
select is((select (r->>'applied')::int from third_run), 1, 'the good event applied');
select is((select jsonb_array_length(r->'rejected') from third_run), 1, 'the bad event was rejected');
select is((select r->'rejected'->0->>'event_id' from third_run), '13', 'the rejection names the event');
select matches((select r->'rejected'->0->>'reason' from third_run), 'competitor 99999999 is unknown', 'the rejection carries the reason');
select is((select (r->>'accepted_up_to_event_id')::bigint from third_run), 14::bigint, 'later events still acknowledged');
select is((select status::text from sync_events where event_id = 13), 'rejected', 'the rejection is logged');

-- 4. Both runs locked: provisional, then official, then reopened
select is((select status::text from races where id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'), 'provisional', 'both runs locked: the race is provisional');
select isnt((select results_posted_at from races where id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'), null, 'time of posting stamped');
select lives_ok($$ select set_race_status('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'official', 'admin:test') $$, 'a provisional race can be made official');
select is((select status::text from races where id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'), 'official', 'the race is official');
update race_runs set is_complete = false where race_id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f' and run_number = 1;
select is((select status::text from races where id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'), 'live', 'unlocking a run reopens the race');
select is((select official_at from races where id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'), null, 'reopening clears official_at');

-- 4b. The app states "official" on a race whose runs are all locked
update race_runs set is_complete = true where race_id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
create temporary table fourth_run as
  select apply_sync_events(
    '5f0c3e2a-7c1e-4a6b-9d3f-2b1c8e7a6d54', '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', 1,
    (select jsonb_build_array(
       jsonb_set(jsonb_set(e, '{event_id}', '15'::jsonb), '{data,status}', '"official"'::jsonb))
     from fixture, jsonb_array_elements(batch->'events') e
     where e->>'entity_type' = 'race')) as r;
select is((select (r->>'applied')::int from fourth_run), 1, 'the race event stating official applied');
select is((select status::text from races where id = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'), 'official', 'the app can declare a locked race official');

-- 5. API keys: counted per minute, unknown or revoked keys yield no row
insert into meeting_api_keys (meeting_id, key_hash, key_prefix, label)
values ('0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', extensions.digest('test-key', 'sha256'), 'awsa_demo_test', 'test');
select is(
  (select allowed from touch_api_key(extensions.digest('test-key', 'sha256'), 2)), true, 'a known key is allowed');
select is(
  (select count(*) from touch_api_key(extensions.digest('unknown', 'sha256'))), 0::bigint, 'an unknown key yields no row');

select * from finish();
rollback;
