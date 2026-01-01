/**
 * Query helpers for competitor performance history
 */

export const getCompetitorBio = async (competitorId) => {
  const query = `
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.title,
      p.birth_year,
      p.gender,
      p.country
    FROM people p
    WHERE p.id = ?
  `;
  const result = await window.api.select(query, [competitorId]);
  return result.length > 0 ? result[0] : null;
};

export const getCompetitorRaceHistory = async (competitorId) => {
  const query = `
    WITH valid_results AS (
      SELECT
        race_id,
        competition_id,
        racer_id,
        run_number,
        race_time
      FROM race_results
      WHERE NOT COALESCE(is_dns, 0)
        AND NOT COALESCE(is_dnf, 0)
        AND NOT COALESCE(is_dsq, 0)
        AND race_time IS NOT NULL
    ),
    race_factors AS (
      SELECT 'SL' AS race_type, 730 AS factor
      UNION ALL SELECT 'GS', 1010
      UNION ALL SELECT 'SG', 1190
      UNION ALL SELECT 'DH', 1250
      UNION ALL SELECT 'AC', 1360
    ),
    -- For seeding races: best time per individual run
    best_time_per_run AS (
      SELECT
        race_id,
        competition_id,
        run_number,
        MIN(race_time) AS min_time
      FROM valid_results
      GROUP BY race_id, competition_id, run_number
    ),
    -- For non-seeding races: combined time (only racers who completed both runs)
    combined_times AS (
      SELECT
        vr1.race_id,
        vr1.competition_id,
        vr1.racer_id,
        vr1.race_time + vr2.race_time AS combined_time
      FROM valid_results vr1
      INNER JOIN valid_results vr2
        ON vr2.race_id = vr1.race_id
        AND vr2.competition_id = vr1.competition_id
        AND vr2.racer_id = vr1.racer_id
        AND vr2.run_number = 2
      WHERE vr1.run_number = 1
    ),
    best_combined_time AS (
      SELECT
        race_id,
        competition_id,
        MIN(combined_time) AS min_time
      FROM combined_times
      GROUP BY race_id, competition_id
    ),
    -- Seeding race: run 1 seed points
    run1_seed_points AS (
      SELECT
        vr.race_id,
        vr.competition_id,
        vr.racer_id,
        ((vr.race_time - bt.min_time) / bt.min_time) * COALESCE(rf.factor, 1000) AS seed_points
      FROM valid_results vr
      INNER JOIN best_time_per_run bt
        ON bt.race_id = vr.race_id
        AND bt.competition_id = vr.competition_id
        AND bt.run_number = vr.run_number
      INNER JOIN races r
        ON r.race_id = vr.race_id
        AND r.competition_id = vr.competition_id
      LEFT JOIN race_factors rf
        ON rf.race_type = r.race_type
      WHERE vr.run_number = 1
        AND r.is_seeding = 1
    ),
    -- Seeding race: run 2 seed points
    run2_seed_points AS (
      SELECT
        vr.race_id,
        vr.competition_id,
        vr.racer_id,
        ((vr.race_time - bt.min_time) / bt.min_time) * COALESCE(rf.factor, 1000) AS seed_points
      FROM valid_results vr
      INNER JOIN best_time_per_run bt
        ON bt.race_id = vr.race_id
        AND bt.competition_id = vr.competition_id
        AND bt.run_number = vr.run_number
      INNER JOIN races r
        ON r.race_id = vr.race_id
        AND r.competition_id = vr.competition_id
      LEFT JOIN race_factors rf
        ON rf.race_type = r.race_type
      WHERE vr.run_number = 2
        AND r.is_seeding = 1
    ),
    -- Non-seeding race: combined seed points
    combined_seed_points AS (
      SELECT
        ct.race_id,
        ct.competition_id,
        ct.racer_id,
        ((ct.combined_time - bct.min_time) / bct.min_time) * COALESCE(rf.factor, 1000) AS seed_points
      FROM combined_times ct
      INNER JOIN best_combined_time bct
        ON bct.race_id = ct.race_id
        AND bct.competition_id = ct.competition_id
      INNER JOIN races r
        ON r.race_id = ct.race_id
        AND r.competition_id = ct.competition_id
      LEFT JOIN race_factors rf
        ON rf.race_type = r.race_type
      WHERE r.is_seeding = 0 OR r.is_seeding IS NULL
    ),
    -- Non-seeding single run race seed points
    single_run_seed_points AS (
      SELECT
        vr.race_id,
        vr.competition_id,
        vr.racer_id,
        ((vr.race_time - bt.min_time) / bt.min_time) * COALESCE(rf.factor, 1000) AS seed_points
      FROM valid_results vr
      INNER JOIN best_time_per_run bt
        ON bt.race_id = vr.race_id
        AND bt.competition_id = vr.competition_id
        AND bt.run_number = vr.run_number
      INNER JOIN races r
        ON r.race_id = vr.race_id
        AND r.competition_id = vr.competition_id
      LEFT JOIN race_factors rf
        ON rf.race_type = r.race_type
      WHERE vr.run_number = 1
        AND r.number_runs = 1
        AND (r.is_seeding = 0 OR r.is_seeding IS NULL)
    )
    SELECT
      r.race_id,
      r.race_name,
      r.race_date,
      r.race_type,
      r.venue,
      r.number_runs,
      r.is_seeding,
      c.id AS competition_id,
      c.competition_name,
      rc.bib_number,
      rc.seed_points AS entry_seed_points,
      rr1.race_time AS run1_time,
      rr1.is_dns AS run1_dns,
      rr1.is_dnf AS run1_dnf,
      rr1.is_dsq AS run1_dsq,
      rr2.race_time AS run2_time,
      rr2.is_dns AS run2_dns,
      rr2.is_dnf AS run2_dnf,
      rr2.is_dsq AS run2_dsq,
      sp1.seed_points AS run1_seed_points,
      sp2.seed_points AS run2_seed_points,
      CASE
        WHEN r.is_seeding = 1 THEN
          CASE
            WHEN r.number_runs = 1 THEN sp1.seed_points
            WHEN sp1.seed_points IS NOT NULL AND sp2.seed_points IS NOT NULL THEN
              MIN(sp1.seed_points, sp2.seed_points)
            ELSE COALESCE(sp1.seed_points, sp2.seed_points)
          END
        WHEN r.number_runs = 1 THEN srsp.seed_points
        ELSE csp.seed_points
      END AS earned_seed_points
    FROM race_competitor rc
    INNER JOIN races r
      ON r.race_id = rc.race_id
      AND r.competition_id = rc.competition_id
    INNER JOIN competitions c
      ON c.id = r.competition_id
    LEFT JOIN race_results rr1
      ON rr1.race_id = rc.race_id
      AND rr1.racer_id = rc.racer_id
      AND rr1.competition_id = rc.competition_id
      AND rr1.run_number = 1
    LEFT JOIN race_results rr2
      ON rr2.race_id = rc.race_id
      AND rr2.racer_id = rc.racer_id
      AND rr2.competition_id = rc.competition_id
      AND rr2.run_number = 2
    LEFT JOIN run1_seed_points sp1
      ON sp1.race_id = rc.race_id
      AND sp1.competition_id = rc.competition_id
      AND sp1.racer_id = rc.racer_id
    LEFT JOIN run2_seed_points sp2
      ON sp2.race_id = rc.race_id
      AND sp2.competition_id = rc.competition_id
      AND sp2.racer_id = rc.racer_id
    LEFT JOIN combined_seed_points csp
      ON csp.race_id = rc.race_id
      AND csp.competition_id = rc.competition_id
      AND csp.racer_id = rc.racer_id
    LEFT JOIN single_run_seed_points srsp
      ON srsp.race_id = rc.race_id
      AND srsp.competition_id = rc.competition_id
      AND srsp.racer_id = rc.racer_id
    WHERE rc.racer_id = ?
    ORDER BY r.race_date DESC, r.race_id
  `;
  return window.api.select(query, [competitorId]);
};

