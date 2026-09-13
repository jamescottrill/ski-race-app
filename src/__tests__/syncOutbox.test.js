/**
 * @jest-environment node
 */
const { createSchema } = require('../main/utils/migrations');
const { runOperation } = require('../main/operations');
const outbox = require('../main/sync/outbox');

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
const MEETING = '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4';

function openDatabase() {
  const db = new sqlite.DatabaseSync(':memory:');
  createSchema(db);
  db.prepare(
    `INSERT INTO competitions (id, competition_name, sync_enabled, remote_meeting_id) VALUES (?, 'Test', 1, ?)`,
  ).run(COMP, MEETING);
  db.prepare(
    `INSERT INTO races (competition_id, race_id, race_name, number_runs) VALUES (?, ?, 'GS', 2)`,
  ).run(COMP, RACE);
  [1, 2].forEach((run) =>
    db
      .prepare(
        `INSERT INTO race_run (competition_id, race_id, run_id, run_number, is_complete) VALUES (?, ?, ?, ?, 0)`,
      )
      .run(COMP, RACE, `${RACE}-run-${run}`, run),
  );
  ['A', 'B', 'C'].forEach((id, i) => {
    db.prepare(
      `INSERT INTO people (id, first_name, last_name) VALUES (?, ?, 'Racer')`,
    ).run(id, id);
    db.prepare(
      `INSERT INTO competition_competitor (competition_id, racer_id) VALUES (?, ?)`,
    ).run(COMP, id);
    db.prepare(
      `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number) VALUES (?, ?, ?, ?)`,
    ).run(COMP, RACE, id, i + 1);
  });
  return db;
}

const record = (db, racerId, time) =>
  runOperation(db, 'results.saveFields', {
    competitionId: COMP,
    raceId: RACE,
    runNumber: 1,
    racerId,
    fields: { race_time: time },
  });

const statuses = (db) =>
  db.prepare(`SELECT id, status, op FROM sync_events ORDER BY id`).all();

describeWithSqlite('sync outbox queries', () => {
  it('returns pending events in id order and stops at the byte cap', () => {
    const db = openDatabase();
    record(db, 'A', 60);
    record(db, 'B', 61);
    record(db, 'C', 62);
    const all = outbox.pendingBatch(db, COMP);
    expect(all.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(outbox.toEnvelopeEvent(all[0])).toMatchObject({
      event_id: 1,
      entity_type: 'result',
      operation: 'upsert',
      key: { race_id: RACE, run_number: 1, service_number: 'A' },
      data: { race_time: 60 },
    });
    // Each event is a few hundred bytes, so a 500 byte cap fits one
    expect(outbox.pendingBatch(db, COMP, { maxBytes: 500 })).toHaveLength(1);
    expect(outbox.pendingBatch(db, COMP, { maxEvents: 2 })).toHaveLength(2);
    expect(outbox.pendingBatch(db, 'other')).toEqual([]);
  });

  it('marks synced, dead and retried rows and counts them', () => {
    const db = openDatabase();
    record(db, 'A', 60);
    record(db, 'B', 61);
    record(db, 'C', 62);
    expect(outbox.markSynced(db, [1], '2026-01-05T10:00:00.000Z')).toBe(1);
    expect(outbox.markDead(db, [{ id: 2, error: 'bad' }], 'T')).toBe(1);
    expect(outbox.bumpAttempts(db, [3], 'HTTP 500', 'T')).toBe(1);
    expect(outbox.counts(db, COMP)).toEqual({
      pending: 1,
      synced: 1,
      dead: 1,
      superseded: 0,
    });
    expect(
      db
        .prepare(`SELECT attempts, last_error FROM sync_events WHERE id = 3`)
        .get(),
    ).toEqual({ attempts: 1, last_error: 'HTTP 500' });
    // Already-synced rows are never re-marked
    expect(outbox.markSynced(db, [1], 'T')).toBe(0);
    expect(outbox.retryEvents(db, [2])).toBe(1);
    expect(outbox.counts(db, COMP).pending).toBe(2);
    outbox.markDead(db, [{ id: 2, error: 'still bad' }], 'T');
    expect(outbox.discardEvents(db, [2])).toBe(1);
    expect(outbox.counts(db, COMP).superseded).toBe(1);
  });

  it('supersedes pending upserts but keeps pending deletes', () => {
    const db = openDatabase();
    record(db, 'A', 60);
    record(db, 'B', 61);
    // Locking run 1 withdraws a stale run-2 row: a pending delete
    db.prepare(
      `INSERT INTO race_results (competition_id, race_id, run_number, racer_id) VALUES (?, ?, 2, 'C')`,
    ).run(COMP, RACE);
    runOperation(db, 'results.setRunComplete', {
      competitionId: COMP,
      raceId: RACE,
      runNumber: 1,
      isComplete: true,
    });
    expect(outbox.supersedePendingUpserts(db, COMP)).toBeGreaterThan(0);
    const remaining = statuses(db).filter((row) => row.status === 'pending');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].op).toBe('delete');
  });

  it('keeps per-competition state and lists publishable competitions', () => {
    const db = openDatabase();
    expect(outbox.getState(db, COMP)).toBeNull();
    outbox.updateState(db, COMP, {
      last_synced_event_id: 7,
      last_success_at: 'T1',
      ignored: 'x',
    });
    outbox.updateState(db, COMP, { last_error: 'boom' });
    expect(outbox.getState(db, COMP)).toMatchObject({
      last_synced_event_id: 7,
      last_success_at: 'T1',
      last_error: 'boom',
    });
    expect(outbox.publishableCompetitions(db)).toEqual([
      { id: COMP, remote_meeting_id: MEETING },
    ]);
    db.prepare(`UPDATE competitions SET sync_enabled = 0`).run();
    expect(outbox.publishableCompetitions(db)).toEqual([]);
  });

  it('detects a restored backup from rewound outbox ids', () => {
    const db = openDatabase();
    record(db, 'A', 60);
    expect(outbox.detectRestore(db, COMP)).toBe(false);
    outbox.updateState(db, COMP, { last_synced_event_id: 1 });
    expect(outbox.detectRestore(db, COMP)).toBe(false);
    outbox.updateState(db, COMP, { last_synced_event_id: 40 });
    expect(outbox.detectRestore(db, COMP)).toBe(true);
  });

  it('pages the log newest first with a status filter', () => {
    const db = openDatabase();
    record(db, 'A', 60);
    record(db, 'B', 61);
    record(db, 'C', 62);
    outbox.markDead(db, [{ id: 2, error: 'bad' }], 'T');
    expect(outbox.logEvents(db, COMP).map((row) => row.id)).toEqual([3, 2, 1]);
    expect(
      outbox.logEvents(db, COMP, { status: 'dead' }).map((row) => row.id),
    ).toEqual([2]);
    expect(
      outbox
        .logEvents(db, COMP, { beforeId: 3, limit: 1 })
        .map((row) => row.id),
    ).toEqual([2]);
  });
});
