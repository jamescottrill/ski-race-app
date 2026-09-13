/**
 * Schema migrations driven by PRAGMA user_version.
 *
 * TABLE_SCHEMAS (schema.js) is frozen as the version 1 baseline: a fresh
 * database is created from it, then every migration below is applied in
 * order. An existing database only receives the migrations it has not seen,
 * so fresh and upgraded databases end up identical by construction. Every
 * change to the schema after version 1 is a new entry in MIGRATIONS, never
 * an edit to TABLE_SCHEMAS.
 *
 * Each migration runs inside one transaction together with the bump of
 * user_version, so a failure rolls the whole step back and the next start
 * retries it from the same point.
 *
 * Kept free of Electron and driver-specific helpers (no better-sqlite3
 * .pragma()) so the same code runs in the app and under node:sqlite in tests.
 */
const { TABLE_SCHEMAS } = require('./schema');
const { createTx, runInTransaction } = require('../operations');

// Columns that were added to TABLE_SCHEMAS after databases had already been
// created; CREATE TABLE IF NOT EXISTS never alters an existing table
const BASELINE_COLUMNS = [
  { table: 'races', column: 'flip_count', ddl: 'INTEGER DEFAULT 15' },
  { table: 'races', column: 'flip_count_women', ddl: 'INTEGER DEFAULT 5' },
  { table: 'competition_team', column: 'team_type', ddl: 'TEXT' },
  { table: 'competition_competitor', column: 'training_group', ddl: 'INTEGER' },
];

// Earlier versions declared foreign keys against non-unique parent columns
// (e.g. race_results.run_number -> race_run.run_number, where race_run's key
// is composite). SQLite reports these as "foreign key mismatch" and, with
// enforcement on, refuses to prepare any insert or delete against the child
// table. A SINGLE-column foreign key to one of these parents is invalid; the
// corrected composite keys also reference them but with several columns.
const INVALID_PARENT_REFS = new Set([
  'races.race_id',
  'race_run.run_number',
  'competition_team.team_id',
]);
const FK_REPAIR_CANDIDATES = [
  'competition_team_members',
  'race_run',
  'race_competitor',
  'race_results',
];

function tableColumns(db, table) {
  return db
    .prepare('SELECT name FROM pragma_table_info(?)')
    .all(table)
    .map((column) => column.name);
}

function foreignKeys(db, table) {
  return db.prepare('SELECT * FROM pragma_foreign_key_list(?)').all(table);
}

function hasColumn(db, table, column) {
  return tableColumns(db, table).includes(column);
}

function addColumnIfMissing(db, { table, column, ddl }) {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

// Standard SQLite table rebuild: create the corrected table under a
// temporary name, copy every shared column across, then swap it in. The
// caller supplies the transaction, so a failure leaves the original intact.
function rebuildTable(db, table) {
  const createSql = TABLE_SCHEMAS[table].replace(
    `CREATE TABLE IF NOT EXISTS ${table}`,
    `CREATE TABLE ${table}_rebuild`,
  );
  db.exec(`DROP TABLE IF EXISTS ${table}_rebuild`);
  db.exec(createSql);
  const newColumns = tableColumns(db, `${table}_rebuild`);
  const shared = tableColumns(db, table)
    .filter((column) => newColumns.includes(column))
    .join(', ');
  db.exec(
    `INSERT INTO ${table}_rebuild (${shared}) SELECT ${shared} FROM ${table}`,
  );
  db.exec(`DROP TABLE ${table}`);
  db.exec(`ALTER TABLE ${table}_rebuild RENAME TO ${table}`);
}

function hasInvalidForeignKey(db, table) {
  const keys = foreignKeys(db, table);
  const columnsPerKey = {};
  keys.forEach((fk) => {
    columnsPerKey[fk.id] = (columnsPerKey[fk.id] || 0) + 1;
  });
  return keys.some(
    (fk) =>
      columnsPerKey[fk.id] === 1 &&
      INVALID_PARENT_REFS.has(`${fk.table}.${fk.to}`),
  );
}

function repairInvalidForeignKeys(db) {
  FK_REPAIR_CANDIDATES.filter((table) =>
    hasInvalidForeignKey(db, table),
  ).forEach((table) => rebuildTable(db, table));
}

// The army-wide seed list legitimately lists people who are not registered
// in this database, so aasl.service_number must not reference people(id).
// Databases created before the declaration was removed still carry it.
function dropAaslForeignKey(db) {
  if (foreignKeys(db, 'aasl').length > 0) {
    rebuildTable(db, 'aasl');
  }
}

const MIGRATIONS = [
  {
    version: 1,
    name: 'baseline-columns-and-fk-repair',
    up(db) {
      BASELINE_COLUMNS.forEach((spec) => addColumnIfMissing(db, spec));
      repairInvalidForeignKeys(db);
      dropAaslForeignKey(db);
    },
  },
];

const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

function getUserVersion(db) {
  return db.prepare('PRAGMA user_version').get().user_version;
}

function setUserVersion(db, version) {
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Invalid schema version ${version}`);
  }
  // PRAGMA takes no bound parameters; the value is validated above
  db.exec(`PRAGMA user_version = ${version}`);
}

/**
 * Apply every migration above the database's current user_version, each in
 * its own transaction. Returns the migrations that were applied.
 */
function applyMigrations(db, migrations = MIGRATIONS) {
  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  const latest = ordered.length > 0 ? ordered[ordered.length - 1].version : 0;
  const current = getUserVersion(db);
  if (current > latest) {
    throw new Error(
      `This database is at schema version ${current}, newer than this app ` +
        `supports (${latest}). Update the app before opening it.`,
    );
  }
  const pending = ordered.filter((migration) => migration.version > current);
  pending.forEach((migration) => {
    runInTransaction(db, () => {
      migration.up(db, createTx(db));
      setUserVersion(db, migration.version);
    });
  });
  return pending.map(({ version, name }) => ({ version, name }));
}

/**
 * Bring a database up to date: create the baseline tables when the file is
 * new (user_version 0), then apply pending migrations. Baseline creation is
 * deliberately skipped for versioned databases so that a later migration
 * which drops or renames a baseline table is not undone on the next start.
 */
function createSchema(db) {
  if (getUserVersion(db) === 0) {
    Object.values(TABLE_SCHEMAS).forEach((sql) => db.exec(sql));
  }
  return applyMigrations(db);
}

module.exports = {
  LATEST_SCHEMA_VERSION,
  MIGRATIONS,
  getUserVersion,
  applyMigrations,
  createSchema,
};
