-- Organiser access: signed-in meeting admins read their meetings' data,
-- chairmen read everything, and a handful of RPCs perform the writes the
-- admin area needs. The public roles still read only the public views.

-- Meetings and everything keyed by meeting_id
create policy meetings_admin_read on meetings for select to authenticated using (is_meeting_admin(id));
create policy meetings_admin_update on meetings for update to authenticated
  using (is_meeting_admin(id)) with check (is_meeting_admin(id));
grant select, update on meetings to authenticated;

create policy meeting_entries_admin_read on meeting_entries for select to authenticated using (is_meeting_admin(meeting_id));
create policy teams_admin_read on teams for select to authenticated using (is_meeting_admin(meeting_id));
create policy races_admin_read on races for select to authenticated using (is_meeting_admin(meeting_id));
create policy seed_list_snapshots_admin_read on seed_list_snapshots for select to authenticated using (is_meeting_admin(meeting_id));
create policy standings_snapshots_admin_read on standings_snapshots for select to authenticated using (is_meeting_admin(meeting_id));
create policy meeting_cpp_admin_read on meeting_cpp for select to authenticated using (is_meeting_admin(meeting_id));
create policy final_seed_lists_admin_read on final_seed_lists for select to authenticated using (is_meeting_admin(meeting_id));
create policy final_seed_list_rows_admin_read on final_seed_list_rows for select to authenticated using (is_meeting_admin(meeting_id));
create policy documents_admin_read on documents for select to authenticated using (is_meeting_admin(meeting_id));
create policy installations_admin_read on installations for select to authenticated using (is_meeting_admin(meeting_id));
create policy sync_events_admin_read on sync_events for select to authenticated using (is_meeting_admin(meeting_id));
create policy meeting_api_keys_admin_read on meeting_api_keys for select to authenticated using (is_meeting_admin(meeting_id));

-- Keyed through a parent row
create policy race_runs_admin_read on race_runs for select to authenticated
  using (exists (select 1 from races r where r.id = race_runs.race_id and is_meeting_admin(r.meeting_id)));
create policy results_admin_read on results for select to authenticated
  using (exists (select 1 from races r where r.id = results.race_id and is_meeting_admin(r.meeting_id)));
create policy race_scores_admin_read on race_scores for select to authenticated
  using (exists (select 1 from races r where r.id = race_scores.race_id and is_meeting_admin(r.meeting_id)));
create policy start_list_entries_admin_read on start_list_entries for select to authenticated
  using (exists (select 1 from races r where r.id = start_list_entries.race_id and is_meeting_admin(r.meeting_id)));
create policy race_status_history_admin_read on race_status_history for select to authenticated
  using (exists (select 1 from races r where r.id = race_status_history.race_id and is_meeting_admin(r.meeting_id)));
create policy team_members_admin_read on team_members for select to authenticated
  using (exists (select 1 from teams t where t.id = team_members.team_id and is_meeting_admin(t.meeting_id)));
create policy seed_list_snapshot_rows_admin_read on seed_list_snapshot_rows for select to authenticated
  using (exists (select 1 from seed_list_snapshots s where s.id = seed_list_snapshot_rows.snapshot_id and is_meeting_admin(s.meeting_id)));
create policy standings_snapshot_rows_admin_read on standings_snapshot_rows for select to authenticated
  using (exists (select 1 from standings_snapshots s where s.id = standings_snapshot_rows.snapshot_id and is_meeting_admin(s.meeting_id)));
create policy competitors_admin_read on competitors for select to authenticated
  using (is_chairman() or exists (select 1 from meeting_entries e where e.competitor_id = competitors.id and is_meeting_admin(e.meeting_id)));
create policy aasl_chairman_read on aasl for select to authenticated
  using (has_role(array['chairman', 'alpine_secretary']::admin_role[]));

grant select on meeting_entries, teams, races, race_runs, results, race_scores, start_list_entries,
  race_status_history, team_members, seed_list_snapshots, seed_list_snapshot_rows, standings_snapshots,
  standings_snapshot_rows, meeting_cpp, final_seed_lists, final_seed_list_rows, documents, installations,
  sync_events, competitors, aasl
