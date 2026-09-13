-- Views. race_result_rows is the SQL port of the app's results query
-- (src/renderer/queries/RaceResults.js): one row per competitor with a run-1
-- result, a flagged run's time nulled, a two-run total only when both runs
-- are in, race points from the discipline factor and rank with nulls last.
-- The public_* views are the only thing the public site reads. They run
-- with the owner's privileges on purpose (base tables are closed to anon),
-- list their columns explicitly and never expose a service number, birth
-- year, organiser contact, key hash or event payload. A withheld entry
-- keeps its position but loses its name and unit.

create view race_result_rows as
with r1 as (
  select race_id, entry_id,
         case when is_dns or is_dnf or is_dsq or is_ns then null else race_time end as t,
         is_dns, is_dnf, is_dsq, is_ns, dsq_gate, dsq_reason
  from results where run_number = 1
),
r2 as (
  select race_id, entry_id,
         case when is_dns or is_dnf or is_dsq or is_ns then null else race_time end as t,
         is_dns, is_dnf, is_dsq, is_ns, dsq_gate, dsq_reason
  from results where run_number = 2
),
d as (
  select ra.id as race_id, ra.meeting_id, ra.number_runs, f.factor, r1.entry_id,
         r1.t as run_1_time,
         r2.t as run_2_time,
         case when ra.number_runs = 2 then round(r1.t + r2.t, 2) end as total_time,
         case when ra.number_runs = 2 then round(r1.t + r2.t, 2) else r1.t end as scored_time,
         r1.is_dns as run_1_dns, r1.is_dnf as run_1_dnf, r1.is_dsq as run_1_dsq, r1.is_ns as run_1_ns,
         r1.dsq_gate as run_1_dsq_gate, r1.dsq_reason as run_1_dsq_reason,
         coalesce(r2.is_dns, false) as run_2_dns, coalesce(r2.is_dnf, false) as run_2_dnf,
         coalesce(r2.is_dsq, false) as run_2_dsq, coalesce(r2.is_ns, false) as run_2_ns,
         r2.dsq_gate as run_2_dsq_gate, r2.dsq_reason as run_2_dsq_reason
  from r1
  join races ra on ra.id = r1.race_id
  left join r2 on r2.race_id = r1.race_id and r2.entry_id = r1.entry_id
  left join race_factors f on f.race_type = ra.race_type
)
select d.*,
       (run_1_dns or run_2_dns) as is_dns,
       (run_1_dnf or run_2_dnf) as is_dnf,
       (run_1_dsq or run_2_dsq) as is_dsq,
       (run_1_ns or run_2_ns) as is_ns,
       min(scored_time) over (partition by race_id) as mintime,
       round((scored_time - min(scored_time) over (partition by race_id))
             / nullif(min(scored_time) over (partition by race_id), 0) * factor, 2) as race_points_sql,
       rank() over (partition by race_id order by scored_time nulls last) as position_sql,
       -- Standing after run 1 of a two-run race, for the live page
       rank() over (partition by race_id order by run_1_time nulls last) as run_1_position
from d;
comment on view race_result_rows is 'SQL port of the app''s results query; race_scores pushed by the app take precedence once a run is locked.';

create view public_meetings as
select m.id, m.slug, m.name, m.description, m.level, m.season_id, m.starts_on, m.ends_on,
       m.venue, m.timezone, m.last_occurred_at, m.last_received_at,
       (select max(i.last_seen_at) from installations i where i.meeting_id = m.id) as organiser_last_seen_at,
       (select i.outbox_pending from installations i where i.meeting_id = m.id
        order by i.last_seen_at desc nulls last limit 1) as outbox_pending
from meetings m
where m.is_published;

create view public_entries as
select e.id as entry_id, e.meeting_id,
       case when e.do_not_publish then null else e.title end as title,
       case when e.do_not_publish then null else c.first_name end as first_name,
       case when e.do_not_publish then null else c.last_name end as last_name,
       case when e.do_not_publish then 'Withheld'
            else trim(concat_ws(' ', e.title, upper(c.last_name), c.first_name)) end as display_name,
       case when e.do_not_publish then null else e.regiment end as team,
       c.gender, e.is_female, e.is_junior, e.is_senior, e.is_veteran, e.is_novice, e.is_reserve, e.is_hc,
       e.do_not_publish as withheld
from meeting_entries e
join competitors c on c.id = e.competitor_id
join meetings m on m.id = e.meeting_id
where m.is_published;

