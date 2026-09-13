/**
 * Results operations. Every write here also appends to the sync outbox
 * inside the same transaction, so the outbox can never disagree with the
 * results (see ./events.js).
 */
const { requireFields, requireList } = require('./validate');
const { emitEntity, emitDelete } = require('./events');

const RESULT_COLUMNS = [
  'race_time',
  'is_dnf',
  'is_dsq',
  'is_dns',
  'is_ns',
  'dsq_gate',
  'dsq_reason',
];
const STATUS_CODES = ['DNF', 'DSQ', 'DNS', 'NS'];

function upsertResult(
  tx,
  operation,
  { competitionId, raceId, runNumber, racerId, fields },
) {
  const columns = Object.keys(fields || {});
  const unknown = columns.filter((column) => !RESULT_COLUMNS.includes(column));
  if (unknown.length > 0) {
    throw new Error(`${operation}: unknown column(s) ${unknown.join(', ')}`);
  }
  if (columns.length === 0) {
    throw new Error(`${operation}: no result columns given`);
  }
  tx.run(
    `INSERT INTO race_results (competition_id, race_id, run_number, racer_id, ${columns.join(', ')})
     VALUES (?, ?, ?, ?, ${columns.map(() => '?').join(', ')})
     ON CONFLICT(competition_id, race_id, run_number, racer_id)
     DO UPDATE SET ${columns.map((column) => `${column} = excluded.${column}`).join(', ')}`,
    [
      competitionId,
      raceId,
      runNumber,
      racerId,
      ...columns.map((column) => fields[column] ?? null),
    ],
  );
}

const resultKey = ({ raceId, runNumber, racerId }) => ({
  race_id: raceId,
  run_number: Number(runNumber),
  service_number: racerId,
});
const runKey = ({ raceId, runNumber }) => ({
  race_id: raceId,
  run_number: Number(runNumber),
});

function runIsComplete(tx, { competitionId, raceId, runNumber }) {
  const run = tx.get(
    `SELECT is_complete FROM race_run WHERE competition_id = ? AND race_id = ? AND run_number = ?`,
    [competitionId, raceId, runNumber],
  );
  return Boolean(run && run.is_complete);
}

/**
 * Save one or more race_results columns for a competitor, creating the row
 * if it does not exist yet.
 * payload: { competitionId, raceId, runNumber, racerId, fields }
 */
function saveFields(tx, payload) {
  const name = 'results.saveFields';
  requireFields(name, payload, [
    'competitionId',
    'raceId',
    'runNumber',
    'racerId',
  ]);
  upsertResult(tx, name, payload);
  emitEntity(tx, {
    competitionId: payload.competitionId,
    entityType: 'result',
    key: resultKey(payload),
    operation: name,
  });
  return { success: true };
}

/**
 * Course details for one run.
 * payload: { competitionId, raceId, runNumber, details: { courseSetter, numberGates,
 *   turningGates, startTime, forerunner1..4 } }
 */
function saveRunDetails(tx, payload) {
  const name = 'results.saveRunDetails';
  requireFields(name, payload, ['competitionId', 'raceId', 'runNumber']);
  const d = payload.details || {};
  const result = tx.run(
    `UPDATE race_run
     SET course_setter = ?, number_gates = ?, turning_gates = ?, start_time = ?,
         forerunner_a = ?, forerunner_b = ?, forerunner_c = ?, forerunner_d = ?
     WHERE competition_id = ? AND race_id = ? AND run_number = ?`,
    [
      d.courseSetter || null,
      d.numberGates || null,
      d.turningGates || null,
      d.startTime || null,
      d.forerunner1 || null,
      d.forerunner2 || null,
      d.forerunner3 || null,
      d.forerunner4 || null,
      payload.competitionId,
      payload.raceId,
      payload.runNumber,
    ],
  );
  if (result.changes === 0) {
    throw new Error(`${name}: run ${payload.runNumber} not found`);
  }
  emitEntity(tx, {
    competitionId: payload.competitionId,
    entityType: 'race_run',
    key: runKey(payload),
    operation: name,
  });
  return { success: true };
}

const finishedRun = (row) =>
  row.race_time !== null &&
  row.race_time !== undefined &&
  !row.is_dns &&
  !row.is_dnf &&
  !row.is_dsq &&
  !row.is_ns;

