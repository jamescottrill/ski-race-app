/**
 * Full snapshot of a competition into the sync outbox: every entity the
 * central service mirrors, restated in parent-first order under one snapshot
 * id, ending with a marker. Used when publishing is first switched on, when
 * the organiser asks to publish everything again, and after a backup
 * restore. Pending upserts are superseded first (the snapshot restates them);
 * pending deletes are kept.
 */
const { randomUUID } = require('crypto');
const { requireFields } = require('./validate');
const { emit, emitEntity } = require('./events');

function snapshotCompetition(tx, payload) {
  const name = 'sync.snapshotCompetition';
  requireFields(name, payload, ['competitionId']);
  const { competitionId } = payload;
  if (!tx.get(`SELECT id FROM competitions WHERE id = ?`, [competitionId])) {
    throw new Error(`${name}: competition ${competitionId} not found`);
  }
  const snapshotId = randomUUID();
  tx.run(
    `UPDATE sync_events SET status = 'superseded'
     WHERE competition_id = ? AND status = 'pending' AND op = 'upsert'`,
    [competitionId],
  );

  const counts = {};
  const publish = (entityType, key) => {
    emitEntity(tx, {
      competitionId,
      entityType,
      key,
      operation: name,
      snapshotId,
    });
    counts[entityType] = (counts[entityType] || 0) + 1;
  };

  publish('meeting', {});

  // Only entries whose person exists can be described; the service needs
  // the competitor before the entry
  const entries = tx.all(
    `SELECT cc.racer_id FROM competition_competitor cc
     JOIN people p ON p.id = cc.racer_id
     WHERE cc.competition_id = ? ORDER BY cc.racer_id`,
    [competitionId],
  );
  entries.forEach(({ racer_id: id }) =>
    publish('competitor', { service_number: id }),
  );
  entries.forEach(({ racer_id: id }) =>
    publish('meeting_entry', { service_number: id }),
  );

  tx.all(
    `SELECT team_id FROM competition_team WHERE competition_id = ? ORDER BY team_id`,
    [competitionId],
  ).forEach(({ team_id: teamId }) => publish('team', { team_id: teamId }));
  tx.all(
    `SELECT DISTINCT team_id, race_id FROM competition_team_members
     WHERE competition_id = ? ORDER BY team_id, race_id`,
    [competitionId],
  ).forEach(({ team_id: teamId, race_id: raceId }) =>
    publish('team_members', { team_id: teamId, race_id: raceId ?? null }),
  );

  tx.all(
    `SELECT race_id FROM races WHERE competition_id = ? ORDER BY race_date, race_id`,
    [competitionId],
  ).forEach(({ race_id: raceId }) => publish('race', { race_id: raceId }));
  tx.all(
    `SELECT race_id, run_number FROM race_run WHERE competition_id = ? ORDER BY race_id, run_number`,
    [competitionId],
  ).forEach(({ race_id: raceId, run_number: runNumber }) =>
    publish('race_run', { race_id: raceId, run_number: runNumber }),
  );
  tx.all(
    `SELECT DISTINCT race_id FROM race_competitor WHERE competition_id = ? ORDER BY race_id`,
    [competitionId],
  ).forEach(({ race_id: raceId }) =>
    publish('start_list', { race_id: raceId }),
  );
  tx.all(
    `SELECT race_id, run_number, racer_id FROM race_results
     WHERE competition_id = ? ORDER BY race_id, run_number, racer_id`,
    [competitionId],
  ).forEach(({ race_id: raceId, run_number: runNumber, racer_id: id }) =>
    publish('result', {
      race_id: raceId,
      run_number: runNumber,
      service_number: id,
    }),
  );

  emit(tx, {
    competitionId,
    entityType: 'snapshot_marker',
    key: { snapshot_id: snapshotId },
    op: 'upsert',
    payload: { counts },
    operation: name,
    snapshotId,
  });
  tx.run(
    `INSERT INTO sync_state (competition_id, last_snapshot_id, last_snapshot_at) VALUES (?, ?, ?)
     ON CONFLICT(competition_id) DO UPDATE SET
       last_snapshot_id = excluded.last_snapshot_id, last_snapshot_at = excluded.last_snapshot_at`,
    [competitionId, snapshotId, new Date().toISOString()],
  );
  return { success: true, snapshotId, counts };
}

module.exports = { snapshotCompetition };
