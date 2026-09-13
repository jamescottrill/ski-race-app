-- Ingest: the sync contract v1 applied to the private mirror.
--
-- The desktop app posts batches of entity events (see packages/sync-contract).
-- apply_sync_events() applies a batch inside one transaction with a savepoint
-- per event, so one bad event is rejected on its own while the rest of the
-- batch lands, and records every event in sync_events so a replayed batch is
-- a no-op. Race status is derived from run locks and results by triggers;
-- only "official" and "cancelled" are ever set explicitly.

create type sync_operation as enum ('upsert', 'delete');
create type sync_event_status as enum ('applied', 'rejected');

create table sync_events (
  id              bigserial primary key,
  installation_id uuid not null references installations(id),
  event_id        bigint not null,
  meeting_id      uuid not null references meetings(id),
  schema_version  int not null,
  entity_type     text not null,
  operation       sync_operation not null,
  key             jsonb not null,
  payload         jsonb,
  status          sync_event_status not null,
  error           text,
  occurred_at     timestamptz not null,
  received_at     timestamptz not null default now(),
  unique (installation_id, event_id)
);
comment on table sync_events is 'Ingest log; the unique (installation, event) pair is the idempotency key. Payloads hold private data and are purged after 180 days.';
create index sync_events_meeting_recv_idx on sync_events (meeting_id, received_at desc);
create index sync_events_rejected_idx on sync_events (meeting_id, received_at desc) where status = 'rejected';
alter table sync_events enable row level security;

-- ---------------------------------------------------------------------------
-- API keys: authenticate the caller and count the request in a one-minute
-- window. Returns no row for an unknown or revoked key.
-- ---------------------------------------------------------------------------
create function touch_api_key(p_key_hash bytea, p_limit int default 120)
returns table (key_id uuid, meeting_id uuid, allowed boolean, retry_after_seconds int)
language plpgsql security definer set search_path = public as $$
declare
  k          meeting_api_keys%rowtype;
  v_requests int;
  v_window   timestamptz := date_trunc('minute', now());
begin
  select * into k from meeting_api_keys where key_hash = p_key_hash and revoked_at is null;
  if not found then
    return;
  end if;
  insert into api_key_usage (key_id, window_start, requests)
  values (k.id, v_window, 1)
  -- named constraint: the output column key_id would shadow the table column
  on conflict on constraint api_key_usage_pkey do update set requests = api_key_usage.requests + 1
  returning api_key_usage.requests into v_requests;
  update meeting_api_keys set last_used_at = now() where id = k.id;
  return query select
    k.id,
    k.meeting_id,
    v_requests <= p_limit,
    case when v_requests <= p_limit then 0
         else greatest(1, extract(epoch from v_window + interval '1 minute' - now())::int) end;
end $$;

-- ---------------------------------------------------------------------------
-- Race status, derived from the run locks and the results
-- ---------------------------------------------------------------------------
create function recompute_race_status(p_race uuid, p_actor text default 'app')
returns void language plpgsql set search_path = public as $$
declare
  r             races%rowtype;
  v_runs_locked boolean;
  v_has_results boolean;
  v_new         race_status;
begin
  select * into r from races where id = p_race for update;
  if not found or r.status = 'cancelled' then
    return;
  end if;
  -- Every run the race needs exists and is locked
  select count(*) = r.number_runs into v_runs_locked
  from race_runs where race_id = p_race and run_number <= r.number_runs and is_complete;
  select exists (
    select 1 from results
    where race_id = p_race and (race_time is not null or is_dns or is_dnf or is_dsq or is_ns)
  ) into v_has_results;

  v_new := case
    when v_runs_locked then (case when r.status = 'official' then 'official' else 'provisional' end)::race_status
    when v_has_results then 'live'::race_status
    else 'scheduled'::race_status
  end;
  if v_new = r.status then
    return;
  end if;

  insert into race_status_history (race_id, from_status, to_status, actor)
  values (p_race, r.status, v_new, p_actor);
  update races set
    status = v_new,
    -- Time of posting (Annex D 12.c): first entry into provisional
    results_posted_at = case when v_new = 'provisional' then coalesce(results_posted_at, now())
                             when v_new in ('live', 'scheduled') then null
                             else results_posted_at end,
    official_at = case when v_new in ('live', 'scheduled') then null else official_at end,
    official_by = case when v_new in ('live', 'scheduled') then null else official_by end
  where id = p_race;