create view public_races as
select r.id, r.meeting_id, r.name, r.race_date, r.race_type, r.is_individual, r.is_team, r.is_training,
       r.is_seeding, r.is_championship, r.women_separate, r.number_runs, r.venue, r.course_name, r.weather,
       r.snow, r.temp_start, r.temp_finish, r.start_altitude, r.finish_altitude,
       r.start_altitude - r.finish_altitude as vertical_drop, r.homologation, r.officials, f.factor,
       r.sequence, r.status, r.results_posted_at, r.dsq_notice_posted_at,
       r.dsq_notice_posted_at + interval '15 minutes' as protest_deadline_at, r.official_at,
       (select max(res.app_updated_at) from results res where res.race_id = r.id) as last_result_at,
       (select max(res.synced_at) from results res where res.race_id = r.id) as last_synced_at,
       exists (select 1 from race_scores rs where rs.race_id = r.id) as has_official_scoring
from races r
join meetings m on m.id = r.meeting_id and m.is_published
left join race_factors f on f.race_type = r.race_type;

create view public_race_runs as
select rr.race_id, rr.run_number, rr.course_setter, rr.number_gates, rr.turning_gates, rr.start_time,
       rr.forerunners, rr.is_complete
from race_runs rr
join races r on r.id = rr.race_id
join meetings m on m.id = r.meeting_id and m.is_published;

create view public_teams as
select t.id, t.meeting_id, t.name, t.team_type, t.is_corps, t.is_reserve, t.is_female, t.is_hc
from teams t
join meetings m on m.id = t.meeting_id and m.is_published;

create view public_start_list as
select sl.race_id, sl.entry_id, sl.bib_number, sl.seed_points,
       pe.title, pe.first_name, pe.last_name, pe.display_name, pe.team, pe.gender,
       pe.is_female, pe.is_junior, pe.is_senior, pe.is_veteran, pe.is_novice, pe.is_reserve, pe.is_hc, pe.withheld
from start_list_entries sl
join public_entries pe on pe.entry_id = sl.entry_id;

create view public_race_results as
select rr.race_id, rr.entry_id, sl.bib_number,
       pe.title, pe.first_name, pe.last_name, pe.display_name, pe.team, pe.gender,
       pe.is_female, pe.is_junior, pe.is_senior, pe.is_veteran, pe.is_novice, pe.is_reserve, pe.is_hc, pe.withheld,
       rr.number_runs, rr.run_1_time, rr.run_2_time, rr.total_time,
       rr.run_1_dns, rr.run_1_dnf, rr.run_1_dsq, rr.run_1_ns, rr.run_1_dsq_gate, rr.run_1_dsq_reason,
       rr.run_2_dns, rr.run_2_dnf, rr.run_2_dsq, rr.run_2_ns, rr.run_2_dsq_gate, rr.run_2_dsq_reason,
       rr.is_dns, rr.is_dnf, rr.is_dsq, rr.is_ns,
       coalesce(rs.race_points, rr.race_points_sql) as seed_points,
       coalesce(rs.position, rr.position_sql) as position,
       rr.run_1_position,
       case when rs.race_id is not null then 'app' else 'sql' end as scoring_source,
       rs.points_run_1, rs.points_run_2,
       t.id as team_id, t.name as team_name, t.is_corps as team_is_corps, t.is_female as team_is_female
from race_result_rows rr
join public_entries pe on pe.entry_id = rr.entry_id
left join start_list_entries sl on sl.race_id = rr.race_id and sl.entry_id = rr.entry_id
left join race_scores rs on rs.race_id = rr.race_id and rs.entry_id = rr.entry_id
left join lateral (
  select tm.team_id from team_members tm
  where tm.entry_id = rr.entry_id and (tm.race_id = rr.race_id or tm.race_id is null)
  order by tm.race_id nulls last limit 1
) tmx on true
left join teams t on t.id = tmx.team_id;

create view public_seed_list_snapshots as
select s.id, s.meeting_id, s.after_race_count, s.label, s.race_ids, s.is_final, s.computed_at
from seed_list_snapshots s
join meetings m on m.id = s.meeting_id and m.is_published;

create view public_seed_list_rows as
select r.snapshot_id, r.entry_id, r.position, r.seed_points, r.initial_points, r.aasl_points,
       r.race_points, r.penalty_race_ids,
       pe.title, pe.first_name, pe.last_name, pe.display_name, pe.team, pe.gender,
       pe.is_female, pe.is_junior, pe.is_senior, pe.is_veteran, pe.is_novice, pe.withheld
