-- The golden scoring fixture (packages/scoring/test/fixtures/race-scoring.json,
-- embedded verbatim and guarded by a Vitest test there) scored by the
-- race_result_rows view must match the expectations the app's SQLite query
-- is held to in src/__tests__/raceScoringFixture.test.js.
begin;
select plan(3);

create temporary table fixture as select $json$
{
  "description": "Golden race-scoring fixture: the same rows must score identically in the app's SQLite query and the service's race_result_rows view.",
  "races": [
    {
      "id": "GS1",
      "name": "Giant Slalom",
      "race_type": "GS",
      "number_runs": 1,
      "entries": [
        {
          "sn": "A",
          "bib": 1,
          "runs": {
            "1": {
              "time": 60.0
            }
          }
        },
        {
          "sn": "B",
          "bib": 2,
          "runs": {
            "1": {
              "time": 62.34
            }
          }
        },
        {
          "sn": "C",
          "bib": 3,
          "runs": {
            "1": {
              "time": 62.34
            }
          }
        },
        {
          "sn": "D",
          "bib": 4,
          "runs": {
            "1": {
              "time": 30.1,
              "dnf": true
            }
          }
        },
        {
          "sn": "E",
          "bib": 5,
          "runs": {
            "1": {
              "time": 65.0
            }
          }
        }
      ],
      "expected": [
        {
          "sn": "A",
          "position": 1,
          "points": 0.0
        },
        {
          "sn": "B",
          "position": 2,
          "points": 39.39
        },
        {
          "sn": "C",
          "position": 2,
          "points": 39.39
        },
        {
          "sn": "E",
          "position": 4,
          "points": 84.17
        },
        {
          "sn": "D",
          "position": null,
          "points": null,
          "is_dnf": true
        }
      ]
    },
    {
      "id": "SL2",
      "name": "Slalom",
      "race_type": "SL",
      "number_runs": 2,
      "entries": [
        {
          "sn": "A",
          "bib": 1,
          "runs": {
            "1": {
              "time": 45.1
            },
            "2": {
              "time": 46.2
            }
          }
        },
        {
          "sn": "B",
          "bib": 2,
          "runs": {
            "1": {
              "time": 44.9
            },
            "2": {
              "time": 47.6
            }
          }
        },
        {
          "sn": "C",
          "bib": 3,
          "runs": {
            "1": {
              "time": 46.0
            },
            "2": {
              "time": 20.0,
              "dsq": true,
              "gate": 12
            }
          }
        },
        {
          "sn": "D",
          "bib": 4,
          "runs": {
            "1": {
              "time": 47.0
            }
          }
        }
      ],
      "expected": [
        {
          "sn": "A",
          "position": 1,
          "points": 0.0
        },
        {
          "sn": "B",
          "position": 2,
          "points": 9.59
        },
        {
          "sn": "C",
          "position": null,
          "points": null,
          "is_dsq": true
        },
        {
          "sn": "D",
          "position": null,
          "points": null
        }
      ]
    }
  ]
}
$json$::jsonb as doc;

-- Build a private meeting from the fixture: one competitor per service
-- number, one race per fixture race, run rows and results as given
insert into meetings (id, slug, name, level, season_id, is_published)
values ('99999999-9999-4999-8999-999999999999', 'golden-fixture', 'Golden fixture', 'other', '2025-26', true);

insert into competitors (service_number, first_name, last_name)
select distinct e->>'sn', e->>'sn', 'Racer'
from fixture, jsonb_array_elements(doc->'races') r, jsonb_array_elements(r->'entries') e;

insert into meeting_entries (meeting_id, competitor_id)
select '99999999-9999-4999-8999-999999999999', c.id
from competitors c
where c.service_number in (
  select distinct e->>'sn' from fixture, jsonb_array_elements(doc->'races') r, jsonb_array_elements(r->'entries') e);

insert into races (id, meeting_id, name, race_type, number_runs, is_individual)
select md5(r->>'id')::uuid, '99999999-9999-4999-8999-999999999999', r->>'name', (r->>'race_type')::race_type,
       (r->>'number_runs')::int, true
from fixture, jsonb_array_elements(doc->'races') r;

insert into race_runs (race_id, run_number)
select md5(r->>'id')::uuid, n
from fixture, jsonb_array_elements(doc->'races') r, generate_series(1, (r->>'number_runs')::int) n;

insert into start_list_entries (race_id, entry_id, bib_number)
select md5(r->>'id')::uuid, sync_entry_id('99999999-9999-4999-8999-999999999999', e->>'sn'), (e->>'bib')::int
from fixture, jsonb_array_elements(doc->'races') r, jsonb_array_elements(r->'entries') e;

insert into results (race_id, run_number, entry_id, race_time, is_dns, is_dnf, is_dsq, is_ns, dsq_gate)
select md5(r->>'id')::uuid, run.key::int, sync_entry_id('99999999-9999-4999-8999-999999999999', e->>'sn'),
       (run.value->>'time')::numeric,
       coalesce((run.value->>'dns')::boolean, false), coalesce((run.value->>'dnf')::boolean, false),
       coalesce((run.value->>'dsq')::boolean, false), false, (run.value->>'gate')::int
from fixture, jsonb_array_elements(doc->'races') r, jsonb_array_elements(r->'entries') e,
     jsonb_each(e->'runs') run;

-- Finishers: position and points must match exactly
select results_eq(
  $$ select r->>'id' as race, x->>'sn' as sn, (x->>'position')::bigint as position, (x->>'points')::numeric(8,2) as points
     from fixture, jsonb_array_elements(doc->'races') r, jsonb_array_elements(r->'expected') x
     where x->>'points' is not null
     order by 1, 2 $$,
  $$ select ra.name_key, c.service_number, rr.position_sql, rr.race_points_sql::numeric(8,2)
     from race_result_rows rr
     join (select md5(r->>'id')::uuid as id, r->>'id' as name_key from fixture, jsonb_array_elements(doc->'races') r) ra on ra.id = rr.race_id
     join meeting_entries e on e.id = rr.entry_id
     join competitors c on c.id = e.competitor_id
     where rr.race_points_sql is not null
     order by 1, 2 $$,
  'finishers score the same as the golden fixture'
);

-- Non-finishers never earn points, whatever their partial times
select is(
  (select count(*) from race_result_rows rr
   join meeting_entries e on e.id = rr.entry_id join competitors c on c.id = e.competitor_id
   where rr.meeting_id = '99999999-9999-4999-8999-999999999999' and rr.race_points_sql is not null
     and (c.service_number, rr.race_id) in (
       select x->>'sn', md5(r->>'id')::uuid from fixture, jsonb_array_elements(doc->'races') r, jsonb_array_elements(r->'expected') x
       where x->>'points' is null)),
  0::bigint,
  'non-finishers have no points'
);

-- Run-1 standing in a two-run race
select results_eq(
  $$ select c.service_number, rr.run_1_position from race_result_rows rr
     join meeting_entries e on e.id = rr.entry_id join competitors c on c.id = e.competitor_id
     where rr.race_id = md5('SL2')::uuid order by rr.run_1_position, c.service_number $$,
  $$ values ('B', 1::bigint), ('A', 2::bigint), ('C', 3::bigint), ('D', 4::bigint) $$,
  'run 1 positions are available before run 2'
);

select * from finish();
rollback;
