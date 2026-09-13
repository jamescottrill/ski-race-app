/**
 * Per-race result queries used by the seed list calculation.
 *
 * Both queries return one row per competitor in the race, ranked by time,
 * with `seed_points` computed as ROUND((time - mintime) / mintime * factor)
 * where factor depends on the race discipline (SL 730, GS 1010, SG 1190,
 * DH 1250, AC 1360).
 *
 * Extracted verbatim from the retired RaceResult / RaceResultTwoRun
 * components, which were the only remaining live code in those files.
 */

// Parameters: [raceId]
export const raceResultsOneRunQuery = `
          WITH factors AS (SELECT 730 AS factor, 'SL' AS race
                           UNION ALL
                           SELECT 1010 AS factor, 'GS' AS race
                           UNION ALL
                           SELECT 1190 AS factor, 'SG' AS race
                           UNION ALL
                           SELECT 1250 AS factor, 'DH' AS race
                           UNION ALL
                           SELECT 1360 AS factor, 'AC' AS race),
               run1 AS (SELECT race_id,
                               racer_id,
                               ROUND(race_time, 2) AS race_time,
                               COALESCE(is_dsq, FALSE) AS is_dsq,
                               COALESCE(is_dnf, FALSE) AS is_dnf,
                               COALESCE(is_dns, FALSE) AS is_dns,
                               COALESCE(is_ns, FALSE) AS is_ns,
                               dsq_gate,
                               dsq_reason,
                               competition_id
                        FROM race_results rr
                        WHERE TRUE
                          AND run_number = 1
                          AND race_id = ?),
               data AS (SELECT run1.racer_id,
                               run1.race_id,
                               run1.race_time AS run_1_time,
                               run1.is_dns AS run_1_dns,
                               run1.is_dsq AS run_1_dsq,
                               run1.is_dnf AS run_1_dnf,
                               run1.is_ns AS is_ns,
                               run1.is_dnf AS is_dnf,
                               run1.is_dns AS is_dns,
                               run1.is_dsq AS is_dsq,
                               run1.dsq_gate AS run_1_dsq_gate,
                               run1.dsq_reason AS run_1_dsq_reason,
                               p.first_name,
                               p.last_name,
                               cc.title,
                               rc.bib_number,
                               cc.regiment AS team,
                               f.factor AS factor,
                               p.gender,
                               cc.is_novice,
                               cc.is_junior,
                               cc.is_veteran,
                               cc.is_reserve,
                               cc.is_senior,
                               RANK() OVER (PARTITION BY run1.race_id ORDER BY rc.seed_points)      AS seed_order,
                               MIN(COALESCE(run1.race_time, 9999))
                                   OVER (ORDER BY run1.race_id) AS mintime
                        FROM run1
                               LEFT JOIN people p ON p.id = run1.racer_id
                               LEFT JOIN race_competitor rc ON run1.race_id = rc.race_id
                                                                 AND run1.racer_id = rc.racer_id
                               LEFT JOIN competition_competitor cc ON cc.racer_id = run1.racer_id AND cc.competition_id = run1.competition_id
                               LEFT JOIN races r ON r.race_id = run1.race_id
                               LEFT JOIN factors f ON f.race = r.race_type
                        )
          SELECT
            *,
            ROUND((run_1_time - mintime) / mintime * factor, 2) AS seed_points,
            RANK() OVER (ORDER BY run_1_time NULLS LAST) AS position
          FROM data
          ORDER BY run_1_time NULLS LAST, bib_number
`;