export const getCompetitorStats = async (competitorId) => {
  const query = `
    SELECT
      COUNT(DISTINCT c.id) AS total_competitions,
      COUNT(DISTINCT r.race_id) AS total_races,
      COUNT(DISTINCT CASE
        WHEN NOT COALESCE(rr1.is_dnf, 0)
         AND NOT COALESCE(rr1.is_dns, 0)
         AND NOT COALESCE(rr1.is_dsq, 0)
        THEN r.race_id
      END) AS completed_races
    FROM race_competitor rc
    INNER JOIN races r ON r.race_id = rc.race_id AND r.competition_id = rc.competition_id
    INNER JOIN competitions c ON c.id = r.competition_id
    LEFT JOIN race_results rr1 ON rr1.race_id = rc.race_id
      AND rr1.racer_id = rc.racer_id
      AND rr1.competition_id = rc.competition_id
      AND rr1.run_number = 1
    WHERE rc.racer_id = ?
  `;
  const result = await window.api.select(query, [competitorId]);
  return result.length > 0 ? result[0] : null;
};

export const searchCompetitors = async (searchTerm = '') => {
  const likeParam = `%${searchTerm}%`;
  const query = `
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.title,
      p.birth_year,
      p.gender,
      p.country,
      (SELECT COUNT(DISTINCT competition_id) FROM competition_competitor WHERE racer_id = p.id) AS competition_count
    FROM people p
    WHERE p.is_competitor = 1
      AND (
        LOWER(p.first_name) LIKE LOWER(?)
        OR LOWER(p.last_name) LIKE LOWER(?)
        OR LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER(?)
      )
    ORDER BY p.last_name, p.first_name
    LIMIT 100
  `;
  return window.api.select(query, [likeParam, likeParam, likeParam]);
};