end $$;

-- Explicit transitions: official (from provisional), cancelled (from anything),
-- or provisional to revert an official or cancelled race to the derived state.
create function set_race_status(p_race uuid, p_status race_status, p_actor text, p_at timestamptz default now())
returns void language plpgsql set search_path = public as $$
declare
  r races%rowtype;
begin
  select * into r from races where id = p_race for update;
  if not found then
    raise exception 'race % not found', p_race;
  end if;
  if p_status = 'official' then
    if r.status <> 'provisional' then
      raise exception 'race % is % and cannot be made official until every run is locked', p_race, r.status;
    end if;
    insert into race_status_history (race_id, from_status, to_status, actor) values (p_race, r.status, 'official', p_actor);
    update races set status = 'official', official_at = p_at, official_by = p_actor where id = p_race;
  elsif p_status = 'cancelled' then
    if r.status <> 'cancelled' then
      insert into race_status_history (race_id, from_status, to_status, actor) values (p_race, r.status, 'cancelled', p_actor);
      update races set status = 'cancelled' where id = p_race;
    end if;
  elsif p_status = 'provisional' then
    if r.status in ('official', 'cancelled') then
      insert into race_status_history (race_id, from_status, to_status, actor) values (p_race, r.status, 'provisional', p_actor);
      update races set status = 'provisional', official_at = null, official_by = null where id = p_race;
      perform recompute_race_status(p_race, p_actor);
    end if;
  else
    raise exception 'status % is derived, not set', p_status;
  end if;
end $$;

create function race_status_trigger() returns trigger
language plpgsql set search_path = public as $$
begin
  perform recompute_race_status(coalesce(new.race_id, old.race_id));
  return null;
end $$;
create trigger race_runs_status after insert or update or delete on race_runs
  for each row execute function race_status_trigger();
create trigger results_status after insert or update or delete on results
  for each row execute function race_status_trigger();

-- ---------------------------------------------------------------------------
-- Appliers, one per entity type. Keys and data follow the contract; a
-- service number is resolved to the meeting entry inside the meeting.
-- ---------------------------------------------------------------------------
create function sync_entry_id(p_meeting uuid, p_service_number text)
returns uuid language sql stable set search_path = public as $$
  select e.id
  from meeting_entries e
  join competitors c on c.id = e.competitor_id
  where e.meeting_id = p_meeting and c.service_number = p_service_number
$$;

create function sync_require_entry(p_meeting uuid, p_service_number text)
returns uuid language plpgsql stable set search_path = public as $$
declare v_entry uuid;
begin
  v_entry := sync_entry_id(p_meeting, p_service_number);
  if v_entry is null then
    raise exception 'no entry for service number % in this meeting', p_service_number;
  end if;
  return v_entry;
end $$;

create function sync_require_race(p_meeting uuid, p_race uuid)
returns void language plpgsql stable set search_path = public as $$
begin
  if not exists (select 1 from races where id = p_race and meeting_id = p_meeting) then
    raise exception 'race % is not in this meeting', p_race;
  end if;
end $$;

create function sync_uuid_array(p jsonb) returns uuid[]
language sql immutable as $$
  select coalesce(array(select (x)::uuid from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) x), '{}'::uuid[])
$$;

