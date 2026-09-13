-- Foundation: seasons, meetings on the championship ladder, organiser roles,
-- per-meeting API keys and the app installations that push events.
--
-- Base tables are never readable by the public: row level security is on
-- everywhere and anon/authenticated hold no table grants. The public site
-- reads the public_* views (a later migration) and organisers get policies
-- with the admin area. Reference data (seasons, race factors) is the one
-- exception, granted read-only below.

create extension if not exists pgcrypto with schema extensions;

create type meeting_level as enum ('corps', 'qualifying', 'army', 'other');
create type race_status as enum ('scheduled', 'live', 'provisional', 'official', 'cancelled');
create type race_type as enum ('SL', 'GS', 'SG', 'DH', 'AC');
create type standings_kind as enum ('individual', 'team', 'princess_marina');
create type admin_role as enum ('chairman', 'alpine_secretary', 'organiser');

create table seasons (
  id        text primary key check (id ~ '^\d{4}-\d{2}$'),
  starts_on date not null,
  ends_on   date not null,
  check (ends_on > starts_on)
);
comment on table seasons is 'AWSA season, 1 July to 30 June, labelled by its two years (2025-26).';

create table meetings (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name                      text not null,
  description               text,
  level                     meeting_level not null,
  season_id                 text not null references seasons(id),
  starts_on                 date,
  ends_on                   date,
  venue                     text,
  timezone                  text not null default 'Europe/Zurich',
  organiser_name            text,
  organiser_email           text,
  feeds_meeting_id          uuid references meetings(id),
  qualifies_for_aasl        boolean not null default false,
  championship_races_planned int,
  is_published              boolean not null default false,
  published_at              timestamptz,
  app_competition_id        uuid,
  last_occurred_at          timestamptz,
  last_received_at          timestamptz,
  created_by                uuid references auth.users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
comment on column meetings.feeds_meeting_id is 'The meeting this one qualifies into: corps -> qualifying -> army.';
comment on column meetings.qualifies_for_aasl is 'Chairman Alpine marks a corps meeting whose points may enter the AASL (Rule B12.d).';
comment on column meetings.is_published is 'Master switch for the public site; admin-only, never settable through an API key.';
comment on column meetings.app_competition_id is 'The desktop app competition bound to this meeting, learned from its first ping.';
comment on column meetings.last_occurred_at is 'Newest applied event as timed by the app; the freshness the public site shows.';
create index meetings_season_level_idx on meetings (season_id, level);
create index meetings_feeds_idx on meetings (feeds_meeting_id);

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger meetings_set_updated_at before update on meetings
  for each row execute function set_updated_at();

create table admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       admin_role not null,
  created_at timestamptz not null default now()
);
comment on table admin_users is 'Who may use the organiser area; chairman sees every meeting.';

create table meeting_admins (
  meeting_id uuid references meetings(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  primary key (meeting_id, user_id)
);

-- Role helpers for policies. security definer so they can read admin_users
-- regardless of the caller's own grants.
create function has_role(p_roles admin_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users where user_id = auth.uid() and role = any (p_roles)
  )
$$;
create function is_chairman() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(array['chairman']::admin_role[])
$$;
create function is_meeting_admin(p_meeting uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_chairman() or exists (
    select 1 from meeting_admins where meeting_id = p_meeting and user_id = auth.uid()
  )
$$;
revoke execute on function has_role(admin_role[]), is_chairman(), is_meeting_admin(uuid) from public, anon;
grant execute on function has_role(admin_role[]), is_chairman(), is_meeting_admin(uuid) to authenticated, service_role;

create table meeting_api_keys (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  key_hash     bytea not null unique,
  key_prefix   text not null,
  label        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
comment on column meeting_api_keys.key_hash is 'sha256 of the plaintext key; the plaintext is shown once and never stored.';
create index meeting_api_keys_meeting_idx on meeting_api_keys (meeting_id);

create table api_key_usage (
  key_id       uuid references meeting_api_keys(id) on delete cascade,
  window_start timestamptz not null,
  requests     int not null default 0,
  primary key (key_id, window_start)
);
comment on table api_key_usage is 'Fixed one-minute windows for rate limiting the ingest function.';

create table installations (
  id             uuid primary key,
  meeting_id     uuid not null references meetings(id) on delete cascade,
  api_key_id     uuid references meeting_api_keys(id),
  app_version    text,
  schema_version int,
  hostname       text,
  last_seen_at   timestamptz,
  last_event_id  bigint not null default 0,
  outbox_pending int,
  created_at     timestamptz not null default now()
);
comment on table installations is 'One row per desktop app installation pushing to a meeting; ids are generated by the app.';
create index installations_meeting_idx on installations (meeting_id);

-- Lock down every table: RLS on, no grants for the public roles, and no
-- default grants for tables created by later migrations either.
alter table seasons          enable row level security;
alter table meetings         enable row level security;
alter table admin_users      enable row level security;
alter table meeting_admins   enable row level security;
alter table meeting_api_keys enable row level security;
alter table api_key_usage    enable row level security;
alter table installations    enable row level security;

revoke all on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- Reference data anyone may read
grant select on seasons to anon, authenticated;
create policy seasons_public_read on seasons for select to anon, authenticated using (true);
