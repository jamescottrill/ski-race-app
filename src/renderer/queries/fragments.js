/**
 * SQL fragments shared by every query that scores a race.
 *
 * The discipline factors and the race-points formula used to be pasted into
 * eight separate query strings; this module is now the only place they are
 * defined.
 */

import { RACE_FACTORS } from '@awsa/scoring';

export { RACE_FACTORS };

// `factors(factor, race)`, joined on races.race_type
export const FACTORS_CTE = `factors AS (${RACE_FACTORS.map(
  ({ race, factor }) => `SELECT ${factor} AS factor, '${race}' AS race`,
).join('\n                 UNION ALL\n                 ')})`;

// The same table with the column names the competitor-history queries use
export const RACE_FACTORS_CTE = `race_factors AS (${RACE_FACTORS.map(
  ({ race, factor }) => `SELECT '${race}' AS race_type, ${factor} AS factor`,
).join(' UNION ALL ')})`;

/**
 * Race points for a time relative to the winning time:
 * ROUND((time - best) / best * factor, 2). Expects a `factor` column in scope.
 */
export const racePointsExpression = (timeColumn, bestTimeColumn) =>
  `ROUND((${timeColumn} - ${bestTimeColumn}) / ${bestTimeColumn} * factor, 2)`;

/**
 * One run's rows for a race as `run<N>`, with status flags normalised to 0/1
 * and the time rounded to hundredths. A run the competitor did not complete
 * (DNS, DNF, DSQ, NS) has its time nulled so a partial split can never count
 * as a finishing time or set the winning time. Parameter: the race id.
 */
export const runResultsCte = (runNumber) => `run${runNumber} AS (SELECT race_id,
                        racer_id,
                        competition_id,
                        CASE
                          WHEN COALESCE(is_dnf, 0) OR COALESCE(is_dns, 0) OR COALESCE(is_dsq, 0) OR COALESCE(is_ns, 0) THEN NULL
                          ELSE ROUND(race_time, 2)
                        END AS race_time,
                        COALESCE(is_dsq, 0) AS is_dsq,
                        COALESCE(is_dnf, 0) AS is_dnf,
                        COALESCE(is_dns, 0) AS is_dns,
                        COALESCE(is_ns, 0) AS is_ns,
                        dsq_gate,
                        dsq_reason
                 FROM race_results
                 WHERE run_number = ${runNumber}
                   AND race_id = ?)`;
