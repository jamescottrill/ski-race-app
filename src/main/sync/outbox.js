/**
 * Queries over the sync outbox (sync_events) and the per-competition sync
 * state. Pure functions over a raw database handle (better-sqlite3 in the
 * app, node:sqlite in tests), so the worker holds no SQL of its own.
 */
const MAX_BATCH_EVENTS = 500;
const MAX_BATCH_BYTES = 1000000;
// Envelope overhead per event beyond its key and payload
const EVENT_OVERHEAD_BYTES = 200;

const placeholders = (items) => items.map(() => '?').join(', ');

/** Pending events for a competition in id order, capped by count and size. */
function pendingBatch(
  db,
  competitionId,
  { maxEvents = MAX_BATCH_EVENTS, maxBytes = MAX_BATCH_BYTES } = {},
) {
  const rows = db
    .prepare(
      `SELECT id, entity_type, entity_key, op, payload, created_at, attempts
       FROM sync_events
       WHERE competition_id = ? AND status = 'pending'
       ORDER BY id LIMIT ?`,
    )
    .all(competitionId, maxEvents);
  const batch = [];
  let bytes = 0;
  rows.every((row) => {
    const size =
      row.entity_key.length +
      (row.payload ? row.payload.length : 0) +
      EVENT_OVERHEAD_BYTES;
    // Always send at least one event, otherwise an oversized one blocks the queue
    if (batch.length > 0 && bytes + size > maxBytes) return false;
    batch.push(row);
    bytes += size;
    return true;
  });
  return batch;
}

/** A sync_events row in the shape the contract's envelope carries. */
function toEnvelopeEvent(row) {
  return {
    event_id: row.id,
    entity_type: row.entity_type,
    operation: row.op,
    key: JSON.parse(row.entity_key),
    data: row.payload ? JSON.parse(row.payload) : null,
    occurred_at: row.created_at,
  };
}

function markSynced(db, ids, at) {
  if (ids.length === 0) return 0;
  return db
    .prepare(
      `UPDATE sync_events SET status = 'synced', synced_at = ?, last_error = NULL
       WHERE id IN (${placeholders(ids)}) AND status = 'pending'`,
    )
    .run(at, ...ids).changes;
}

function markDead(db, entries, at) {
  const statement = db.prepare(
    `UPDATE sync_events
     SET status = 'dead', last_error = ?, last_attempt_at = ?, attempts = attempts + 1
     WHERE id = ? AND status = 'pending'`,
  );
  return entries.reduce(
    (count, { id, error }) =>
      count + statement.run(String(error), at, id).changes,
    0,
  );
}

function bumpAttempts(db, ids, error, at) {
  if (ids.length === 0) return 0;
  return db
    .prepare(
      `UPDATE sync_events
       SET attempts = attempts + 1, last_error = ?, last_attempt_at = ?
       WHERE id IN (${placeholders(ids)})`,
    )
    .run(String(error), at, ...ids).changes;
}

// A full snapshot restates every row, so pending upserts are redundant; a
// pending delete still has to reach the service
function supersedePendingUpserts(db, competitionId) {
  return db
    .prepare(
      `UPDATE sync_events SET status = 'superseded'
       WHERE competition_id = ? AND status = 'pending' AND op = 'upsert'`,
    )
    .run(competitionId).changes;
}

function retryEvents(db, ids) {
  if (ids.length === 0) return 0;
  return db
    .prepare(
      `UPDATE sync_events SET status = 'pending', last_error = NULL
       WHERE id IN (${placeholders(ids)}) AND status = 'dead'`,
    )
    .run(...ids).changes;
}

function discardEvents(db, ids) {
  if (ids.length === 0) return 0;
  return db
    .prepare(
      `UPDATE sync_events SET status = 'superseded'
       WHERE id IN (${placeholders(ids)}) AND status = 'dead'`,
    )
    .run(...ids).changes;
}

function counts(db, competitionId) {
  const totals = { pending: 0, synced: 0, dead: 0, superseded: 0 };
  db.prepare(
    `SELECT status, COUNT(*) AS n FROM sync_events WHERE competition_id = ? GROUP BY status`,
  )
    .all(competitionId)
    .forEach(({ status, n }) => {
      totals[status] = n;
    });
  return totals;
}

function logEvents(
  db,
  competitionId,
  { status = null, limit = 100, beforeId = null } = {},
) {
  return db
    .prepare(
      `SELECT id, entity_type, entity_key, op, payload, source_operation, snapshot_id,
              status, attempts, last_attempt_at, last_error, created_at, synced_at
       FROM sync_events
       WHERE competition_id = ?
         AND (? IS NULL OR status = ?)
         AND (? IS NULL OR id < ?)
       ORDER BY id DESC LIMIT ?`,
    )
    .all(competitionId, status, status, beforeId, beforeId, limit);
}

const STATE_COLUMNS = [
  'last_synced_event_id',
  'last_success_at',
  'last_error',
  'last_error_at',
  'last_snapshot_id',
  'last_snapshot_at',
];

function getState(db, competitionId) {
  return (
    db
      .prepare(`SELECT * FROM sync_state WHERE competition_id = ?`)
      .get(competitionId) || null
  );
}

function updateState(db, competitionId, patch) {
  const columns = Object.keys(patch).filter((column) =>
    STATE_COLUMNS.includes(column),
  );
  if (columns.length === 0) return;
  db.prepare(
    `INSERT INTO sync_state (competition_id, ${columns.join(', ')})
     VALUES (?, ${placeholders(columns)})
     ON CONFLICT(competition_id) DO UPDATE SET
       ${columns.map((column) => `${column} = excluded.${column}`).join(', ')}`,
  ).run(competitionId, ...columns.map((column) => patch[column]));
}

/** Competitions the worker may push: sync switched on and bound to a meeting. */
function publishableCompetitions(db) {
  return db
    .prepare(
      `SELECT id, remote_meeting_id FROM competitions
       WHERE sync_enabled = 1 AND remote_meeting_id IS NOT NULL AND remote_meeting_id <> ''`,
    )
    .all();
}

function competition(db, competitionId) {
  return (
    db
      .prepare(
        `SELECT id, remote_meeting_id, sync_enabled, level, season FROM competitions WHERE id = ?`,
      )
      .get(competitionId) || null
  );
}

// Outbox ids only ever grow, so a highest id below what the service already
// acknowledged means a backup was restored over the outbox
function detectRestore(db, competitionId) {
  const state = getState(db, competitionId);
  if (!state || !state.last_synced_event_id) return false;
  const { maxId } = db
    .prepare(`SELECT MAX(id) AS maxId FROM sync_events`)
    .get();
  return (maxId || 0) < state.last_synced_event_id;
}

module.exports = {
  MAX_BATCH_EVENTS,
  MAX_BATCH_BYTES,
  pendingBatch,
  toEnvelopeEvent,
  markSynced,
  markDead,
  bumpAttempts,
  supersedePendingUpserts,
  retryEvents,
  discardEvents,
  counts,
  logEvents,
  getState,
  updateState,
  publishableCompetitions,
  competition,
  detectRestore,
};
