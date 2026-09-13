-- Fixes from the schema lint (plpgsql_check): the race applier compared the
-- status enum with text, which only fails at run time on the official and
-- cancelled paths; and the batch function initialised its arrays from text.

create or replace function sync_apply_race(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare
  v_race   uuid := (p_key->>'race_id')::uuid;
  v_status text := p_data->>'status';
  r        races%rowtype;
begin
  if p_op = 'delete' then
    delete from races where id = v_race and meeting_id = p_meeting;
    return;
  end if;
  insert into races (id, meeting_id, name, race_date, race_type, is_individual, is_team, is_training, is_seeding,
    women_separate, number_runs, venue, course_name, weather, snow, temp_start, temp_finish, start_altitude,
    finish_altitude, homologation, flip_count, flip_count_women, officials, dsq_notice_posted_at, app_updated_at, synced_at)
  values (v_race, p_meeting, p_data->>'name', (p_data->>'race_date')::date, (p_data->>'race_type')::race_type,
    coalesce((p_data->>'is_individual')::boolean, false), coalesce((p_data->>'is_team')::boolean, false),
    coalesce((p_data->>'is_training')::boolean, false), coalesce((p_data->>'is_seeding')::boolean, false),
    coalesce((p_data->>'women_separate')::boolean, false), coalesce((p_data->>'number_runs')::int, 1),
    p_data->>'venue', p_data->>'course_name', p_data->>'weather', p_data->>'snow',
    (p_data->>'temp_start')::numeric, (p_data->>'temp_finish')::numeric,
    (p_data->>'start_altitude')::numeric, (p_data->>'finish_altitude')::numeric, p_data->>'homologation',
    (p_data->>'flip_count')::int, (p_data->>'flip_count_women')::int, coalesce(p_data->'officials', '{}'::jsonb),
    (p_data->>'dsq_notice_posted_at')::timestamptz, p_occurred, now())
  on conflict (id) do update set
    name = excluded.name, race_date = excluded.race_date, race_type = excluded.race_type,
    is_individual = excluded.is_individual, is_team = excluded.is_team, is_training = excluded.is_training,
    is_seeding = excluded.is_seeding, women_separate = excluded.women_separate, number_runs = excluded.number_runs,
    venue = excluded.venue, course_name = excluded.course_name, weather = excluded.weather, snow = excluded.snow,
    temp_start = excluded.temp_start, temp_finish = excluded.temp_finish, start_altitude = excluded.start_altitude,
    finish_altitude = excluded.finish_altitude, homologation = excluded.homologation, flip_count = excluded.flip_count,
    flip_count_women = excluded.flip_count_women, officials = excluded.officials,
    dsq_notice_posted_at = excluded.dsq_notice_posted_at, app_updated_at = excluded.app_updated_at, synced_at = now()
  where races.meeting_id = p_meeting;

  -- The app only ever states official or cancelled; anything else means
  -- "derive it", which also reverts an official race the secretary reopened
  select * into r from races where id = v_race;
  if v_status in ('official', 'cancelled') then
    if r.status::text <> v_status then
      if v_status = 'official' and r.status <> 'provisional' then
        perform recompute_race_status(v_race, 'app');
        select * into r from races where id = v_race;
      end if;
      perform set_race_status(v_race, v_status::race_status, 'app', coalesce((p_data->>'official_at')::timestamptz, p_occurred));
    end if;
  elsif r.status in ('official', 'cancelled') then
    perform set_race_status(v_race, 'provisional', 'app');
  else
    perform recompute_race_status(v_race, 'app');
  end if;
end $$;

create or replace function apply_sync_events(p_installation_id uuid, p_meeting_id uuid, p_schema_version int, p_events jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev         jsonb;
  v_id       bigint;
  v_up_to    bigint;
  v_applied  int := 0;
  v_dups     int := 0;
  v_rejected jsonb := '[]'::jsonb;
  v_races    uuid[] := '{}'::uuid[];
  v_kinds    text[] := '{}'::text[];
  v_max_occ  timestamptz;
  v_race_key uuid;
begin
  if p_schema_version <> 1 then
    raise exception 'unsupported schema version %', p_schema_version using errcode = '22023';
  end if;
  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'events must be an array' using errcode = '22023';
  end if;
  if not exists (select 1 from installations where id = p_installation_id and meeting_id = p_meeting_id) then
    raise exception 'installation % is not registered for this meeting', p_installation_id using errcode = '22023';
  end if;

  for ev in select * from jsonb_array_elements(p_events) loop
    v_id := (ev->>'event_id')::bigint;
    if v_id is null then
      raise exception 'every event needs an event_id' using errcode = '22023';
    end if;
    if exists (select 1 from sync_events where installation_id = p_installation_id and event_id = v_id) then
      v_dups := v_dups + 1;
      v_up_to := v_id;
      continue;
    end if;
    begin
      perform sync_apply_one(p_meeting_id, ev);
      insert into sync_events (installation_id, event_id, meeting_id, schema_version, entity_type, operation, key, payload, status, occurred_at)
      values (p_installation_id, v_id, p_meeting_id, p_schema_version, ev->>'entity_type',
              (ev->>'operation')::sync_operation, coalesce(ev->'key', '{}'::jsonb), ev->'data', 'applied',
              coalesce((ev->>'occurred_at')::timestamptz, now()));
      v_applied := v_applied + 1;
      v_max_occ := greatest(coalesce(v_max_occ, (ev->>'occurred_at')::timestamptz), (ev->>'occurred_at')::timestamptz);
      v_race_key := (ev->'key'->>'race_id')::uuid;
      if v_race_key is not null then
        v_races := array_append(v_races, v_race_key);
      end if;
      v_kinds := array_append(v_kinds, ev->>'entity_type');
    exception when others then
      -- Only this event is rolled back; it is logged as rejected with the reason
      insert into sync_events (installation_id, event_id, meeting_id, schema_version, entity_type, operation, key, payload, status, error, occurred_at)
      values (p_installation_id, v_id, p_meeting_id, p_schema_version, coalesce(ev->>'entity_type', '?'),
              coalesce((ev->>'operation')::sync_operation, 'upsert'), coalesce(ev->'key', '{}'::jsonb), ev->'data',
              'rejected', sqlerrm, coalesce((ev->>'occurred_at')::timestamptz, now()));
      v_rejected := v_rejected || jsonb_build_object('event_id', v_id, 'code', sqlstate, 'reason', sqlerrm);
    end;
    v_up_to := v_id;
  end loop;

  update installations
  set last_event_id = greatest(last_event_id, coalesce(v_up_to, 0)), last_seen_at = now()
  where id = p_installation_id;
  update meetings
  set last_occurred_at = greatest(coalesce(last_occurred_at, v_max_occ), v_max_occ), last_received_at = now()
  where id = p_meeting_id;
  if v_applied > 0 then
    perform sync_broadcast(p_meeting_id,
      (select array_agg(distinct r) from unnest(v_races) r),
      (select array_agg(distinct k) from unnest(v_kinds) k));
  end if;

  return jsonb_build_object(
    'accepted_up_to_event_id', v_up_to,
    'applied', v_applied,
    'duplicates', v_dups,
    'rejected', v_rejected,
    'server_time', now());
end $$;
