/**
 * @jest-environment node
 */
import {
  fetchSeedList,
  combinationRule,
  combinePoints,
  rankList,
} from '../renderer/utils/FetchSeedList';

const { TABLE_SCHEMAS } = require('../main/utils/schema');

let sqlite = null;
try {
  // eslint-disable-next-line global-require
  sqlite = require('node:sqlite');
} catch (error) {
  sqlite = null;
}
const describeWithSqlite = sqlite ? describe : describe.skip;

let db;
beforeAll(() => {
  // fetchSeedList reads through the preload bridge
  global.window = {
    api: { select: async (sql, params = []) => db.prepare(sql).all(...params) },
  };
});

const result = (race, run, racer, time, flags = {}) =>
  db
    .prepare(
      `INSERT INTO race_results (competition_id, race_id, run_number, racer_id, race_time, is_dnf, is_dns, is_dsq, is_ns)
       VALUES ('C', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      race,
      run,
      racer,
      time,
      flags.dnf ?? 0,
      flags.dns ?? 0,
      flags.dsq ?? 0,
      flags.ns ?? 0,
    );

/**
 * Seeding GS (2 runs), SL1, GS2 (2 runs), SL3. W wins everything and both
 * seeding runs; X solid; T misses GS2 (DNF) and SL3 (DSQ); Y DNFs the
 * seeding race's first run and SL1; Z is NS in the seeding race, DNS in SL1
 * and has no GS2 row at all; N finishes everything but has no arrival seed.
 */
function openDatabase() {
  db = new sqlite.DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF');
  Object.values(TABLE_SCHEMAS).forEach((sql) => db.exec(sql));
  db.prepare(
    `INSERT INTO competitions (id, competition_name) VALUES ('C', 'Test')`,
  ).run();
  [
    ['SEED', 'GS', 2, 1, '2026-01-01'],
    ['SL1', 'SL', 1, 0, '2026-01-02'],
    ['GS2', 'GS', 2, 0, '2026-01-03'],
    ['SL3', 'SL', 1, 0, '2026-01-04'],
  ].forEach(([id, type, runs, seeding, date]) =>
    db
      .prepare(
        `INSERT INTO races (competition_id, race_id, race_name, race_type, number_runs, is_seeding, race_date) VALUES ('C', ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, id, type, runs, seeding, date),
  );
  [
    ['W', 100],
    ['X', 200],
    ['T', 250],
    ['Y', 300],
    ['Z', 400],
    ['N', null],
  ].forEach(([id, arrival], i) => {
    db.prepare(
      `INSERT INTO people (id, first_name, last_name, gender) VALUES (?, ?, ?, 'M')`,
    ).run(id, id, id);
    db.prepare(
      `INSERT INTO competition_competitor (competition_id, racer_id, arrival_corps_seed) VALUES ('C', ?, ?)`,
    ).run(id, arrival);
    ['SEED', 'SL1', 'GS2', 'SL3'].forEach((race) =>
      db
        .prepare(
          `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number) VALUES ('C', ?, ?, ?)`,
        )
        .run(race, id, i + 1),
    );
  });
  result('SEED', 1, 'W', 50);
  result('SEED', 2, 'W', 51);
  result('SEED', 1, 'X', 52);
  result('SEED', 2, 'X', 53);
  result('SEED', 1, 'T', 52);
  result('SEED', 2, 'T', 54);
  result('SEED', 1, 'Y', null, { dnf: 1 });
  result('SEED', 2, 'Y', 55);
  result('SEED', 1, 'Z', null, { ns: 1 });
  result('SEED', 1, 'N', 54);
  result('SEED', 2, 'N', 54);
  result('SL1', 1, 'W', 40);
  result('SL1', 1, 'X', 42);
  result('SL1', 1, 'T', 43);
  result('SL1', 1, 'N', 44);
  result('SL1', 1, 'Y', null, { dnf: 1 });
  result('SL1', 1, 'Z', null, { dns: 1 });
  result('GS2', 1, 'W', 60);
  result('GS2', 2, 'W', 61);
  result('GS2', 1, 'X', 62);
  result('GS2', 2, 'X', 63);
  result('GS2', 1, 'T', null, { dnf: 1 });
  result('GS2', 1, 'N', 64);
  result('GS2', 2, 'N', 65);
  result('GS2', 1, 'Y', 66);
  result('GS2', 2, 'Y', 67);
  result('SL3', 1, 'W', 30);
  result('SL3', 1, 'X', 31);
  result('SL3', 1, 'N', 32);
  result('SL3', 1, 'Y', 33);
  result('SL3', 1, 'Z', 34);
  result('SL3', 1, 'T', null, { dsq: 1 });
}