// Rebuild the following run's rows from this run's recorded results: in a
// seeding race everyone advances, otherwise only those with a time and no
// DNS/DNF/DSQ/NS. Existing rows for advancing competitors are kept, so an
// unlock-and-relock never wipes times already entered for the next run.
function rebuildNextRun(
  tx,
  { competitionId, raceId, runNumber, nextRun, isSeeding, operation },
) {
  const entrants =
    runNumber === 1
      ? tx.all(
          `SELECT rc.racer_id, rr.race_time, rr.is_dns, rr.is_dnf, rr.is_dsq, rr.is_ns
           FROM race_competitor rc
           LEFT JOIN race_results rr ON rr.competition_id = rc.competition_id AND rr.race_id = rc.race_id
                                    AND rr.racer_id = rc.racer_id AND rr.run_number = 1
           WHERE rc.competition_id = ? AND rc.race_id = ?`,
          [competitionId, raceId],
        )
      : tx.all(
          `SELECT racer_id, race_time, is_dns, is_dnf, is_dsq, is_ns
           FROM race_results WHERE competition_id = ? AND race_id = ? AND run_number = ?`,
          [competitionId, raceId, runNumber],
        );
  const advancing = entrants.filter((row) => isSeeding || finishedRun(row));
  const dropped = isSeeding ? [] : entrants.filter((row) => !finishedRun(row));

  dropped.forEach((row) => {
    const deleted = tx.run(
      `DELETE FROM race_results WHERE competition_id = ? AND race_id = ? AND run_number = ? AND racer_id = ?`,
      [competitionId, raceId, nextRun, row.racer_id],
    );
    if (deleted.changes > 0) {
      emitDelete(tx, {
        competitionId,
        entityType: 'result',
        key: resultKey({ raceId, runNumber: nextRun, racerId: row.racer_id }),
        operation,
      });
    }
  });
  advancing.forEach((row) => {
    const inserted = tx.run(
      `INSERT OR IGNORE INTO race_results (competition_id, race_id, run_number, racer_id) VALUES (?, ?, ?, ?)`,
      [competitionId, raceId, nextRun, row.racer_id],
    );
    if (inserted.changes > 0) {
      emitEntity(tx, {
        competitionId,
        entityType: 'result',
        key: resultKey({ raceId, runNumber: nextRun, racerId: row.racer_id }),
        operation,
      });
    }
  });
  return { advanced: advancing.length, removed: dropped.length };
}

/**
 * Lock (isComplete: true) or unlock a run. When the race has a following
 * run, its result rows are rebuilt from the database at the same time.
 * payload: { competitionId, raceId, runNumber, isComplete }
 */
function setRunComplete(tx, payload) {
  const name = 'results.setRunComplete';
  requireFields(name, payload, ['competitionId', 'raceId', 'runNumber']);
  const { competitionId, raceId } = payload;
  const runNumber = Number(payload.runNumber);
  const isComplete = payload.isComplete ? 1 : 0;

  const updated = tx.run(
    `UPDATE race_run SET is_complete = ? WHERE competition_id = ? AND race_id = ? AND run_number = ?`,
    [isComplete, competitionId, raceId, runNumber],
  );
  if (updated.changes === 0) {
    throw new Error(`${name}: run ${runNumber} not found`);
  }

  const race = tx.get(
    `SELECT number_runs, is_seeding FROM races WHERE competition_id = ? AND race_id = ?`,
    [competitionId, raceId],
  );
  const nextRun = runNumber + 1;
  let nextRunChanges = null;
  if (race && nextRun <= (race.number_runs || 1)) {
    nextRunChanges = rebuildNextRun(tx, {
      competitionId,
      raceId,
      runNumber,
      nextRun,
      isSeeding: Boolean(race.is_seeding),
      operation: name,
    });
  }

  // The lock itself goes last: the service derives the race status from it
  // once the next run's rows are in place
  emitEntity(tx, {
    competitionId,
    entityType: 'race_run',
    key: runKey({ raceId, runNumber }),
    operation: name,
  });
  return { success: true, nextRun: nextRunChanges };
}

/**
 * Import results for many competitors atomically. Refuses to touch a run
 * that is marked complete; unlock it first.
 * payload: { competitionId, raceId, results: [{ racerId, runNumber, time, status }] }
 */
function importBatch(tx, payload) {
  const name = 'results.importBatch';
  requireFields(name, payload, ['competitionId', 'raceId']);
  const results = requireList(name, payload, 'results');
  const { competitionId, raceId } = payload;

  const runNumbers = [...new Set(results.map((r) => Number(r.runNumber)))].sort(
    (a, b) => a - b,
  );
  runNumbers.forEach((runNumber) => {
    if (!runNumber) throw new Error(`${name}: each result needs a runNumber`);
    if (runIsComplete(tx, { competitionId, raceId, runNumber })) {
      throw new Error(
        `${name}: run ${runNumber} is marked complete; unlock it before importing`,
      );
    }
    const created = tx.run(
      `INSERT OR IGNORE INTO race_run (competition_id, race_id, run_id, run_number, is_complete) VALUES (?, ?, ?, ?, 0)`,
      [competitionId, raceId, `${raceId}-run-${runNumber}`, runNumber],
    );
    if (created.changes > 0) {
      emitEntity(tx, {
        competitionId,
        entityType: 'race_run',
        key: runKey({ raceId, runNumber }),
        operation: name,
      });
    }
  });

  results.forEach(({ racerId, runNumber, time, status }) => {
    if (!racerId) throw new Error(`${name}: each result needs a racerId`);
    if (status && !STATUS_CODES.includes(status)) {
      throw new Error(`${name}: unknown status "${status}"`);
    }
    const fields = {
      // A non-finish never keeps a time, so a split can't become a result
      race_time: status ? null : (time ?? null),
      is_dnf: status === 'DNF' ? 1 : 0,
      is_dsq: status === 'DSQ' ? 1 : 0,
      is_dns: status === 'DNS' ? 1 : 0,
      is_ns: status === 'NS' ? 1 : 0,
    };
    if (status !== 'DSQ') {
      fields.dsq_gate = null;
      fields.dsq_reason = null;
    }
    const target = {
      competitionId,
      raceId,
      runNumber: Number(runNumber),
      racerId,
    };
    upsertResult(tx, name, { ...target, fields });
    emitEntity(tx, {
      competitionId,
      entityType: 'result',
      key: resultKey(target),
      operation: name,
    });
  });

  return { success: true, imported: results.length, runs: runNumbers };
}

module.exports = {
  saveFields,
  saveRunDetails,
  setRunComplete,
  importBatch,
  RESULT_COLUMNS,
};