// Parameters: [raceId, raceId]
export const raceResultsTwoRunQuery = `
          WITH factors AS (SELECT 730 AS factor, 'SL' AS race
                           UNION ALL
                           SELECT 1010 AS factor, 'GS' AS race
                           UNION ALL
                           SELECT 1190 AS factor, 'SG' AS race
                           UNION ALL
                           SELECT 1250 AS factor, 'DH' AS race
                           UNION ALL
                           SELECT 1360 AS factor, 'AC' AS race),
               run1 AS (SELECT race_id,
                               racer_id,
                               ROUND(race_time, 2) AS race_time,
                               COALESCE(is_dsq, FALSE) AS is_dsq,
                               COALESCE(is_dnf, FALSE) AS is_dnf,
                               COALESCE(is_dns, FALSE) AS is_dns,
                               COALESCE(is_ns, FALSE) AS is_ns,
                               dsq_gate,
                               dsq_reason,
                               competition_id
                        FROM race_results rr
                        WHERE TRUE
                          AND run_number = 1
                          AND race_id = ?),
               run2 AS (SELECT race_id,
                               racer_id,
                               ROUND(race_time, 2) AS race_time,
                               COALESCE(is_dsq, FALSE) AS is_dsq,
                               COALESCE(is_dnf, FALSE) AS is_dnf,
                               COALESCE(is_dns, FALSE) AS is_dns,
                               COALESCE(is_ns, FALSE) AS is_ns,
                               dsq_gate,
                               dsq_reason
                        FROM race_results rr
                        WHERE TRUE
                          AND run_number = 2
                          AND race_id = ?),
               data AS (SELECT run1.racer_id,
                               run1.race_id,
                               run1.race_time                                                            AS run_1_time,
                               run2.race_time                                                            AS run_2_time,
                               ROUND(COALESCE(run1.race_time, 9999) + COALESCE(run2.race_time, 9999), 2) AS total_time,
                               run1.is_dns                                                               AS run_1_dns,
                               run2.is_dns                                                               AS run_2_dns,
                               run1.is_dsq                                                               AS run_1_dsq,
                               run2.is_dsq                                                               AS run_2_dsq,
                               run1.is_dnf                                                               AS run_1_dnf,
                               run2.is_dnf                                                               AS run_2_dnf,
                               run1.is_ns                                                                AS is_ns,
                               run1.dsq_gate                                                             AS run_1_dsq_gate,
                               run2.dsq_gate                                                             AS run_2_dsq_gate,
                               run1.dsq_reason                                                           AS run_1_dsq_reason,
                               run2.dsq_reason                                                           AS run_2_dsq_reason,
                               CASE WHEN run1.is_dns OR run2.is_dns THEN 1 ELSE 0 END                   AS is_dns,
                               CASE WHEN run1.is_dnf OR run2.is_dnf THEN 1 ELSE 0 END                   AS is_dnf,
                               CASE WHEN run1.is_dsq OR run2.is_dsq THEN 1 ELSE 0 END                   AS is_dsq,
                               p.first_name,
                               p.last_name,
                               cc.title,
                               rc.bib_number,
                               cc.regiment AS team,
                               f.factor                                                                  AS factor,
                               MIN(COALESCE(run1.race_time, 9999) + COALESCE(run2.race_time, 9999))
                                   OVER (ORDER BY run1.race_id)                                          AS mintime,
                               cc.is_novice,
                               p.gender,
                               cc.is_junior,
                               cc.is_senior,
                               cc.is_veteran,
                               cc.is_reserve,
                               RANK() OVER (PARTITION BY run1.race_id ORDER BY rc.seed_points)      AS seed_order
                        FROM run1
                               LEFT JOIN run2 ON run1.racer_id = run2.racer_id
                               JOIN people p ON p.id = run1.racer_id
                               JOIN race_competitor rc ON run1.race_id = rc.race_id AND run1.racer_id = rc.racer_id
                               JOIN competition_competitor cc ON cc.racer_id = p.id AND cc.competition_id = run1.competition_id
--                                LEFT JOIN competition_team_members ctm ON p.id = ctm.racer_id AND ctm.competition_id = run1.competition_id
--                                LEFT JOIN competition_team ct ON ct.team_id = ctm.team_id AND ct.competition_id = ctm.competition_id
                               JOIN races r ON r.race_id = run1.race_id
                               JOIN factors f ON f.race = r.race_type
--                         WHERE NOT COALESCE(ct.is_corps, FALSE) AND NOT COALESCE(ct.is_female, FALSE)
               )
          SELECT
            *,
            ROUND((total_time - mintime) / mintime * factor, 2) AS seed_points,
            RANK() OVER (ORDER BY total_time) AS position
          FROM data
          ORDER BY total_time
`;
