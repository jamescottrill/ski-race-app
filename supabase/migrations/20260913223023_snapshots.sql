-- Derived lists the app computes and pushes whole: seed lists after N
-- races, standings, CPP and the finalised seed list. Plus the AASL and the
-- organiser documents. These are what the qualification engine reads.

create table seed_list_snapshots (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid not null references meetings(id) on delete cascade,
  after_race_count int not null check (after_race_count >= 0),
  label            text,
  race_ids         uuid[] not null,
  is_final         boolean not null default false,
  computed_at      timestamptz not null,
  synced_at        timestamptz,
  unique (meeting_id, after_race_count)
);
comment on column seed_list_snapshots.is_final is 'The list after the last championship race, as marked by the secretary.';

create table seed_list_snapshot_rows (
  snapshot_id                  uuid references seed_list_snapshots(id) on delete cascade,
  entry_id                     uuid references meeting_entries(id) on delete cascade,
  position                     int not null,
  seed_points                  numeric(8,2),
  initial_points               numeric(8,2),
  aasl_points                  numeric(8,2),
  race_points                  jsonb not null default '{}',
  penalty_race_ids             uuid[] not null default '{}',
  championship_races_completed int,
  awarded_points_count         int not null default 0,
  primary key (snapshot_id, entry_id)
);
comment on column seed_list_snapshot_rows.penalty_race_ids is 'Races where points were awarded under Rule B13 rather than raced.';

create table standings_snapshots (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references meetings(id) on delete cascade,
  kind        standings_kind not null,
  race_ids    uuid[] not null,
  computed_at timestamptz not null,
  synced_at   timestamptz,
  unique (meeting_id, kind)
);

create table standings_snapshot_rows (
  snapshot_id  uuid references standings_snapshots(id) on delete cascade,
  entry_id     uuid references meeting_entries(id) on delete cascade,
  team_id      uuid references teams(id) on delete cascade,
  position     int not null,
  total_points numeric(8,2) not null,
  race_points  jsonb not null default '{}',
  check ((entry_id is null) <> (team_id is null)),
  unique nulls not distinct (snapshot_id, entry_id, team_id)
);

create table meeting_cpp (
  meeting_id    uuid primary key references meetings(id) on delete cascade,
  cpp_value     numeric(8,2) not null,
  t1            numeric(10,2),
  t2            numeric(10,2),
  t3            numeric(10,2),
  divisor       int,
  skiers_used   int,
  calculated_at timestamptz not null,
  synced_at     timestamptz
);
comment on table meeting_cpp is 'The secretary''s locally computed CPP; the engine keeps its own authorised figure.';

create table final_seed_lists (
  meeting_id   uuid primary key references meetings(id) on delete cascade,
  finalised_at timestamptz not null,
  cpp_value    numeric(8,2),
  synced_at    timestamptz
);

create table final_seed_list_rows (
  meeting_id                   uuid references final_seed_lists(meeting_id) on delete cascade,
  entry_id                     uuid references meeting_entries(id),
  competitor_id                uuid not null references competitors(id),
  position                     int,
  raw_seed_points              numeric(8,2),
  cpp_applied                  numeric(8,2),
  final_seed_points            numeric(8,2) not null,
  aasl_points                  numeric(8,2),
  championship_races_completed int,
  awarded_points_count         int not null default 0,
  primary key (meeting_id, entry_id)
);
comment on column final_seed_list_rows.competitor_id is 'Denormalised so the engine can join meetings by person without going through entries.';
create index final_seed_list_rows_competitor_idx on final_seed_list_rows (competitor_id);

create table aasl (
  season_id            text references seasons(id),
  competitor_id        uuid references competitors(id),
  seed_points          numeric(8,2) not null,
  category             text,
  source               text not null default 'imported' check (source in ('imported', 'aasl_round')),
  source_round_id      uuid,
  last_competed_season text,
  imported_at          timestamptz not null default now(),
  published_at         timestamptz,
  primary key (season_id, competitor_id)
);
comment on table aasl is 'Army Alpine Seed List, one row per competitor per season (Rules B19 to B21).';

create table documents (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  race_id      uuid references races(id) on delete cascade,
  kind         text not null check (kind in ('official_results', 'team_results', 'start_list', 'seed_list', 'dsq_notice', 'other')),
  title        text not null,
  storage_path text not null,
  content_type text,
  byte_size    int,
  sha256       text,
  uploaded_at  timestamptz not null default now()
);
comment on table documents is 'Organiser PDFs in the meeting-documents storage bucket.';
create index documents_meeting_idx on documents (meeting_id, race_id);

alter table seed_list_snapshots     enable row level security;
alter table seed_list_snapshot_rows enable row level security;
alter table standings_snapshots     enable row level security;
alter table standings_snapshot_rows enable row level security;
alter table meeting_cpp             enable row level security;
alter table final_seed_lists        enable row level security;
alter table final_seed_list_rows    enable row level security;
alter table aasl                    enable row level security;
alter table documents               enable row level security;