from seed_list_snapshot_rows r
join public_entries pe on pe.entry_id = r.entry_id;

create view public_standings as
select s.id, s.meeting_id, s.kind, s.race_ids, s.computed_at
from standings_snapshots s
join meetings m on m.id = s.meeting_id and m.is_published;

create view public_standings_rows as
select r.snapshot_id, r.entry_id, r.team_id, r.position, r.total_points, r.race_points,
       pe.title, pe.first_name, pe.last_name,
       coalesce(pe.display_name, t.name) as display_name,
       pe.team, pe.gender, pe.is_female, pe.is_junior, pe.is_senior, pe.is_veteran, pe.is_novice, pe.withheld,
       t.name as team_name, t.is_corps as team_is_corps, t.is_female as team_is_female, t.is_hc as team_is_hc
from standings_snapshot_rows r
join standings_snapshots s on s.id = r.snapshot_id
join meetings m on m.id = s.meeting_id and m.is_published
left join public_entries pe on pe.entry_id = r.entry_id
left join teams t on t.id = r.team_id;

create view public_meeting_cpp as
select c.meeting_id, c.cpp_value, c.t1, c.t2, c.t3, c.divisor, c.skiers_used, c.calculated_at
from meeting_cpp c
join meetings m on m.id = c.meeting_id and m.is_published;

create view public_final_seed_list as
select r.meeting_id, r.entry_id, r.position, r.raw_seed_points, r.cpp_applied, r.final_seed_points,
       r.aasl_points, f.finalised_at,
       pe.title, pe.first_name, pe.last_name, pe.display_name, pe.team, pe.gender,
       pe.is_female, pe.is_junior, pe.is_senior, pe.is_veteran, pe.is_novice, pe.withheld
from final_seed_list_rows r
join final_seed_lists f on f.meeting_id = r.meeting_id
join public_entries pe on pe.entry_id = r.entry_id;

create view public_documents as
select d.id, d.meeting_id, d.race_id, d.kind, d.title, d.storage_path, d.content_type, d.byte_size, d.uploaded_at
from documents d
join meetings m on m.id = d.meeting_id and m.is_published;

grant select on public_meetings, public_entries, public_races, public_race_runs, public_teams,
  public_start_list, public_race_results, public_seed_list_snapshots, public_seed_list_rows,
  public_standings, public_standings_rows, public_meeting_cpp, public_final_seed_list, public_documents
to anon, authenticated;

-- Organiser views run as the caller so the admin policies apply
create view admin_scoring_drift with (security_invoker = true) as
select rr.race_id, rr.meeting_id, rr.entry_id,
       rs.position as app_position, rr.position_sql as sql_position,
       rs.race_points as app_points, rr.race_points_sql as sql_points
from race_result_rows rr
join race_scores rs on rs.race_id = rr.race_id and rs.entry_id = rr.entry_id
where rs.position is distinct from rr.position_sql
   or rs.race_points is distinct from rr.race_points_sql;
comment on view admin_scoring_drift is 'Locked races where the app''s scoring and the SQL scoring disagree.';

-- Everything the qualification engine needs from a meeting's final seed list
create view cutoff_inputs with (security_invoker = true) as
select m.id as meeting_id, m.name as meeting_name, m.level, m.season_id, m.feeds_meeting_id,
       c.service_number, c.first_name, c.last_name, c.gender,
       e.id as entry_id, e.title, e.regiment, e.is_female, e.is_hc, e.is_reserve, e.army_opt_out,
       r.position, r.raw_seed_points, r.cpp_applied, r.final_seed_points, r.aasl_points,
       r.championship_races_completed, r.awarded_points_count,
       f.finalised_at, f.cpp_value,
       (select a.seed_points from aasl a where a.competitor_id = c.id and a.season_id = m.season_id) as season_aasl_points,
       (select array_agg(distinct t.name) from team_members tm join teams t on t.id = tm.team_id
        where tm.entry_id = e.id) as team_names
from final_seed_list_rows r
join final_seed_lists f on f.meeting_id = r.meeting_id
join meetings m on m.id = r.meeting_id
join meeting_entries e on e.id = r.entry_id
join competitors c on c.id = r.competitor_id;

grant select on race_result_rows, admin_scoring_drift, cutoff_inputs to authenticated;
