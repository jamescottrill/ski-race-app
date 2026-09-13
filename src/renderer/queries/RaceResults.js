/**
 * Per-race result queries: one row per competitor with status flags, the
 * winning time, and race points computed from the discipline factor.
 *
 * All four variants (one or two runs, individual or team) are assembled from
 * the same fragments, so the scoring formula is defined once.
 *
 * Parameters: one race id per run, i.e. [raceId] for the one-run queries and
 * [raceId, raceId] for the two-run queries.
 */
import { FACTORS_CTE, racePointsExpression, runResultsCte } from './fragments';

const COMPETITOR_COLUMNS = `p.first_name,
                    p.last_name,
                    p.gender,
                    cc.title,
                    cc.regiment AS team,
                    cc.is_novice,
                    cc.is_junior,
                    cc.is_senior,
                    cc.is_veteran,
                    cc.is_reserve,
                    rc.bib_number,
                    f.factor AS factor,
                    RANK() OVER (PARTITION BY run1.race_id ORDER BY rc.seed_points) AS seed_order`;

const COMPETITOR_JOINS = `LEFT JOIN people p ON p.id = run1.racer_id
             LEFT JOIN race_competitor rc ON rc.race_id = run1.race_id AND rc.racer_id = run1.racer_id
             LEFT JOIN competition_competitor cc ON cc.racer_id = run1.racer_id AND cc.competition_id = run1.competition_id
             LEFT JOIN races r ON r.race_id = run1.race_id AND r.competition_id = run1.competition_id
             LEFT JOIN factors f ON f.race = r.race_type`;

const TEAM_COLUMNS = `ct.team_name,
                    ct.is_corps AS team_is_corps,
                    ct.is_female AS team_is_female,`;

const TEAM_JOINS = `LEFT JOIN competition_team_members ctm ON ctm.racer_id = run1.racer_id AND ctm.competition_id = run1.competition_id AND ctm.race_id = run1.race_id
             LEFT JOIN competition_team ct ON ct.team_id = ctm.team_id AND ct.competition_id = ctm.competition_id`;

// Racers with no team pass this filter and are dropped later in JS
const OPEN_TEAMS_ONLY = `WHERE NOT COALESCE(ct.is_corps, 0) AND NOT COALESCE(ct.is_female, 0)`;

const statusColumns = (run) => `run${run}.is_dns AS run_${run}_dns,
                    run${run}.is_dnf AS run_${run}_dnf,
                    run${run}.is_dsq AS run_${run}_dsq,
                    run${run}.is_ns AS run_${run}_ns,
                    run${run}.dsq_gate AS run_${run}_dsq_gate,
                    run${run}.dsq_reason AS run_${run}_dsq_reason,`;

// A total exists only when both runs were completed, so nobody can earn
// points or set the winning time on one run of a two-run race
const TWO_RUN_TOTAL = `CASE WHEN run1.race_time IS NOT NULL AND run2.race_time IS NOT NULL
                            THEN ROUND(run1.race_time + run2.race_time, 2) END`;

const ONE_RUN_STATUS = `run1.is_dns AS is_dns,
                    run1.is_dnf AS is_dnf,
                    run1.is_dsq AS is_dsq,
                    run1.is_ns AS is_ns,`;

const TWO_RUN_STATUS = `CASE WHEN run1.is_dns OR run2.is_dns THEN 1 ELSE 0 END AS is_dns,
                    CASE WHEN run1.is_dnf OR run2.is_dnf THEN 1 ELSE 0 END AS is_dnf,
                    CASE WHEN run1.is_dsq OR run2.is_dsq THEN 1 ELSE 0 END AS is_dsq,
                    CASE WHEN run1.is_ns OR run2.is_ns THEN 1 ELSE 0 END AS is_ns,`;

/**
 * Build a race results query.
 * @param {1|2} runs - Number of runs scored
 * @param {boolean} team - Join each racer's team for this race
 * @param {boolean} openTeamsOnly - Exclude corps and women's teams
 */
export function buildRaceResultsQuery({
  runs,
  team = false,
  openTeamsOnly = false,
}) {
  const twoRuns = runs === 2;
  const timeColumn = twoRuns ? 'total_time' : 'run_1_time';
  return `
    WITH ${FACTORS_CTE},
         ${runResultsCte(1)}${twoRuns ? `,\n         ${runResultsCte(2)}` : ''},
         data AS (SELECT run1.racer_id,
                    run1.race_id,
                    run1.competition_id,
                    run1.race_time AS run_1_time,
                    ${twoRuns ? `run2.race_time AS run_2_time,\n                    ${TWO_RUN_TOTAL} AS total_time,` : ''}
                    ${statusColumns(1)}
                    ${twoRuns ? statusColumns(2) : ''}
                    ${twoRuns ? TWO_RUN_STATUS : ONE_RUN_STATUS}
                    ${COMPETITOR_COLUMNS},
                    ${team ? TEAM_COLUMNS : ''}
                    MIN(${twoRuns ? TWO_RUN_TOTAL : 'run1.race_time'}) OVER (ORDER BY run1.race_id) AS mintime
                  FROM run1
                    ${twoRuns ? 'LEFT JOIN run2 ON run2.racer_id = run1.racer_id AND run2.race_id = run1.race_id' : ''}
                    ${COMPETITOR_JOINS}
                    ${team ? TEAM_JOINS : ''}
                    ${openTeamsOnly ? OPEN_TEAMS_ONLY : ''})
    SELECT *,
           ${racePointsExpression(timeColumn, 'mintime')} AS seed_points,
           RANK() OVER (ORDER BY ${timeColumn} NULLS LAST) AS position
    FROM data
    ORDER BY ${timeColumn} NULLS LAST, bib_number
  `;
}

export const raceResultsOneRunQuery = buildRaceResultsQuery({ runs: 1 });
export const raceResultsTwoRunQuery = buildRaceResultsQuery({ runs: 2 });

// The two-run team competition has always excluded corps and women's teams
// and the one-run competition never has. Both are kept as they were; whether
// they should agree is recorded as an open decision in CODE_REVIEW.md.
export const teamResultsOneRunQuery = buildRaceResultsQuery({
  runs: 1,
  team: true,
});
export const teamResultsTwoRunQuery = buildRaceResultsQuery({
  runs: 2,
  team: true,
  openTeamsOnly: true,
});
