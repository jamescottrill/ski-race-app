/**
 * @jest-environment node
 */
import { seedResults, seedingPoints } from '../renderer/queries/SeedResults';
import { raceResultsTwoRunQuery } from '../renderer/queries/RaceResults';

const { TABLE_SCHEMAS } = require('../main/utils/schema');

let sqlite = null;
try {
  // eslint-disable-next-line global-require
  sqlite = require('node:sqlite');
} catch (error) {
  sqlite = null;
}
const describeWithSqlite = sqlite ? describe : describe.skip;

function openDatabase() {
  const db = new sqlite.DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF'); // as the app runs
  Object.values(TABLE_SCHEMAS).forEach((sql) => db.exec(sql));
  db.prepare(
    `INSERT INTO competitions (id, competition_name) VALUES ('C', 'Test')`,
  ).run();
  db.prepare(
    `INSERT INTO races (competition_id, race_id, race_name, race_type, number_runs, is_seeding) VALUES ('C', 'SEED', 'Seed', 'GS', 2, 1)`,
  ).run();
  const people = [
    ['W', 100],
    ['X', 200],
    ['Y', 300],
    ['Z', 400],
    ['N', null],
  ];
  people.forEach(([id, arrival], i) => {
    db.prepare(
      `INSERT INTO people (id, first_name, last_name) VALUES (?, ?, 'R')`,
    ).run(id, id);
    db.prepare(
      `INSERT INTO competition_competitor (competition_id, racer_id, arrival_corps_seed) VALUES ('C', ?, ?)`,
    ).run(id, arrival);
    db.prepare(
      `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number) VALUES ('C', 'SEED', ?, ?)`,
    ).run(id, i + 1);
  });
  const result = (run, racer, time, flags = {}) =>
    db
      .prepare(
        `INSERT INTO race_results (competition_id, race_id, run_number, racer_id, race_time, is_dnf, is_dns, is_dsq, is_ns) VALUES ('C', 'SEED', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run,
        racer,
        time,
        flags.dnf ?? 0,
        flags.dns ?? 0,
        flags.dsq ?? 0,
        flags.ns ?? 0,
      );
  // W wins both runs; X second; Y DNF run 1 only; Z NS; N finishes both but has no arrival seed
  result(1, 'W', 50);
  result(2, 'W', 51);
  result(1, 'X', 52);
  result(2, 'X', 53);
  result(1, 'Y', null, { dnf: 1 });
  result(2, 'Y', 55);
  result(1, 'Z', null, { ns: 1 });
  result(1, 'N', 54);
  result(2, 'N', 54);
  return db;
}
const byRacer = (rows) => Object.fromEntries(rows.map((r) => [r.racer_id, r]));

describeWithSqlite('seeding race queries', () => {
  it('gives the competitor who won both runs zero points and first place', () => {
    const rows = byRacer(
      openDatabase().prepare(seedResults).all('SEED', 'SEED'),
    );
    expect(rows.W).toMatchObject({
      seed_1: 0,
      seed_2: 0,
      overall_seed: 0,
      position: 1,
    });
    expect(rows.X).toMatchObject({ overall_seed: 39.61, position: 2 });
  });

  it('reports a non-starter and keeps a DNF run out of the winning time', () => {
    const rows = byRacer(
      openDatabase().prepare(seedResults).all('SEED', 'SEED'),
    );
    expect(rows.Z).toMatchObject({ run_1_ns: 1, overall_seed: null });
    expect(rows.Y).toMatchObject({
      seed_1: null,
      seed_2: 79.22,
      overall_seed: 79.22,
    });
  });

  it('scores a finisher with no arrival seed on their runs, and a non-finisher on 2000', () => {
    const rows = byRacer(
      openDatabase().prepare(seedingPoints).all('SEED', 'SEED'),
    );
    expect(rows.W.seed_point).toBe(0);
    expect(rows.N.seed_point).toBe(59.41);
    expect(rows.Z.seed_point).toBe(400);
    expect(rows.Y.seed_point).toBe(79.22);
  });

  it('uses the latest AASL entry as the cap before the entered arrival seed', () => {
    const db = openDatabase();
    const aasl = (id, points, season) =>
      db
        .prepare(
          `INSERT INTO aasl (service_number, first_name, last_name, seed_points, season) VALUES (?, ?, 'R', ?, ?)`,
        )
        .run(id, id, points, season);
    aasl('N', 50, '2026');
    aasl('N', 999, '2020');
    aasl('X', 20, '2026'); // X also has an entered arrival seed of 200
    const rows = byRacer(db.prepare(seedingPoints).all('SEED', 'SEED'));
    expect(rows.N.seed_point).toBe(50);
    expect(rows.X.seed_point).toBe(20);
    expect(rows.W.seed_point).toBe(0);
  });

  it('awards two-run race points only to competitors who completed both runs', () => {
    const db = openDatabase();
    db.exec(`DELETE FROM race_results WHERE run_number = 2 AND racer_id = 'X'`);
    const rows = byRacer(
      db.prepare(raceResultsTwoRunQuery).all('SEED', 'SEED'),
    );
    expect(rows.W).toMatchObject({
      total_time: 101,
      seed_points: 0,
      position: 1,
    });
    expect(rows.X).toMatchObject({ total_time: null, seed_points: null });
    expect(rows.N).toMatchObject({ total_time: 108, seed_points: 70 });
  });
});
