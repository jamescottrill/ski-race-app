/**
 * @jest-environment node
 */
import {
  raceResultsOneRunQuery,
  raceResultsTwoRunQuery,
} from '../renderer/queries/RaceResults';

const fixture = require('../../packages/scoring/test/fixtures/race-scoring.json');
const { createSchema } = require('../main/utils/migrations');

// node:sqlite ships with Node 22.13+; on older Node these tests are skipped
let sqlite = null;
try {
  // eslint-disable-next-line global-require
  sqlite = require('node:sqlite');
} catch (error) {
  sqlite = null;
}
const describeWithSqlite = sqlite ? describe : describe.skip;

// Load the golden fixture into the app's own schema
function openDatabase() {
  const db = new sqlite.DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF');
  createSchema(db);
  db.prepare(
    `INSERT INTO competitions (id, competition_name) VALUES ('C', 'Golden')`,
  ).run();
  const people = new Set();
  fixture.races.forEach((race) => {
    db.prepare(
      `INSERT INTO races (competition_id, race_id, race_name, race_type, number_runs) VALUES ('C', ?, ?, ?, ?)`,
    ).run(race.id, race.name, race.race_type, race.number_runs);
    for (let run = 1; run <= race.number_runs; run += 1) {
      db.prepare(
        `INSERT INTO race_run (competition_id, race_id, run_id, run_number, is_complete) VALUES ('C', ?, ?, ?, 0)`,
      ).run(race.id, `${race.id}-run-${run}`, run);
    }
    race.entries.forEach((entry) => {
      if (!people.has(entry.sn)) {
        people.add(entry.sn);
        db.prepare(
          `INSERT INTO people (id, first_name, last_name) VALUES (?, ?, 'Racer')`,
        ).run(entry.sn, entry.sn);
        db.prepare(
          `INSERT INTO competition_competitor (competition_id, racer_id) VALUES ('C', ?)`,
        ).run(entry.sn);
      }
      db.prepare(
        `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number) VALUES ('C', ?, ?, ?)`,
      ).run(race.id, entry.sn, entry.bib);
      Object.entries(entry.runs).forEach(([run, r]) => {
        db.prepare(
          `INSERT INTO race_results (competition_id, race_id, run_number, racer_id, race_time, is_dns, is_dnf, is_dsq, is_ns, dsq_gate)
           VALUES ('C', ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        ).run(
          race.id,
          Number(run),
          entry.sn,
          r.time ?? null,
          r.dns ? 1 : 0,
          r.dnf ? 1 : 0,
          r.dsq ? 1 : 0,
          r.gate ?? null,
        );
      });
    });
  });
  return db;
}

describeWithSqlite('golden race-scoring fixture (SQLite)', () => {
  fixture.races.forEach((race) => {
    it(`${race.id}: the app query scores as the fixture expects`, () => {
      const db = openDatabase();
      const query =
        race.number_runs === 2
          ? raceResultsTwoRunQuery
          : raceResultsOneRunQuery;
      const params = race.number_runs === 2 ? [race.id, race.id] : [race.id];
      const rows = db.prepare(query).all(...params);
      const bySn = Object.fromEntries(rows.map((row) => [row.racer_id, row]));
      // Normalise both sides: a non-finisher has no points and its rank is
      // meaningless, so only finishers carry a position
      const actual = race.expected.map(({ sn }) => {
        const row = bySn[sn];
        return {
          sn,
          position: row.seed_points === null ? null : row.position,
          points: row.seed_points,
          is_dnf: Boolean(row.is_dnf),
          is_dsq: Boolean(row.is_dsq),
        };
      });
      const expected = race.expected.map((e) => ({
        sn: e.sn,
        position: e.position,
        points: e.points,
        is_dnf: Boolean(e.is_dnf),
        is_dsq: Boolean(e.is_dsq),
      }));
      expect(actual).toEqual(expected);
    });
  });
});