export const getAllCompetitors = async () => {
  const query = `
  WITH competitor_ids AS (SELECT racer_id, COUNT(DISTINCT competition_id) as ct FROM competition_competitor GROUP BY racer_id)
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.title,
      p.birth_year,
      p.gender,
      p.country,
      cc.ct AS competition_count
    FROM people p
    INNER JOIN competitor_ids cc ON cc.racer_id = p.id
    ORDER BY p.last_name, p.first_name
  `;
  return window.api.select(query);
};

export const getRaceSeedPointsForCompetitor = async (competitorId) => {
  const query = `
    WITH valid_results AS (
      SELECT
        race_id,
        competition_id,
        racer_id,
        run_number,
        race_time
      FROM race_results
      WHERE NOT COALESCE(is_dns, 0)
        AND NOT COALESCE(is_dnf, 0)
        AND NOT COALESCE(is_dsq, 0)
        AND race_time IS NOT NULL
    ),
    race_factors AS (
      SELECT 'SL' AS race_type, 730 AS factor
      UNION ALL SELECT 'GS', 1010
      UNION ALL SELECT 'SG', 1190
      UNION ALL SELECT 'DH', 1250
      UNION ALL SELECT 'AC', 1360
    ),
    best_time_per_run AS (
      SELECT
        race_id,
        competition_id,
        run_number,
        MIN(race_time) AS min_time
      FROM valid_results
      GROUP BY race_id, competition_id, run_number
    ),
    combined_times AS (
      SELECT
        vr1.race_id,
        vr1.competition_id,
        vr1.racer_id,
        vr1.race_time + vr2.race_time AS combined_time
      FROM valid_results vr1
      INNER JOIN valid_results vr2
        ON vr2.race_id = vr1.race_id
        AND vr2.competition_id = vr1.competition_id
        AND vr2.racer_id = vr1.racer_id
        AND vr2.run_number = 2
      WHERE vr1.run_number = 1
    ),
    best_combined_time AS (
      SELECT
        race_id,
        competition_id,
        MIN(combined_time) AS min_time
      FROM combined_times
      GROUP BY race_id, competition_id
    ),
    run1_seed_points AS (
      SELECT
        vr.race_id,
        vr.competition_id,
        vr.racer_id,
        ((vr.race_time - bt.min_time) / bt.min_time) * COALESCE(rf.factor, 1000) AS seed_points
      FROM valid_results vr
      INNER JOIN best_time_per_run bt
        ON bt.race_id = vr.race_id
        AND bt.competition_id = vr.competition_id
        AND bt.run_number = vr.run_number
      INNER JOIN races r
        ON r.race_id = vr.race_id
        AND r.competition_id = vr.competition_id
      LEFT JOIN race_factors rf
        ON rf.race_type = r.race_type
      WHERE vr.run_number = 1
        AND r.is_seeding = 1
    ),
    run2_seed_points AS (
      SELECT
        vr.race_id,
        vr.competition_id,
        vr.racer_id,
        ((vr.race_time - bt.min_time) / bt.min_time) * COALESCE(rf.factor, 1000) AS seed_points
      FROM valid_results vr
      INNER JOIN best_time_per_run bt
        ON bt.race_id = vr.race_id
        AND bt.competition_id = vr.competition_id
        AND bt.run_number = vr.run_number
      INNER JOIN races r
        ON r.race_id = vr.race_id
        AND r.competition_id = vr.competition_id
      LEFT JOIN race_factors rf
        ON rf.race_type = r.race_type
      WHERE vr.run_number = 2
        AND r.is_seeding = 1
    ),
    combined_seed_points AS (
      SELECT
        ct.race_id,
        ct.competition_id,
        ct.racer_id,
        ((ct.combined_time - bct.min_time) / bct.min_time) * COALESCE(rf.factor, 1000) AS seed_points
      FROM combined_times ct
      INNER JOIN best_combined_time bct
        ON bct.race_id = ct.race_id
        AND bct.competition_id = ct.competition_id
      INNER JOIN races r
        ON r.race_id = ct.race_id
        AND r.competition_id = ct.competition_id
      LEFT JOIN race_factors rf
        ON rf.race_type = r.race_type
      WHERE r.is_seeding = 0 OR r.is_seeding IS NULL
    ),
    single_run_seed_points AS (
      SELECT
        vr.race_id,
        vr.competition_id,
        vr.racer_id,
        ((vr.race_time - bt.min_time) / bt.min_time) * COALESCE(rf.factor, 1000) AS seed_points
      FROM valid_results vr
      INNER JOIN best_time_per_run bt
        ON bt.race_id = vr.race_id
        AND bt.competition_id = vr.competition_id
        AND bt.run_number = vr.run_number
      INNER JOIN races r
        ON r.race_id = vr.race_id
        AND r.competition_id = vr.competition_id
      LEFT JOIN race_factors rf
        ON rf.race_type = r.race_type
      WHERE vr.run_number = 1
        AND r.number_runs = 1
        AND (r.is_seeding = 0 OR r.is_seeding IS NULL)
    )
    SELECT
      r.race_id,
      r.race_date,
      r.race_type,
      r.race_name,
      r.number_runs,
      r.is_seeding,
      c.competition_name,
      CASE
        WHEN r.is_seeding = 1 THEN
          CASE
            WHEN r.number_runs = 1 THEN sp1.seed_points
            WHEN sp1.seed_points IS NOT NULL AND sp2.seed_points IS NOT NULL THEN
              MIN(sp1.seed_points, sp2.seed_points)
            ELSE COALESCE(sp1.seed_points, sp2.seed_points)
          END
        WHEN r.number_runs = 1 THEN srsp.seed_points
        ELSE csp.seed_points
      END AS calculated_seed_points
    FROM race_competitor rc
    INNER JOIN races r
      ON r.race_id = rc.race_id
      AND r.competition_id = rc.competition_id
    INNER JOIN competitions c
      ON c.id = r.competition_id
    LEFT JOIN run1_seed_points sp1
      ON sp1.race_id = rc.race_id
      AND sp1.competition_id = rc.competition_id
      AND sp1.racer_id = rc.racer_id
    LEFT JOIN run2_seed_points sp2
      ON sp2.race_id = rc.race_id
      AND sp2.competition_id = rc.competition_id
      AND sp2.racer_id = rc.racer_id
    LEFT JOIN combined_seed_points csp
      ON csp.race_id = rc.race_id
      AND csp.competition_id = rc.competition_id
      AND csp.racer_id = rc.racer_id
    LEFT JOIN single_run_seed_points srsp
      ON srsp.race_id = rc.race_id
      AND srsp.competition_id = rc.competition_id
      AND srsp.racer_id = rc.racer_id
    WHERE rc.racer_id = ?
    ORDER BY r.race_date ASC
  `;
  return window.api.select(query, [competitorId]);
};

export const RACE_TYPE_FACTORS = {
  SL: 730,
  GS: 1010,
  SG: 1190,
  DH: 1250,
  AC: 1360,
};

export const RACE_TYPE_COLOURS = {
  SL: '#3b82f6',
  GS: '#22c55e',
  SG: '#f59e0b',
  DH: '#ef4444',
  AC: '#8b5cf6',
};

export const RACE_TYPE_NAMES = {
  SL: 'Slalom',
  GS: 'Giant Slalom',
  SG: 'Super-G',
  DH: 'Downhill',
  AC: 'Alpine Combined',
};
