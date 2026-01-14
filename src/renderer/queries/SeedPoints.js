const seedPointsOneRun = `
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
                               CASE WHEN is_dnf OR is_dns OR is_dsq OR is_ns THEN NULL ELSE ROUND(race_time, 2) END AS race_time
                        FROM race_results rr
                        INNER JOIN competition_competitor cc ON cc.racer_id = rr.racer_id AND cc.competition_id = rr.competition_id AND (cc.is_withdrawn = 0 OR cc.is_withdrawn IS NULL)
                        WHERE TRUE
                          AND run_number = 1
                          AND race_id = ?),
               data AS (SELECT run1.racer_id,
                               run1.race_id,
                               run1.race_time                                                            AS run_1_time,
                               f.factor                                                                  AS factor,
                               MIN(COALESCE(run1.race_time, 9999))
                                   OVER (ORDER BY run1.race_id)                                          AS min1time
                        FROM run1
                               JOIN races r ON run1.race_id = r.race_id
                               JOIN factors f ON f.race = r.race_type
                        ),
          seeds AS (SELECT *,
                             ROUND((run_1_time - min1time) / min1time * factor, 2) AS seed_point
                      FROM data)
            SELECT
              racer_id,
              race_id,
              seed_point
            FROM seeds
`;

const seedPointsTwoRun = `
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
                               CASE WHEN is_dnf OR is_dns OR is_dsq OR is_ns THEN NULL ELSE ROUND(race_time, 2) END AS race_time
                        FROM race_results rr
                               INNER JOIN competition_competitor cc ON cc.racer_id = rr.racer_id AND cc.competition_id = rr.competition_id AND (cc.is_withdrawn = 0 OR cc.is_withdrawn IS NULL)
                        WHERE TRUE
                          AND run_number = 1
                          AND race_id = ?),
               run2 AS (SELECT race_id,
                               rr.racer_id,
                               CASE WHEN is_dnf OR is_dns OR is_dsq OR is_ns THEN NULL ELSE ROUND(race_time, 2) END AS race_time
                        FROM race_results rr
                               INNER JOIN competition_competitor cc ON cc.racer_id = rr.racer_id AND cc.competition_id = rr.competition_id AND (cc.is_withdrawn = 0 OR cc.is_withdrawn IS NULL)
                        WHERE TRUE
                          AND run_number = 2
                          AND race_id = ?),
               data AS (SELECT run1.racer_id,
                               run1.race_id,
                               run1.race_time AS run_1_time,
                               run2.race_time AS run_2_time,
                               ROUND(run1.race_time + run2.race_time, 2) AS total_time,
                               f.factor AS factor,
                               MIN(ROUND(run1.race_time + run2.race_time, 2))
                                   OVER (ORDER BY run1.race_id) AS min_time
                        FROM run1
                               LEFT JOIN run2 ON run1.racer_id = run2.racer_id
                               JOIN races r ON run1.race_id = r.race_id
                               JOIN factors f ON f.race = r.race_type
                        ),
          seeds AS (SELECT *,
                             ROUND((total_time - min_time) / min_time * factor, 2) AS seed
                      FROM data)
            SELECT
              racer_id,
              race_id,
              CASE WHEN run_1_time AND run_2_time THEN seed END AS seed_point
            FROM seeds
`;

export { seedPointsOneRun, seedPointsTwoRun };
