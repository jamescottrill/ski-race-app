-- A nested invoker view is checked against the querying role even when the
-- outer view runs as its owner, so anon could not read public_race_results.
-- race_result_rows therefore runs as its owner again and limits its own rows
-- to published meetings or meetings the caller administers: the public
-- views keep working and a signed-in organiser sees no more than before.
create or replace view race_result_rows with (security_invoker = false) as
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
  join meetings m on m.id = ra.meeting_id and (m.is_published or is_meeting_admin(m.id))
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
       rank() over (partition by race_id order by run_1_time nulls last) as run_1_position
from d;
alter view race_result_rows set (security_invoker = false);