create function sync_apply_meeting(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
begin
  if p_op = 'delete' then
    raise exception 'a meeting cannot be deleted through sync';
  end if;
  update meetings set
    name = coalesce(p_data->>'name', name),
    description = p_data->>'description',
    venue = p_data->>'venue',
    starts_on = (p_data->>'starts_on')::date,
    ends_on = (p_data->>'ends_on')::date,
    last_occurred_at = greatest(coalesce(last_occurred_at, p_occurred), p_occurred)
  where id = p_meeting;
end $$;

create function sync_apply_competitor(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
begin
  if p_op = 'delete' then
    raise exception 'a competitor cannot be deleted through sync';
  end if;
  insert into competitors (service_number, first_name, last_name, title, birth_year, gender, country)
  values (p_key->>'service_number', p_data->>'first_name', p_data->>'last_name', p_data->>'title',
          (p_data->>'birth_year')::int, p_data->>'gender', p_data->>'country')
  on conflict (service_number) do update set
    first_name = excluded.first_name, last_name = excluded.last_name, title = excluded.title,
    birth_year = excluded.birth_year, gender = excluded.gender, country = excluded.country;
end $$;

-- Two people were one: re-point the source's entry in this meeting to the
-- target, folding children into the target's entry when both are entered.
create function sync_apply_competitor_merge(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare
  v_source_competitor uuid;
  v_target_competitor uuid;
  v_source_entry uuid;
  v_target_entry uuid;
begin
  select id into v_source_competitor from competitors where service_number = p_key->>'source_service_number';
  select id into v_target_competitor from competitors where service_number = p_key->>'target_service_number';
  if v_source_competitor is null then
    return; -- nothing of the source ever reached the service
  end if;
  if v_target_competitor is null then
    raise exception 'merge target % is unknown', p_key->>'target_service_number';
  end if;
  v_source_entry := sync_entry_id(p_meeting, p_key->>'source_service_number');
  v_target_entry := sync_entry_id(p_meeting, p_key->>'target_service_number');
  if v_source_entry is not null and v_target_entry is null then
    update meeting_entries set competitor_id = v_target_competitor where id = v_source_entry;
  elsif v_source_entry is not null and v_target_entry is not null then
    delete from team_members s where s.entry_id = v_source_entry
      and exists (select 1 from team_members t where t.entry_id = v_target_entry and t.team_id = s.team_id and t.race_id is not distinct from s.race_id);
    update team_members set entry_id = v_target_entry where entry_id = v_source_entry;
    delete from start_list_entries s where s.entry_id = v_source_entry
      and exists (select 1 from start_list_entries t where t.entry_id = v_target_entry and t.race_id = s.race_id);
    update start_list_entries set entry_id = v_target_entry where entry_id = v_source_entry;
    delete from results s where s.entry_id = v_source_entry
      and exists (select 1 from results t where t.entry_id = v_target_entry and t.race_id = s.race_id and t.run_number = s.run_number);
    update results set entry_id = v_target_entry where entry_id = v_source_entry;
    delete from race_scores s where s.entry_id = v_source_entry
      and exists (select 1 from race_scores t where t.entry_id = v_target_entry and t.race_id = s.race_id);
    update race_scores set entry_id = v_target_entry where entry_id = v_source_entry;
    delete from seed_list_snapshot_rows where entry_id = v_source_entry;
    delete from standings_snapshot_rows where entry_id = v_source_entry;
    delete from final_seed_list_rows where entry_id = v_source_entry;
    delete from meeting_entries where id = v_source_entry;
  end if;
  update competitors set merged_into_id = v_target_competitor where id = v_source_competitor;
end $$;

create function sync_apply_meeting_entry(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare v_competitor uuid;
begin
  select id into v_competitor from competitors where service_number = p_key->>'service_number';
  if v_competitor is null then
    raise exception 'competitor % is unknown; its competitor event must arrive first', p_key->>'service_number';
  end if;
  if p_op = 'delete' then
    delete from meeting_entries where meeting_id = p_meeting and competitor_id = v_competitor;
    return;
  end if;
  insert into meeting_entries (meeting_id, competitor_id, title, regiment, arrival_army_seed, arrival_corps_seed,
    is_novice, is_junior, is_senior, is_veteran, is_reserve, is_female, is_hc, training_group,
    do_not_publish, army_opt_out, app_updated_at, synced_at)
  values (p_meeting, v_competitor, p_data->>'title', p_data->>'regiment',
    (p_data->>'arrival_army_seed')::numeric, (p_data->>'arrival_corps_seed')::numeric,
    coalesce((p_data->>'is_novice')::boolean, false), coalesce((p_data->>'is_junior')::boolean, false),
    coalesce((p_data->>'is_senior')::boolean, false), coalesce((p_data->>'is_veteran')::boolean, false),
    coalesce((p_data->>'is_reserve')::boolean, false), coalesce((p_data->>'is_female')::boolean, false),
    coalesce((p_data->>'is_hc')::boolean, false), (p_data->>'training_group')::int,
    coalesce((p_data->>'do_not_publish')::boolean, false), coalesce((p_data->>'army_opt_out')::boolean, false),
    p_occurred, now())
  on conflict (meeting_id, competitor_id) do update set
    title = excluded.title, regiment = excluded.regiment,
    arrival_army_seed = excluded.arrival_army_seed, arrival_corps_seed = excluded.arrival_corps_seed,
    is_novice = excluded.is_novice, is_junior = excluded.is_junior, is_senior = excluded.is_senior,
    is_veteran = excluded.is_veteran, is_reserve = excluded.is_reserve, is_female = excluded.is_female,
    is_hc = excluded.is_hc, training_group = excluded.training_group,
    do_not_publish = excluded.do_not_publish, army_opt_out = excluded.army_opt_out,
    opt_out_recorded_at = case when excluded.army_opt_out and not meeting_entries.army_opt_out then p_occurred
                               when not excluded.army_opt_out then null
                               else meeting_entries.opt_out_recorded_at end,
    app_updated_at = excluded.app_updated_at, synced_at = now();
end $$;

create function sync_apply_team(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare v_team uuid := (p_key->>'team_id')::uuid;
begin
  if p_op = 'delete' then
    delete from teams where id = v_team and meeting_id = p_meeting;
    return;
  end if;
  insert into teams (id, meeting_id, name, team_type, is_corps, is_reserve, is_female, is_hc, app_updated_at, synced_at)
  values (v_team, p_meeting, p_data->>'name', p_data->>'team_type',
    coalesce((p_data->>'is_corps')::boolean, false), coalesce((p_data->>'is_reserve')::boolean, false),
    coalesce((p_data->>'is_female')::boolean, false), coalesce((p_data->>'is_hc')::boolean, false),
    p_occurred, now())
  on conflict (id) do update set
    name = excluded.name, team_type = excluded.team_type, is_corps = excluded.is_corps,
    is_reserve = excluded.is_reserve, is_female = excluded.is_female, is_hc = excluded.is_hc,
    app_updated_at = excluded.app_updated_at, synced_at = now()
  where teams.meeting_id = p_meeting;
end $$;

create function sync_apply_team_members(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare
  v_team uuid := (p_key->>'team_id')::uuid;
  v_race uuid := (p_key->>'race_id')::uuid;
begin
  if not exists (select 1 from teams where id = v_team and meeting_id = p_meeting) then
    raise exception 'team % is not in this meeting', v_team;
  end if;
  if v_race is not null then
    perform sync_require_race(p_meeting, v_race);
  end if;
  delete from team_members where team_id = v_team and race_id is not distinct from v_race;
  if p_op = 'delete' then
    return;
  end if;
  insert into team_members (team_id, race_id, entry_id, synced_at)
  select v_team, v_race, sync_require_entry(p_meeting, sn), now()
  from jsonb_array_elements_text(coalesce(p_data->'service_numbers', '[]'::jsonb)) sn;
end $$;

create function sync_apply_race(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
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
    if r.status <> v_status then
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

create function sync_apply_race_run(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare
  v_race uuid := (p_key->>'race_id')::uuid;
  v_run  int  := (p_key->>'run_number')::int;
begin
  perform sync_require_race(p_meeting, v_race);
  if p_op = 'delete' then
    delete from race_runs where race_id = v_race and run_number = v_run;
    return;
  end if;
  insert into race_runs (race_id, run_number, course_setter, number_gates, turning_gates, start_time, forerunners, is_complete, app_updated_at, synced_at)
  values (v_race, v_run, p_data->>'course_setter', (p_data->>'number_gates')::int, (p_data->>'turning_gates')::int,
    p_data->>'start_time',
    coalesce(array(select x from jsonb_array_elements_text(coalesce(p_data->'forerunners', '[]'::jsonb)) x), '{}'::text[]),
    coalesce((p_data->>'is_complete')::boolean, false), p_occurred, now())
  on conflict (race_id, run_number) do update set
    course_setter = excluded.course_setter, number_gates = excluded.number_gates, turning_gates = excluded.turning_gates,
    start_time = excluded.start_time, forerunners = excluded.forerunners, is_complete = excluded.is_complete,
    app_updated_at = excluded.app_updated_at, synced_at = now();
end $$;

create function sync_apply_start_list(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare v_race uuid := (p_key->>'race_id')::uuid;
begin
  perform sync_require_race(p_meeting, v_race);
  delete from start_list_entries where race_id = v_race;
  if p_op = 'delete' then
    return;
  end if;
  insert into start_list_entries (race_id, entry_id, bib_number, seed_points, app_updated_at, synced_at)
  select v_race, sync_require_entry(p_meeting, e->>'service_number'), (e->>'bib_number')::int,
         (e->>'seed_points')::numeric, p_occurred, now()
  from jsonb_array_elements(coalesce(p_data->'entries', '[]'::jsonb)) e;
end $$;

create function sync_apply_result(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare
  v_race  uuid := (p_key->>'race_id')::uuid;
  v_run   int  := (p_key->>'run_number')::int;
  v_entry uuid;
begin
  perform sync_require_race(p_meeting, v_race);
  v_entry := sync_require_entry(p_meeting, p_key->>'service_number');
  if p_op = 'delete' then
    delete from results where race_id = v_race and run_number = v_run and entry_id = v_entry;
    return;
  end if;
  -- Mirrors the app: importing into a run creates it
  insert into race_runs (race_id, run_number) values (v_race, v_run) on conflict do nothing;
  insert into results (race_id, run_number, entry_id, race_time, is_dns, is_dnf, is_dsq, is_ns, dsq_gate, dsq_reason, app_updated_at, synced_at)
  values (v_race, v_run, v_entry, (p_data->>'race_time')::numeric,
    coalesce((p_data->>'is_dns')::boolean, false), coalesce((p_data->>'is_dnf')::boolean, false),
    coalesce((p_data->>'is_dsq')::boolean, false), coalesce((p_data->>'is_ns')::boolean, false),
    (p_data->>'dsq_gate')::int, p_data->>'dsq_reason', p_occurred, now())
  on conflict (race_id, run_number, entry_id) do update set
    race_time = excluded.race_time, is_dns = excluded.is_dns, is_dnf = excluded.is_dnf, is_dsq = excluded.is_dsq,
    is_ns = excluded.is_ns, dsq_gate = excluded.dsq_gate, dsq_reason = excluded.dsq_reason,
    app_updated_at = excluded.app_updated_at, synced_at = now();
end $$;

create function sync_apply_race_scores(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare v_race uuid := (p_key->>'race_id')::uuid;
begin
  perform sync_require_race(p_meeting, v_race);
  delete from race_scores where race_id = v_race;
  if p_op = 'delete' then
    return;
  end if;
  insert into race_scores (race_id, entry_id, position, race_points, run_1_time, run_2_time, total_time, points_run_1, points_run_2, computed_at, synced_at)
  select v_race, sync_require_entry(p_meeting, r->>'service_number'), (r->>'position')::int, (r->>'race_points')::numeric,
         (r->>'run_1_time')::numeric, (r->>'run_2_time')::numeric, (r->>'total_time')::numeric,
         (r->>'points_run_1')::numeric, (r->>'points_run_2')::numeric,
         coalesce((p_data->>'computed_at')::timestamptz, p_occurred), now()
  from jsonb_array_elements(coalesce(p_data->'rows', '[]'::jsonb)) r;
end $$;

create function sync_apply_seed_list_snapshot(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare
  v_after int := (p_key->>'after_race_count')::int;
  v_snapshot uuid;
begin
  if p_op = 'delete' then
    delete from seed_list_snapshots where meeting_id = p_meeting and after_race_count = v_after;
    return;
  end if;
  insert into seed_list_snapshots (meeting_id, after_race_count, label, race_ids, computed_at, synced_at)
  values (p_meeting, v_after, p_data->>'label', sync_uuid_array(p_data->'race_ids'),
          coalesce((p_data->>'computed_at')::timestamptz, p_occurred), now())
  on conflict (meeting_id, after_race_count) do update set
    label = excluded.label, race_ids = excluded.race_ids, computed_at = excluded.computed_at, synced_at = now()
  returning id into v_snapshot;
  delete from seed_list_snapshot_rows where snapshot_id = v_snapshot;
  insert into seed_list_snapshot_rows (snapshot_id, entry_id, position, seed_points, initial_points, aasl_points,
    race_points, penalty_race_ids, championship_races_completed, awarded_points_count)
  select v_snapshot, sync_require_entry(p_meeting, r->>'service_number'), (r->>'position')::int,
         (r->>'seed_points')::numeric, (r->>'initial_points')::numeric, (r->>'aasl_points')::numeric,
         coalesce(r->'race_points', '{}'::jsonb), sync_uuid_array(r->'penalty_race_ids'),
         -- real finishes: races with points minus those awarded under B13
         (select count(*) from jsonb_each(coalesce(r->'race_points', '{}'::jsonb)) kv where kv.value <> 'null'::jsonb)
           - jsonb_array_length(coalesce(r->'penalty_race_ids', '[]'::jsonb)),
         jsonb_array_length(coalesce(r->'penalty_race_ids', '[]'::jsonb))
  from jsonb_array_elements(coalesce(p_data->'rows', '[]'::jsonb)) r;
end $$;

create function sync_apply_standings_snapshot(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
declare
  v_kind standings_kind := (p_key->>'kind')::standings_kind;
  v_snapshot uuid;
begin
  if p_op = 'delete' then
    delete from standings_snapshots where meeting_id = p_meeting and kind = v_kind;
    return;
  end if;
  insert into standings_snapshots (meeting_id, kind, race_ids, computed_at, synced_at)
  values (p_meeting, v_kind, sync_uuid_array(p_data->'race_ids'), coalesce((p_data->>'computed_at')::timestamptz, p_occurred), now())
  on conflict (meeting_id, kind) do update set
    race_ids = excluded.race_ids, computed_at = excluded.computed_at, synced_at = now()
  returning id into v_snapshot;
  delete from standings_snapshot_rows where snapshot_id = v_snapshot;
  insert into standings_snapshot_rows (snapshot_id, entry_id, team_id, position, total_points, race_points)
  select v_snapshot,
         case when r ? 'service_number' then sync_require_entry(p_meeting, r->>'service_number') end,
         (r->>'team_id')::uuid, (r->>'position')::int, (r->>'total_points')::numeric, coalesce(r->'race_points', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_data->'rows', '[]'::jsonb)) r;
end $$;

create function sync_apply_cpp(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
begin
  if p_op = 'delete' then
    delete from meeting_cpp where meeting_id = p_meeting;
    return;
  end if;
  insert into meeting_cpp (meeting_id, cpp_value, t1, t2, t3, divisor, skiers_used, calculated_at, synced_at)
  values (p_meeting, (p_data->>'cpp_value')::numeric, (p_data->>'t1')::numeric, (p_data->>'t2')::numeric,
          (p_data->>'t3')::numeric, (p_data->>'divisor')::int, (p_data->>'skiers_used')::int,
          coalesce((p_data->>'calculated_at')::timestamptz, p_occurred), now())
  on conflict (meeting_id) do update set
    cpp_value = excluded.cpp_value, t1 = excluded.t1, t2 = excluded.t2, t3 = excluded.t3,
    divisor = excluded.divisor, skiers_used = excluded.skiers_used, calculated_at = excluded.calculated_at, synced_at = now();
end $$;

create function sync_apply_final_seed_list(p_meeting uuid, p_op sync_operation, p_key jsonb, p_data jsonb, p_occurred timestamptz)
returns void language plpgsql set search_path = public as $$
begin
  if p_op = 'delete' then
    delete from final_seed_lists where meeting_id = p_meeting;
    return;
  end if;
  insert into final_seed_lists (meeting_id, finalised_at, cpp_value, synced_at)
  values (p_meeting, coalesce((p_data->>'finalised_at')::timestamptz, p_occurred), (p_data->>'cpp_value')::numeric, now())
  on conflict (meeting_id) do update set
    finalised_at = excluded.finalised_at, cpp_value = excluded.cpp_value, synced_at = now();
  delete from final_seed_list_rows where meeting_id = p_meeting;
  insert into final_seed_list_rows (meeting_id, entry_id, competitor_id, position, raw_seed_points, cpp_applied, final_seed_points, aasl_points)
  select p_meeting, e.id, e.competitor_id, (r->>'position')::int, (r->>'raw_seed_points')::numeric,
         (r->>'cpp_applied')::numeric, (r->>'final_seed_points')::numeric, (r->>'aasl_points')::numeric
  from jsonb_array_elements(coalesce(p_data->'rows', '[]'::jsonb)) r
  join meeting_entries e on e.id = sync_require_entry(p_meeting, r->>'service_number');
end $$;

create function sync_apply_one(p_meeting uuid, p_event jsonb)
returns void language plpgsql set search_path = public as $$
declare
  v_type     text := p_event->>'entity_type';
  v_op       sync_operation := (p_event->>'operation')::sync_operation;
  v_key      jsonb := coalesce(p_event->'key', '{}'::jsonb);
  v_data     jsonb := p_event->'data';
  v_occurred timestamptz := (p_event->>'occurred_at')::timestamptz;
begin
  if v_op = 'upsert' and (v_data is null or jsonb_typeof(v_data) <> 'object') then
    raise exception 'an upsert needs a data object';
  end if;
  case v_type
    when 'meeting'            then perform sync_apply_meeting(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'competitor'         then perform sync_apply_competitor(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'competitor_merge'   then perform sync_apply_competitor_merge(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'meeting_entry'      then perform sync_apply_meeting_entry(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'team'               then perform sync_apply_team(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'team_members'       then perform sync_apply_team_members(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'race'               then perform sync_apply_race(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'race_run'           then perform sync_apply_race_run(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'start_list'         then perform sync_apply_start_list(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'result'             then perform sync_apply_result(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'race_scores'        then perform sync_apply_race_scores(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'seed_list_snapshot' then perform sync_apply_seed_list_snapshot(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'standings_snapshot' then perform sync_apply_standings_snapshot(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'cpp'                then perform sync_apply_cpp(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'final_seed_list'    then perform sync_apply_final_seed_list(p_meeting, v_op, v_key, v_data, v_occurred);
    when 'snapshot_marker'    then null; -- reserved: stale-row clean-up after a full snapshot
    else raise exception 'unknown entity type %', v_type;
  end case;
end $$;

-- Realtime: one broadcast per batch on the meeting's private topic, listing
-- the races and entity kinds it touched so the site knows what to refetch
create function sync_broadcast(p_meeting uuid, p_races uuid[], p_kinds text[])
returns void language plpgsql set search_path = public as $$
begin
  perform realtime.send(
    jsonb_build_object('meeting_id', p_meeting, 'race_ids', coalesce(p_races, '{}'::uuid[]),
                       'kinds', coalesce(p_kinds, '{}'::text[]), 'at', now()),
    'changed', 'meeting:' || p_meeting::text, true);
exception when others then
  -- A broadcast failure must never roll back an ingest
  raise warning 'sync_broadcast failed: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- The batch entry point used by the ingest function (service role only)
-- ---------------------------------------------------------------------------
create function apply_sync_events(p_installation_id uuid, p_meeting_id uuid, p_schema_version int, p_events jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev         jsonb;
  v_id       bigint;
  v_up_to    bigint;
  v_applied  int := 0;
  v_dups     int := 0;
  v_rejected jsonb := '[]'::jsonb;
  v_races    uuid[] := '{}';
  v_kinds    text[] := '{}';
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

-- Nothing here is for the public roles: the ingest function calls these
-- as the service role, and the admin area gets its own RPCs later
revoke execute on function
  touch_api_key(bytea, int), apply_sync_events(uuid, uuid, int, jsonb), sync_apply_one(uuid, jsonb),
  recompute_race_status(uuid, text), set_race_status(uuid, race_status, text, timestamptz),
  sync_broadcast(uuid, uuid[], text[]), sync_entry_id(uuid, text), sync_require_entry(uuid, text),
  sync_require_race(uuid, uuid), sync_uuid_array(jsonb),
  sync_apply_meeting(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_competitor(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_competitor_merge(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_meeting_entry(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_team(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_team_members(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_race(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_race_run(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_start_list(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_result(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_race_scores(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_seed_list_snapshot(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_standings_snapshot(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_cpp(uuid, sync_operation, jsonb, jsonb, timestamptz),
  sync_apply_final_seed_list(uuid, sync_operation, jsonb, jsonb, timestamptz)
from public, anon, authenticated;
grant execute on function touch_api_key(bytea, int), apply_sync_events(uuid, uuid, int, jsonb) to service_role;
