const seedResults = `
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
                               rr.racer_id,
                               CASE WHEN is_dnf OR is_dns OR is_dsq THEN NULL ELSE race_time END AS race_time,
                               COALESCE(is_dsq, FALSE) AS is_dsq,
                               COALESCE(is_dnf, FALSE) AS is_dnf,
                               COALESCE(is_dns, FALSE) AS is_dns,
                               dsq_gate,
                               dsq_reason,
                               rr.competition_id
                        FROM race_results rr
                               INNER JOIN competition_competitor cc ON cc.racer_id = rr.racer_id AND cc.competition_id = rr.competition_id
                        WHERE TRUE
                          AND run_number = 1
                          AND race_id = ?),
               run2 AS (SELECT race_id,
                               rr.racer_id,
                               CASE WHEN is_dnf OR is_dns OR is_dsq THEN NULL ELSE race_time END AS race_time,
                               COALESCE(is_dsq, FALSE) AS is_dsq,
                               COALESCE(is_dnf, FALSE) AS is_dnf,
                               COALESCE(is_dns, FALSE) AS is_dns,
                               dsq_gate,
                               dsq_reason
                        FROM race_results rr
                               INNER JOIN competition_competitor cc ON cc.racer_id = rr.racer_id AND cc.competition_id = rr.competition_id
                        WHERE TRUE
                          AND run_number = 2
                          AND race_id = ?),
               data AS (SELECT run1.racer_id,
                               run1.race_id,
                               run1.race_time                                                            AS run_1_time,
                               run2.race_time                                                            AS run_2_time,
                               run1.race_time + run2.race_time                                           AS total_time,
                               run1.is_dns                                                               AS run_1_dns,
                               run2.is_dns                                                               AS run_2_dns,
                               run1.is_dsq                                                               AS run_1_dsq,
                               run2.is_dsq                                                               AS run_2_dsq,
                               run1.is_dnf                                                               AS run_1_dnf,
                               run2.is_dnf                                                               AS run_2_dnf,
                               run1.dsq_gate                                                             AS run_1_dsq_gate,
                               run2.dsq_gate                                                             AS run_2_dsq_gate,
                               run1.dsq_reason                                                           AS run_1_dsq_reason,
                               run2.dsq_reason                                                           AS run_2_dsq_reason,
                               p.first_name,
                               p.last_name,
                               cc.title,
                               rc.bib_number,
                               cc.regiment AS team,
                               f.factor                                                                  AS factor,
                               MIN(COALESCE(run1.race_time, 9999))
                                   OVER (ORDER BY run1.race_id)                                          AS min1time,
                               MIN(COALESCE(run2.race_time, 9999))
                                   OVER (ORDER BY run1.race_id)                                          AS min2time
                        FROM run1
                               LEFT JOIN run2 ON run1.racer_id = run2.racer_id
                               JOIN people p ON p.id = run1.racer_id
                               JOIN race_competitor rc ON run1.race_id = rc.race_id AND run1.racer_id = rc.racer_id
                               JOIN competition_competitor cc ON cc.racer_id = p.id AND cc.competition_id = run1.competition_id
--                                LEFT JOIN competition_team_members ctm ON ctm.racer_id = run1.racer_id AND ctm.competition_id = run1.competition_id
--                                LEFT JOIN competition_team ct ON ct.team_id = ctm.team_id AND ct.competition_id = run1.competition_id
                               JOIN races r ON r.race_id = run1.race_id
                               JOIN factors f ON f.race = r.race_type
--                                WHERE NOT COALESCE(ct.is_corps, FALSE) AND NOT COALESCE(ct.is_female, FALSE)
                        ),
          seeds AS (SELECT *,
                             ROUND((run_1_time - min1time) / min1time * factor,2) AS seed_1,
                             ROUND((run_2_time - min2time) / min2time * factor,2) AS seed_2
                      FROM data),
          final AS(
            SELECT
              *,
              CASE
                WHEN NOT seed_1 AND NOT seed_2 THEN NULL
                WHEN COALESCE(seed_1, 999999) < COALESCE(seed_2, 999999) THEN seed_1 ELSE seed_2 END AS overall_seed
            FROM seeds
          )
          SELECT
            *,
          RANK() OVER (ORDER BY COALESCE(overall_seed, 9999999)) AS position
          FROM final
          ORDER BY total_time
        `;

const seedingPoints = `
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
                               competition_id,
                               CASE WHEN is_dnf OR is_dns OR is_dsq OR is_ns THEN NULL ELSE race_time END AS race_time
                               , is_ns
                        FROM race_results rr
                        WHERE TRUE
                          AND run_number = 1
                          AND race_id = ?),
               run2 AS (SELECT race_id,
                               racer_id,
                               CASE WHEN is_dnf OR is_dns OR is_dsq OR is_ns THEN NULL ELSE race_time END AS race_time
                        FROM race_results rr
                        WHERE TRUE
                          AND run_number = 2
                          AND race_id = ?),
               data AS (SELECT run1.competition_id,
                               run1.racer_id,
                               run1.race_id,
                               run1.race_time                                                            AS run_1_time,
                               run1.is_ns                                                                AS is_ns,
                               run2.race_time                                                            AS run_2_time,
                               run1.race_time + run2.race_time                                           AS total_time,
                               f.factor                                                                  AS factor,
                               MIN(COALESCE(run1.race_time, 9999))
                                   OVER (ORDER BY run1.race_id)                                          AS min1time,
                               MIN(COALESCE(run2.race_time, 9999))
                                   OVER (ORDER BY run1.race_id)                                          AS min2time
                        FROM run1
                               LEFT JOIN run2 ON run1.racer_id = run2.racer_id
                               JOIN races r ON run1.race_id = r.race_id
                               JOIN factors f ON f.race = r.race_type
                        ),
          seeds AS (SELECT *,
                             ROUND((run_1_time - min1time) / min1time * factor,2) AS seed_1,
                             ROUND((run_2_time - min2time) / min2time * factor,2) AS seed_2
                      FROM data)
            SELECT
              s.racer_id,
              race_id,
              total_time,
              is_ns,
              CASE
                WHEN NOT seed_1 AND NOT seed_2 THEN NULL
                WHEN COALESCE(seed_1, 999999) < COALESCE(seed_2, 999999) AND COALESCE(seed_1, 999999) < cc.arrival_corps_seed THEN seed_1
                WHEN COALESCE(seed_2, 999999) < cc.arrival_corps_seed THEN seed_2
                ELSE arrival_corps_seed END AS seed_point
            FROM seeds s
            JOIN competition_competitor cc ON cc.racer_id = s.racer_id AND cc.competition_id = s.competition_id
          ORDER BY total_time NULLS LAST
        `;

export { seedResults, seedingPoints };
