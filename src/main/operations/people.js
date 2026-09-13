const { requireFields } = require('./validate');
const { emit } = require('./events');

// Tables keyed on a person id. keyColumns are the rest of each table's
// primary key: where the target already has a row with the same key, the
// source's duplicate row is dropped instead of moved, which would otherwise
// abort the merge with a primary-key violation.
const RACER_TABLES = [
  {
    table: 'competition_competitor',
    column: 'racer_id',
    keyColumns: ['competition_id'],
  },
  {
    table: 'competition_team_members',
    column: 'racer_id',
    keyColumns: ['competition_id', 'team_id', 'race_id'],
  },
  {
    table: 'race_competitor',
    column: 'racer_id',
    keyColumns: ['competition_id', 'race_id'],
  },
  {
    table: 'race_results',
    column: 'racer_id',
    keyColumns: ['competition_id', 'race_id', 'run_number'],
  },
  {
    table: 'competition_final_seed_list',
    column: 'racer_id',
    keyColumns: ['competition_id'],
  },
  { table: 'aasl', column: 'service_number', keyColumns: ['season'] },
];
const RACE_OFFICIAL_COLUMNS = [
  'chief_of_race',
  'tech_delegate',
  'referee',
  'asst_referee',
];
const RUN_OFFICIAL_COLUMNS = [
  'course_setter',
  'forerunner_a',
  'forerunner_b',
  'forerunner_c',
  'forerunner_d',
];

/**
 * Move every reference from one person to another and delete the source.
 * payload: { sourceId, targetId }
 */
function merge(tx, payload) {
  const name = 'people.merge';
  requireFields(name, payload, ['sourceId', 'targetId']);
  const { sourceId, targetId } = payload;
  if (sourceId === targetId)
    throw new Error(`${name}: source and target are the same person`);
  [sourceId, targetId].forEach((id) => {
    if (!tx.get(`SELECT id FROM people WHERE id = ?`, [id])) {
      throw new Error(`${name}: person ${id} not found`);
    }
  });

  // Every meeting either person is entered in learns about the merge
  const competitions = tx
    .all(
      `SELECT DISTINCT competition_id FROM competition_competitor WHERE racer_id IN (?, ?)`,
      [sourceId, targetId],
    )
    .map((row) => row.competition_id);

  RACER_TABLES.forEach(({ table, column, keyColumns }) => {
    const keyMatch = keyColumns
      .map((k) => `t2.${k} IS ${table}.${k}`)
      .join(' AND ');
    tx.run(
      `DELETE FROM ${table} WHERE ${column} = ?
       AND EXISTS (SELECT 1 FROM ${table} t2 WHERE t2.${column} = ? AND ${keyMatch})`,
      [sourceId, targetId],
    );
    tx.run(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [
      targetId,
      sourceId,
    ]);
  });
  RACE_OFFICIAL_COLUMNS.forEach((column) =>
    tx.run(`UPDATE races SET ${column} = ? WHERE ${column} = ?`, [
      targetId,
      sourceId,
    ]),
  );
  RUN_OFFICIAL_COLUMNS.forEach((column) =>
    tx.run(`UPDATE race_run SET ${column} = ? WHERE ${column} = ?`, [
      targetId,
      sourceId,
    ]),
  );
  tx.run(`DELETE FROM people WHERE id = ?`, [sourceId]);
  competitions.forEach((competitionId) =>
    emit(tx, {
      competitionId,
      entityType: 'competitor_merge',
      key: {
        source_service_number: sourceId,
        target_service_number: targetId,
      },
      op: 'upsert',
      payload: {},
      operation: name,
    }),
  );
  return { success: true };
}

module.exports = { merge };