const summary = (rows, raceIds) =>
  rows.map((r) => [
    r.position,
    r.racer_id,
    ...raceIds.map((id) => r[id] ?? null),
    r.seed_points,
  ]);

describe('combination rules', () => {
  it('needs one result up to two races, then best two, best three, best n-2', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((c) => combinationRule(c).needed)).toEqual(
      [1, 1, 2, 2, 3, 3, 4],
    );
    expect([1, 2, 3].map((c) => combinationRule(c).useInitial)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('averages the best available and returns null with nothing', () => {
    expect(combinePoints([30, null, 10, 20], 2)).toBe(15);
    expect(combinePoints([30], 2)).toBe(30);
    expect(combinePoints([null], 2)).toBeNull();
  });

  it('ranks with ties and puts missing points last', () => {
    const ranked = rankList([
      { racer_id: 'a', seed_points: 10, last_name: 'A' },
      { racer_id: 'n', seed_points: null, last_name: 'N' },
      { racer_id: 'b', seed_points: 10, last_name: 'B' },
      { racer_id: 'c', seed_points: 12, last_name: 'C' },
    ]);
    expect(ranked.map((r) => [r.racer_id, r.position])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
      ['n', 4],
    ]);
  });
});

describeWithSqlite('fetchSeedList', () => {
  beforeEach(openDatabase);

  it('lists arrival seeds before any race, with 2000 for a missing seed', async () => {
    expect(summary(await fetchSeedList('C', []), [])).toEqual([
      [1, 'W', 100],
      [2, 'X', 200],
      [3, 'T', 250],
      [4, 'Y', 300],
      [5, 'Z', 400],
      [6, 'N', 2000],
    ]);
  });

  it('scores the seeding race as the best of both runs and the arrival seed', async () => {
    expect(summary(await fetchSeedList('C', ['SEED']), ['SEED'])).toEqual([
      [1, 'W', 0, 0],
      [2, 'X', 39.61, 39.61],
      [3, 'T', 40.4, 40.4],
      [4, 'N', 59.41, 59.41],
      [5, 'Y', 79.22, 79.22],
      [6, 'Z', 400, 400],
    ]);
  });

  it('after the first championship race takes the better of initial points and the race', async () => {
    const rows = await fetchSeedList('C', ['SEED', 'SL1']);
    expect(summary(rows, ['SEED', 'SL1'])).toEqual([
      [1, 'W', 0, 0, 0],
      [2, 'X', 39.61, 36.5, 36.5],
      [3, 'T', 40.4, 54.75, 40.4],
      [4, 'N', 59.41, 73, 59.41],
      [5, 'Y', 79.22, null, 79.22],
      [6, 'Z', 400, null, 400],
    ]);
    expect(rows.some((r) => r['SL1-penalty'])).toBe(false);
  });

  it('after two championship races averages the best two, awarding B13 points only where needed', async () => {
    const rows = await fetchSeedList('C', ['SEED', 'SL1', 'GS2']);
    expect(summary(rows, ['SEED', 'SL1', 'GS2'])).toEqual([
      [1, 'W', 0, 0, 0, 0],
      [2, 'X', 39.61, 36.5, 33.39, 34.95],
      [3, 'T', 40.4, 54.75, null, 47.58],
      [4, 'N', 59.41, 73, 66.78, 63.1],
      [5, 'Y', 79.22, null, 100.17, 89.7],
      // Z: seeded below the last GS2 finisher, so own points (400) beat last + 20%
      [6, 'Z', 400, null, 400, 400],
    ]);
    const byId = Object.fromEntries(rows.map((r) => [r.racer_id, r]));
    expect(byId.Z['GS2-penalty']).toBe(true);
    expect(byId.T['GS2-penalty']).toBeUndefined();
  });

  it('drops initial points after three championship races and carries awards forward', async () => {
    const rows = await fetchSeedList('C', ['SL1', 'GS2', 'SL3']);
    expect(summary(rows, ['SL1', 'GS2', 'SL3'])).toEqual([
      [1, 'W', 0, 0, 0, 0],
      [2, 'X', 36.5, 33.39, 24.33, 28.86],
      // T: seeded 3rd before SL3, matched to the 3rd finisher (48.67) + 10
      [3, 'T', 54.75, null, 58.67, 56.71],
      [4, 'N', 73, 66.78, 48.67, 57.73],
      [5, 'Y', null, 100.17, 73, 86.59],
      // Z: GS2 award of 400 carried forward from the earlier list
      [6, 'Z', null, 400, 97.33, 248.67],
    ]);
    const byId = Object.fromEntries(rows.map((r) => [r.racer_id, r]));
    expect(byId.T['SL3-penalty']).toBe(true);
    expect(byId.Z['GS2-penalty']).toBe(true);
    expect(byId.Z['SL1-penalty']).toBeUndefined();
    expect(byId.W.SEED).toBeUndefined();
  });

  it('can leave awarded points out, for the uses B13.d excludes', async () => {
    const rows = await fetchSeedList('C', ['SL1', 'GS2', 'SL3'], {
      awardPenalties: false,
    });
    const byId = Object.fromEntries(rows.map((r) => [r.racer_id, r]));
    expect(byId.T.seed_points).toBe(54.75);
    expect(byId.Z.seed_points).toBe(97.33);
    expect(
      rows.some((r) => Object.keys(r).some((k) => k.endsWith('-penalty'))),
    ).toBe(false);
  });

  it('gives a non-starter the matched points without penalty, once per meeting', async () => {
    db.exec(
      `DELETE FROM race_results WHERE racer_id = 'Y' AND race_id IN ('GS2', 'SL3')`,
    );
    result('GS2', 1, 'Y', null, { ns: 1 });
    result('SL3', 1, 'Y', null, { ns: 1 });

    const afterGs2 = Object.fromEntries(
      (await fetchSeedList('C', ['SEED', 'SL1', 'GS2'])).map((r) => [
        r.racer_id,
        r,
      ]),
    );
    // Below the last GS2 finisher: last finisher's points (66.78) or own (79.22), no penalty
    expect(afterGs2.Y.GS2).toBe(79.22);
    expect(afterGs2.Y.seed_points).toBe(79.22);

    const afterSl3 = Object.fromEntries(
      (await fetchSeedList('C', ['SEED', 'SL1', 'GS2', 'SL3'])).map((r) => [
        r.racer_id,
        r,
      ]),
    );
    // Second non-start: the exception is spent, so last finisher (97.33) + 20%
    expect(afterSl3.Y.SL3).toBe(116.8);
    expect(afterSl3.Y.seed_points).toBe(98.01);
  });

  it('penalises a DNS with 20% or 10 points above the matched finisher', async () => {
    db.exec(
      `DELETE FROM race_results WHERE racer_id = 'Y' AND race_id = 'GS2'`,
    );
    result('GS2', 1, 'Y', null, { dns: 1 });
    const byId = Object.fromEntries(
      (await fetchSeedList('C', ['SEED', 'SL1', 'GS2'])).map((r) => [
        r.racer_id,
        r,
      ]),
    );
    expect(byId.Y.GS2).toBe(80.14);
    expect(byId.Y.seed_points).toBe(79.68);
  });
});
