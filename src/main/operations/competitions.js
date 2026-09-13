/**
 * Competition operations: create a competition and edit its details.
 */
const { randomUUID } = require('crypto');
const { requireFields } = require('./validate');
const { emitEntity } = require('./events');
const {
  COMPETITION_LEVELS,
  isValidSeason,
} = require('../../shared/competition');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Columns the settings page may change; anything else is rejected
const UPDATABLE_COLUMNS = [
  'competition_name',
  'competition_description',
  'level',
  'season',
  'start_date',
  'end_date',
  'venue',
  'sync_enabled',
  'remote_meeting_id',
];

const isSet = (value) => value !== undefined && value !== null && value !== '';

// Checks the metadata columns of a full row (existing values merged with the
// change), so an update of one date is still validated against the other.
function validateMetadata(name, row) {
  if (isSet(row.level) && !COMPETITION_LEVELS.includes(row.level)) {
    throw new Error(
      `${name}: level must be one of ${COMPETITION_LEVELS.join(', ')}`,
    );
  }
  if (isSet(row.season) && !isValidSeason(row.season)) {
    throw new Error(`${name}: season must look like 2025-26`);
  }
  ['start_date', 'end_date'].forEach((column) => {
    if (isSet(row[column]) && !DATE_PATTERN.test(row[column])) {
      throw new Error(`${name}: ${column} must be a date (YYYY-MM-DD)`);
    }
  });
  if (
    isSet(row.start_date) &&
    isSet(row.end_date) &&
    row.end_date < row.start_date
  ) {
    throw new Error(`${name}: end_date is before start_date`);
  }
}

const blankToNull = (value) => (isSet(value) ? value : null);

/**
 * Create a competition. The id is generated unless one is supplied.
 * payload: { competitionId?, name, description?, level, season, startDate?,
 *   endDate?, venue? }
 */
function create(tx, payload) {
  const name = 'competitions.create';
  requireFields(name, payload, ['name', 'level', 'season']);
  const row = {
    level: payload.level,
    season: payload.season,
    start_date: blankToNull(payload.startDate),
    end_date: blankToNull(payload.endDate),
  };
  validateMetadata(name, row);

  const competitionId = payload.competitionId || randomUUID();
  tx.run(
    `INSERT INTO competitions (id, competition_name, competition_description, level, season,
       start_date, end_date, venue, sync_enabled, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      competitionId,
      payload.name,
      blankToNull(payload.description),
      row.level,
      row.season,
      row.start_date,
      row.end_date,
      blankToNull(payload.venue),
      new Date().toISOString(),
    ],
  );
  emitEntity(tx, {
    competitionId,
    entityType: 'meeting',
    key: {},
    operation: name,
  });
  return { success: true, competitionId };
}

/**
 * Change one or more columns of a competition.
 * payload: { competitionId, fields: { competition_name?, level?, ... } }
 */
function update(tx, payload) {
  const name = 'competitions.update';
  requireFields(name, payload, ['competitionId']);
  const fields = payload.fields || {};
  const columns = Object.keys(fields);
  const unknown = columns.filter(
    (column) => !UPDATABLE_COLUMNS.includes(column),
  );
  if (unknown.length > 0) {
    throw new Error(`${name}: unknown column(s) ${unknown.join(', ')}`);
  }
  if (columns.length === 0) {
    throw new Error(`${name}: no columns given`);
  }
  if ('competition_name' in fields && !isSet(fields.competition_name)) {
    throw new Error(`${name}: competition_name cannot be blank`);
  }

  const current = tx.get(`SELECT * FROM competitions WHERE id = ?`, [
    payload.competitionId,
  ]);
  if (!current) {
    throw new Error(`${name}: competition ${payload.competitionId} not found`);
  }
  const values = {};
  columns.forEach((column) => {
    values[column] = blankToNull(fields[column]);
  });
  if ('sync_enabled' in values) {
    // Stored as 0/1; the renderer sends a boolean
    values.sync_enabled = fields.sync_enabled ? 1 : 0;
  }
  validateMetadata(name, { ...current, ...values });

  const assignments = columns.map((column) => `${column} = ?`);
  tx.run(
    `UPDATE competitions SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`,
    [
      ...columns.map((column) => values[column]),
      new Date().toISOString(),
      payload.competitionId,
    ],
  );
  emitEntity(tx, {
    competitionId: payload.competitionId,
    entityType: 'meeting',
    key: {},
    operation: name,
  });
  return { success: true };
}

module.exports = { create, update, UPDATABLE_COLUMNS };