to authenticated;
-- Never the hash
grant select (id, meeting_id, key_prefix, label, created_by, created_at, last_used_at, revoked_at)
  on meeting_api_keys to authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPCs (security definer; each checks the caller's role itself)
-- ---------------------------------------------------------------------------
create function admin_require(p_ok boolean, p_what text) returns void
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not coalesce(p_ok, false) then
    raise exception 'not allowed: %', p_what using errcode = '42501';
  end if;
end $$;

-- Seasons are created on demand with the AWSA dates (1 July to 30 June)
create function admin_ensure_season(p_season text) returns text
language plpgsql security definer set search_path = public as $$
declare v_start int;
begin
  perform admin_require(is_chairman(), 'create a season');
  if p_season !~ '^\d{4}-\d{2}$' then
    raise exception 'season must look like 2025-26';
  end if;
  v_start := left(p_season, 4)::int;
  insert into seasons (id, starts_on, ends_on)
  values (p_season, make_date(v_start, 7, 1), make_date(v_start + 1, 6, 30))
  on conflict (id) do nothing;
  return p_season;
end $$;

create function admin_create_meeting(
  p_slug text, p_name text, p_level meeting_level, p_season text,
  p_description text default null, p_starts_on date default null, p_ends_on date default null,
  p_venue text default null, p_timezone text default 'Europe/Zurich',
  p_organiser_name text default null, p_organiser_email text default null,
  p_feeds_meeting_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform admin_require(is_chairman(), 'create a meeting');
  perform admin_ensure_season(p_season);
  insert into meetings (slug, name, description, level, season_id, starts_on, ends_on, venue, timezone,
                        organiser_name, organiser_email, feeds_meeting_id, created_by)
  values (p_slug, p_name, p_description, p_level, p_season, p_starts_on, p_ends_on, p_venue, p_timezone,
          p_organiser_name, p_organiser_email, p_feeds_meeting_id, auth.uid())
  returning id into v_id;
  insert into meeting_admins (meeting_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end $$;

create function admin_set_meeting_published(p_meeting uuid, p_published boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_require(is_meeting_admin(p_meeting), 'publish this meeting');
  update meetings
  set is_published = p_published,
      published_at = case when p_published then coalesce(published_at, now()) else null end
  where id = p_meeting;
end $$;

-- The plaintext is returned exactly once; only its hash is kept
create function admin_issue_api_key(p_meeting uuid, p_label text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_slug   text;
  v_secret text;
  v_key    text;
begin
  perform admin_require(is_meeting_admin(p_meeting), 'issue an API key');
  select slug into v_slug from meetings where id = p_meeting;
  if v_slug is null then
    raise exception 'meeting % not found', p_meeting;
  end if;
  v_secret := encode(extensions.gen_random_bytes(24), 'hex');
  v_key := 'awsa_' || left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 8) || '_' || v_secret;
  insert into meeting_api_keys (meeting_id, key_hash, key_prefix, label, created_by)
  values (p_meeting, extensions.digest(v_key, 'sha256'), left(v_key, 14) || left(v_secret, 4), p_label, auth.uid());
  return v_key;
end $$;

create function admin_revoke_api_key(p_key uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_meeting uuid;
begin
  select meeting_id into v_meeting from meeting_api_keys where id = p_key;
  perform admin_require(v_meeting is not null and is_meeting_admin(v_meeting), 'revoke this key');
  update meeting_api_keys set revoked_at = coalesce(revoked_at, now()) where id = p_key;
end $$;

create function admin_set_race_status(p_race uuid, p_status race_status) returns void
language plpgsql security definer set search_path = public as $$
declare v_meeting uuid;
begin
  select meeting_id into v_meeting from races where id = p_race;
  perform admin_require(v_meeting is not null and is_meeting_admin(v_meeting), 'change this race');
  perform set_race_status(p_race, p_status, 'admin:' || auth.uid()::text);
  perform sync_broadcast(v_meeting, array[p_race], array['race']);
end $$;

create function admin_post_dsq_notice(p_race uuid, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare v_meeting uuid;
begin
  select meeting_id into v_meeting from races where id = p_race;
  perform admin_require(v_meeting is not null and is_meeting_admin(v_meeting), 'post a notice for this race');
  update races set dsq_notice_posted_at = p_at where id = p_race;
  perform sync_broadcast(v_meeting, array[p_race], array['race']);
end $$;

create function admin_register_document(
  p_meeting uuid, p_race uuid, p_kind text, p_title text, p_storage_path text,
  p_content_type text default null, p_byte_size int default null, p_sha256 text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform admin_require(is_meeting_admin(p_meeting), 'add a document to this meeting');
  insert into documents (meeting_id, race_id, kind, title, storage_path, content_type, byte_size, sha256)
  values (p_meeting, p_race, p_kind, p_title, p_storage_path, p_content_type, p_byte_size, p_sha256)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function admin_require(boolean, text), admin_ensure_season(text),
  admin_create_meeting(text, text, meeting_level, text, text, date, date, text, text, text, text, uuid),
  admin_set_meeting_published(uuid, boolean), admin_issue_api_key(uuid, text), admin_revoke_api_key(uuid),
  admin_set_race_status(uuid, race_status), admin_post_dsq_notice(uuid, timestamptz),
  admin_register_document(uuid, uuid, text, text, text, text, int, text)
from public, anon;
grant execute on function admin_ensure_season(text),
  admin_create_meeting(text, text, meeting_level, text, text, date, date, text, text, text, text, uuid),
  admin_set_meeting_published(uuid, boolean), admin_issue_api_key(uuid, text), admin_revoke_api_key(uuid),
  admin_set_race_status(uuid, race_status), admin_post_dsq_notice(uuid, timestamptz),
  admin_register_document(uuid, uuid, text, text, text, text, int, text)
to authenticated;

-- Realtime: anyone may listen to a published meeting's topic; nobody may
-- broadcast from a client (no insert policy). A hosted project only gains
-- realtime.messages once Realtime has been used, so the policy is created
-- when the table exists (locally it always does; see supabase/README.md).
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$
      create policy realtime_public_meetings on realtime.messages for select to anon, authenticated
        using (exists (
          select 1 from public.meetings m
          where m.is_published and realtime.topic() = 'meeting:' || m.id::text
        ))
    $p$;
  end if;
end $$;
