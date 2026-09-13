-- Meeting data: the private mirror of what each desktop app installation
-- pushes. Identity is the army service number, held only on competitors.

create table race_factors (
  race_type race_type primary key,
  factor    int not null
);
comment on table race_factors is 'Discipline factors (Rule B15). Must equal RACE_FACTORS in packages/scoring; a test on each side guards it.';
insert into race_factors values ('SL', 730), ('GS', 1010), ('SG', 1190), ('DH', 1250), ('AC', 1360);

create table competitors (
  id             uuid primary key default gen_random_uuid(),
  service_number text not null unique,
  first_name     text,
  last_name      text,
  title          text,
  birth_year     int,
  gender         text check (gender in ('M', 'F')),
  country        text,
  merged_into_id uuid references competitors(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on column competitors.service_number is 'PRIVATE: never referenced by a public view.';
comment on column competitors.birth_year is 'PRIVATE: the class code derived from it is public, the year is not.';
create trigger competitors_set_updated_at before update on competitors
  for each row execute function set_updated_at();

create table meeting_entries (
  id                   uuid primary key default gen_random_uuid(),
  meeting_id           uuid not null references meetings(id) on delete cascade,
  competitor_id        uuid not null references competitors(id),
  title                text,
  regiment             text,
  arrival_army_seed    numeric(8,2),
  arrival_corps_seed   numeric(8,2),
  is_novice            boolean not null default false,
  is_junior            boolean not null default false,
  is_senior            boolean not null default false,
  is_veteran           boolean not null default false,
  is_reserve           boolean not null default false,
  is_female            boolean not null default false,
  is_hc                boolean not null default false,
  training_group       int,
  do_not_publish       boolean not null default false,
  army_opt_out         boolean not null default false,
  opt_out_recorded_at  timestamptz,
  -- Seeding on arrival at a qualifying meeting (Rules B3, B12.a), recorded
  -- by the registration desk with its provenance
  arrival_seed_points  numeric(8,2),
  arrival_seed_source  text check (arrival_seed_source in ('aasl', 'corps_list', 'older_penalised', 'training', 'manual')),
  arrival_seed_source_meeting_id uuid references meetings(id),
  arrival_seed_reason  text,
  app_updated_at       timestamptz,
  synced_at            timestamptz,
  unique (meeting_id, competitor_id)
);
comment on column meeting_entries.id is 'Random, so a public entry id cannot be turned back into a service number.';
comment on column meeting_entries.do_not_publish is 'Name and unit withheld on the public site; the row still ranks.';
comment on column meeting_entries.army_opt_out is 'Does not wish to be considered for Army qualification (Rule B17.a).';
create index meeting_entries_competitor_idx on meeting_entries (competitor_id);

create table teams (
  id             uuid primary key,
  meeting_id     uuid not null references meetings(id) on delete cascade,
  name           text not null,
  team_type      text,
  is_corps       boolean not null default false,
  is_reserve     boolean not null default false,
  is_female      boolean not null default false,
  is_hc          boolean not null default false,
  app_updated_at timestamptz,
  synced_at      timestamptz
);
comment on column teams.id is 'The desktop app team id (a uuid), so pushes are idempotent.';
create index teams_meeting_idx on teams (meeting_id);

create table races (
  id                   uuid primary key,
  meeting_id           uuid not null references meetings(id) on delete cascade,
  name                 text not null,
  race_date            date,
  race_type            race_type,
  is_individual        boolean not null default false,
  is_team              boolean not null default false,
  is_training          boolean not null default false,
  is_seeding           boolean not null default false,
  women_separate       boolean not null default false,
  number_runs          int not null default 1 check (number_runs between 1 and 2),
  venue                text,
  course_name          text,
  weather              text,
  snow                 text,
  temp_start           numeric,
  temp_finish          numeric,
  start_altitude       numeric,
  finish_altitude      numeric,
  homologation         text,
  flip_count           int,
  flip_count_women     int,
  officials            jsonb not null default '{}',
  sequence             int,
  -- Championship races count for points and qualification; seeding and
  -- training races do not (Definitions, "Championship Race")
  is_championship      boolean generated always as (not is_training and not is_seeding) stored,
  status               race_status not null default 'scheduled',
  results_posted_at    timestamptz,
  dsq_notice_posted_at timestamptz,
  official_at          timestamptz,
  official_by          text,
  app_updated_at       timestamptz,
  synced_at            timestamptz
);
comment on column races.officials is 'Display strings only: {tech_delegate, referee, asst_referee, chief_of_race}.';
comment on column races.results_posted_at is 'When the race first became provisional (Annex D 12.c, time of posting).';
comment on column races.dsq_notice_posted_at is 'Starts the 15 minute protest window (Rule 640).';
create index races_meeting_date_idx on races (meeting_id, race_date);

create table race_status_history (
  id          bigserial primary key,
  race_id     uuid references races(id) on delete cascade,
  from_status race_status,
  to_status   race_status not null,
  actor       text,
  at          timestamptz not null default now()
);

create table race_runs (
  race_id        uuid references races(id) on delete cascade,
  run_number     int check (run_number between 1 and 2),
  course_setter  text,
  number_gates   int,
  turning_gates  int,
  start_time     text,
  forerunners    text[] not null default '{}',
  is_complete    boolean not null default false,
  app_updated_at timestamptz,
  synced_at      timestamptz,
  primary key (race_id, run_number)
);
comment on column race_runs.is_complete is 'The app''s run lock; the race becomes provisional when every run is complete.';

create table team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references teams(id) on delete cascade,
  race_id   uuid references races(id) on delete cascade,
  entry_id  uuid not null references meeting_entries(id) on delete cascade,
  synced_at timestamptz,
  unique nulls not distinct (team_id, race_id, entry_id)
);
comment on column team_members.race_id is 'Null means nominated for the whole meeting rather than one race.';
create index team_members_race_entry_idx on team_members (race_id, entry_id);

create table start_list_entries (
  race_id        uuid references races(id) on delete cascade,
  entry_id       uuid references meeting_entries(id) on delete cascade,
  bib_number     int not null check (bib_number > 0),
  seed_points    numeric(8,2),
  app_updated_at timestamptz,
  synced_at      timestamptz,
  primary key (race_id, entry_id)
);
create index start_list_bib_idx on start_list_entries (race_id, bib_number);

create table results (
  race_id        uuid,
  run_number     int,
  entry_id       uuid references meeting_entries(id) on delete cascade,
  race_time      numeric(8,2),
  is_dns         boolean not null default false,
  is_dnf         boolean not null default false,
  is_dsq         boolean not null default false,
  is_ns          boolean not null default false,
  dsq_gate       int,
  dsq_reason     text,
  app_updated_at timestamptz,
  synced_at      timestamptz,
  primary key (race_id, run_number, entry_id),
  foreign key (race_id, run_number) references race_runs(race_id, run_number) on delete cascade
);
comment on column results.race_time is 'Seconds to two decimals; null for any non-finish.';
create index results_entry_idx on results (entry_id);

create table race_scores (
  race_id      uuid references races(id) on delete cascade,
  entry_id     uuid references meeting_entries(id) on delete cascade,
  position     int,
  race_points  numeric(8,2),
  run_1_time   numeric(8,2),
  run_2_time   numeric(8,2),
  total_time   numeric(8,2),
  points_run_1 numeric(8,2),
  points_run_2 numeric(8,2),
  computed_at  timestamptz not null,
  synced_at    timestamptz,
  primary key (race_id, entry_id)
);
comment on table race_scores is 'Positions and points as the app computed them when the final run was locked; preferred over the live SQL scoring once present.';

-- Everyone who has ever been on a team at a meeting, whatever the race:
-- the roster the qualification engine treats as the nominated four
create view meeting_team_rosters with (security_invoker = true) as
  select t.meeting_id, tm.team_id, tm.entry_id, c.service_number
  from team_members tm
  join teams t on t.id = tm.team_id
  join meeting_entries e on e.id = tm.entry_id
  join competitors c on c.id = e.competitor_id
  group by t.meeting_id, tm.team_id, tm.entry_id, c.service_number;

alter table race_factors        enable row level security;
alter table competitors         enable row level security;
alter table meeting_entries     enable row level security;
alter table teams               enable row level security;
alter table races               enable row level security;
alter table race_status_history enable row level security;
alter table race_runs           enable row level security;
alter table team_members        enable row level security;
alter table start_list_entries  enable row level security;
alter table results             enable row level security;
alter table race_scores         enable row level security;

grant select on race_factors to anon, authenticated;
create policy race_factors_public_read on race_factors for select to anon, authenticated using (true);
