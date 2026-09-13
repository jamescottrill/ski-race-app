/**
 * @jest-environment node
 */
const { validateEvent } = require('@awsa/sync-contract');
const { createSchema } = require('../main/utils/migrations');
const { runOperation } = require('../main/operations');

let sqlite = null;
try {
  // eslint-disable-next-line global-require
  sqlite = require('node:sqlite');
} catch (error) {
  sqlite = null;
}
const describeWithSqlite = sqlite ? describe : describe.skip;

const COMP = 'comp';
const RACE = 'race';

function openDatabase() {
  const db = new sqlite.DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF'); // as the app runs
  createSchema(db);
  db.prepare(
    `INSERT INTO competitions (id, competition_name, level, season, venue) VALUES (?, 'Corps meeting', 'corps', '2025-26', 'Serre Chevalier')`,
  ).run(COMP);
  db.prepare(
    `INSERT INTO races (competition_id, race_id, race_name, race_type, number_runs, race_date) VALUES (?, ?, 'GS', 'GS', 2, '2026-01-05')`,
  ).run(COMP, RACE);
  [1, 2].forEach((run) =>
    db
      .prepare(
        `INSERT INTO race_run (competition_id, race_id, run_id, run_number, is_complete) VALUES (?, ?, ?, ?, 0)`,
      )
      .run(COMP, RACE, `${RACE}-run-${run}`, run),
  );
  ['A', 'B'].forEach((id, i) => {
    db.prepare(
      `INSERT INTO people (id, first_name, last_name, gender) VALUES (?, ?, 'Racer', 'M')`,
    ).run(id, id);
    db.prepare(
      `INSERT INTO competition_competitor (competition_id, racer_id, regiment) VALUES (?, ?, '1 RHA')`,
    ).run(COMP, id);
    db.prepare(
      `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number) VALUES (?, ?, ?, ?)`,
    ).run(COMP, RACE, id, i + 1);
  });
  // An entry whose person is unknown cannot be described and is skipped
  db.prepare(
    `INSERT INTO competition_competitor (competition_id, racer_id) VALUES (?, 'ghost')`,
  ).run(COMP);
  db.prepare(
    `INSERT INTO competition_team (competition_id, team_id, team_name) VALUES (?, 't1', '1 RHA A')`,
  ).run(COMP);
  db.prepare(
    `INSERT INTO competition_team_members (competition_id, team_id, race_id, racer_id) VALUES (?, 't1', NULL, 'A'), (?, 't1', ?, 'B')`,
  ).run(COMP, COMP, RACE);
  return db;
}

const events = (db) =>
  db
    .prepare(
      `SELECT id, entity_type, entity_key, op, payload, status, snapshot_id, source_operation, created_at
       FROM sync_events ORDER BY id`,
    )
    .all()
    .map((row) => ({
      ...row,
      entity_key: JSON.parse(row.entity_key),
      payload: row.payload ? JSON.parse(row.payload) : null,
    }));

describeWithSqlite('sync.snapshotCompetition', () => {
  it('restates the whole competition parent-first under one snapshot id', () => {
    const db = openDatabase();
    runOperation(db, 'results.saveFields', {
      competitionId: COMP,
      raceId: RACE,
      runNumber: 1,
      racerId: 'A',
      fields: { race_time: 60 },
    });
    const before = events(db);
    expect(before).toHaveLength(1);

    const result = runOperation(db, 'sync.snapshotCompetition', {
      competitionId: COMP,
    });

    expect(result.success).toBe(true);
    expect(result.counts).toEqual({
      meeting: 1,
      competitor: 2,
      meeting_entry: 2,
      team: 1,
      team_members: 2,
      race: 1,
      race_run: 2,
      start_list: 1,
      result: 1,
    });
    const all = events(db);
    // The earlier pending upsert is superseded by the snapshot
    expect(all[0]).toMatchObject({ id: 1, status: 'superseded' });
    const snapshot = all.slice(1);
    expect(snapshot.map((e) => e.entity_type)).toEqual([
      'meeting',
      'competitor',
      'competitor',
      'meeting_entry',
      'meeting_entry',
      'team',
      'team_members',
      'team_members',
      'race',
      'race_run',
      'race_run',
      'start_list',
      'result',
      'snapshot_marker',
    ]);
    snapshot.forEach((e) => {
      expect(e.status).toBe('pending');
      expect(e.snapshot_id).toBe(result.snapshotId);
      expect(e.source_operation).toBe('sync.snapshotCompetition');
      expect(() =>
        validateEvent({
          event_id: e.id,
          entity_type: e.entity_type,
          operation: e.op,
          key: e.entity_key,
          data: e.payload,
          occurred_at: e.created_at,
        }),
      ).not.toThrow();
    });
    const marker = snapshot.at(-1);
    expect(marker.entity_key).toEqual({ snapshot_id: result.snapshotId });
    expect(marker.payload).toEqual({ counts: result.counts });
    expect(
      snapshot
        .filter((e) => e.entity_type === 'team_members')
        .map((e) => e.entity_key),
    ).toEqual([
      { team_id: 't1', race_id: null },
      { team_id: 't1', race_id: RACE },
    ]);
    expect(
      db
        .prepare(
          `SELECT last_snapshot_id FROM sync_state WHERE competition_id = ?`,
        )
        .get(COMP),
    ).toEqual({ last_snapshot_id: result.snapshotId });
  });

  it('keeps pending deletes and refuses an unknown competition', () => {
    const db = openDatabase();
    runOperation(db, 'results.saveFields', {
      competitionId: COMP,
      raceId: RACE,
      runNumber: 1,
      racerId: 'B',
      fields: { is_dnf: 1 },
    });
    db.prepare(
      `INSERT INTO race_results (competition_id, race_id, run_number, racer_id) VALUES (?, ?, 2, 'B')`,
    ).run(COMP, RACE);
    runOperation(db, 'results.setRunComplete', {
      competitionId: COMP,
      raceId: RACE,
      runNumber: 1,
      isComplete: true,
    });
    runOperation(db, 'sync.snapshotCompetition', { competitionId: COMP });
    const pendingDeletes = events(db).filter(
      (e) => e.status === 'pending' && e.op === 'delete',
    );
    expect(pendingDeletes).toHaveLength(1);
    expect(() =>
      runOperation(db, 'sync.snapshotCompetition', { competitionId: 'nope' }),
    ).toThrow('competition nope not found');
  });
});
