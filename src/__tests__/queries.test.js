import {
  RACE_FACTORS,
  FACTORS_CTE,
  RACE_FACTORS_CTE,
  racePointsExpression,
} from '../renderer/queries/fragments';
import {
  buildRaceResultsQuery,
  raceResultsOneRunQuery,
  raceResultsTwoRunQuery,
  teamResultsOneRunQuery,
  teamResultsTwoRunQuery,
} from '../renderer/queries/RaceResults';

const placeholders = (sql) => (sql.match(/\?/g) || []).length;

describe('query fragments', () => {
  it('defines the five disciplines once', () => {
    expect(RACE_FACTORS.map((f) => f.race)).toEqual([
      'SL',
      'GS',
      'SG',
      'DH',
      'AC',
    ]);
    RACE_FACTORS.forEach(({ race, factor }) => {
      expect(FACTORS_CTE).toContain(
        `SELECT ${factor} AS factor, '${race}' AS race`,
      );
      expect(RACE_FACTORS_CTE).toContain(
        `SELECT '${race}' AS race_type, ${factor} AS factor`,
      );
    });
  });

  it('expresses race points relative to the winning time', () => {
    expect(racePointsExpression('total_time', 'mintime')).toBe(
      'ROUND((total_time - mintime) / mintime * factor, 2)',
    );
  });
});

describe('race results queries', () => {
  it('binds one race id per run', () => {
    expect(placeholders(raceResultsOneRunQuery)).toBe(1);
    expect(placeholders(raceResultsTwoRunQuery)).toBe(2);
    expect(placeholders(teamResultsOneRunQuery)).toBe(1);
    expect(placeholders(teamResultsTwoRunQuery)).toBe(2);
  });

  it('scores one-run races on the first run and two-run races on the total', () => {
    expect(raceResultsOneRunQuery).toContain(
      'ROUND((run_1_time - mintime) / mintime * factor, 2) AS seed_points',
    );
    expect(raceResultsTwoRunQuery).toContain(
      'ROUND((total_time - mintime) / mintime * factor, 2) AS seed_points',
    );
    expect(raceResultsTwoRunQuery).toContain('AS run_2_dsq_reason');
    expect(raceResultsOneRunQuery).not.toContain('run2');
  });

  it('joins teams only for team queries, and filters open teams only where it always did', () => {
    expect(raceResultsTwoRunQuery).not.toContain('competition_team');
    expect(teamResultsOneRunQuery).toContain('LEFT JOIN competition_team ct');
    expect(teamResultsOneRunQuery).not.toContain(
      'WHERE NOT COALESCE(ct.is_corps',
    );
    expect(teamResultsTwoRunQuery).toContain(
      'WHERE NOT COALESCE(ct.is_corps, 0) AND NOT COALESCE(ct.is_female, 0)',
    );
  });

  it('only totals two-run races when both runs were completed', () => {
    expect(raceResultsTwoRunQuery).toContain(
      'CASE WHEN run1.race_time IS NOT NULL AND run2.race_time IS NOT NULL',
    );
    expect(raceResultsTwoRunQuery).not.toContain('9999');
  });

  it('nulls the time of a run the competitor did not complete', () => {
    expect(buildRaceResultsQuery({ runs: 1 })).toContain(
      'WHEN COALESCE(is_dnf, 0) OR COALESCE(is_dns, 0) OR COALESCE(is_dsq, 0) OR COALESCE(is_ns, 0) THEN NULL',
    );
  });
});
