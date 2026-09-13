/**
 * @jest-environment node
 */
const {
  LATEST_SCHEMA_VERSION,
  MIGRATIONS,
  getUserVersion,
  applyMigrations,
  createSchema,
} = require('../main/utils/migrations');

// node:sqlite ships with Node 22.13+; on older Node these tests are skipped
let sqlite = null;
try {
  // eslint-disable-next-line global-require
  sqlite = require('node:sqlite');
} catch (e) {
  sqlite = null;
}
const describeWithSqlite = sqlite ? describe : describe.skip;

function openDatabase() {
  const db = new sqlite.DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF'); // as the app runs
  return db;
}

const columns = (db, table) =>
  db
    .prepare('SELECT name FROM pragma_table_info(?)')
    .all(table)
    .map((c) => c.name);

const foreignKeys = (db, table) =>
  db.prepare('SELECT * FROM pragma_foreign_key_list(?)').all(table);

const tableExists = (db, table) =>
  Boolean(
    db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(table),
  );

// The shape an early release created: no flip counts, team type or training
// group, single-column foreign keys to composite parents, and the AASL
// foreign key to people. Tables not listed here come from the baseline.
function createLegacyDatabase(db) {
  db.exec(`
    CREATE TABLE people (id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT);
    CREATE TABLE competitions (id TEXT PRIMARY KEY, competition_name TEXT);
    CREATE TABLE competition_competitor (
      competition_id TEXT, racer_id TEXT, arrival_corps_seed NUMBER,
      PRIMARY KEY (competition_id, racer_id)
    );
    CREATE TABLE competition_team (
      competition_id TEXT, team_id TEXT, team_name TEXT,
      PRIMARY KEY (competition_id, team_id)
    );
    CREATE TABLE races (
      competition_id TEXT, race_id TEXT, race_name TEXT, race_type TEXT,
      PRIMARY KEY (competition_id, race_id)
    );
    CREATE TABLE race_run (
      competition_id TEXT, race_id TEXT, run_number INTEGER, is_complete BOOLEAN,
      PRIMARY KEY (competition_id, race_id, run_number),
      FOREIGN KEY (race_id) REFERENCES races(race_id)
    );
    CREATE TABLE race_results (
      competition_id TEXT, race_id TEXT, run_number INTEGER, racer_id TEXT,
      race_time FLOAT,
      PRIMARY KEY (competition_id, race_id, run_number, racer_id),
      FOREIGN KEY (run_number) REFERENCES race_run(run_number)
    );
    CREATE TABLE aasl (
      service_number TEXT NOT NULL, seed_points NUMBER NOT NULL, season TEXT NOT NULL,
      PRIMARY KEY (service_number, season),
      FOREIGN KEY (service_number) REFERENCES people(id)
    );
    INSERT INTO people VALUES ('30000001', 'Ann', 'Archer');
    INSERT INTO competitions VALUES ('c1', 'Corps Championships');
    INSERT INTO competition_competitor VALUES ('c1', '30000001', 120.5);
    INSERT INTO competition_team VALUES ('c1', 't1', 'A Team');
    INSERT INTO races VALUES ('c1', 'r1', 'Seeding GS', 'Giant Slalom');
    INSERT INTO race_run VALUES ('c1', 'r1', 1, 1);
    INSERT INTO race_results VALUES ('c1', 'r1', 1, '30000001', 61.23);
    INSERT INTO aasl VALUES ('99999999', 45.5, '2024-25');
  `);
}

describeWithSqlite('schema migrations', () => {
  it('brings a fresh database to the latest version with every baseline table', () => {
    const db = openDatabase();
    const applied = createSchema(db);

    expect(applied.map((m) => m.version)).toEqual(
      MIGRATIONS.map((m) => m.version),
    );
    expect(getUserVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(columns(db, 'races')).toEqual(
      expect.arrayContaining(['flip_count', 'flip_count_women']),
    );
    expect(columns(db, 'competition_team')).toContain('team_type');
    expect(columns(db, 'competition_competitor')).toContain('training_group');
    expect(tableExists(db, 'result_events')).toBe(true);
    expect(foreignKeys(db, 'aasl')).toEqual([]);
  });

  it('upgrades a legacy database in place, keeping its rows', () => {
    const db = openDatabase();
    createLegacyDatabase(db);
    expect(getUserVersion(db)).toBe(0);

    const applied = createSchema(db);

    expect(applied).toEqual([
      { version: 1, name: 'baseline-columns-and-fk-repair' },
    ]);
    expect(getUserVersion(db)).toBe(LATEST_SCHEMA_VERSION);

    // Columns back-filled, with the declared default applied to existing rows
    const race = db.prepare('SELECT * FROM races').get();
    expect(race.race_name).toBe('Seeding GS');
    expect(race.flip_count).toBe(15);
    expect(race.flip_count_women).toBe(5);
    expect(columns(db, 'competition_team')).toContain('team_type');
    expect(columns(db, 'competition_competitor')).toContain('training_group');

    // Rows survive the table rebuilds
    expect(db.prepare('SELECT * FROM race_results').get()).toMatchObject({
      race_id: 'r1',
      racer_id: '30000001',
      race_time: 61.23,
    });
    expect(db.prepare('SELECT * FROM race_run').get()).toMatchObject({
      race_id: 'r1',
      run_number: 1,
    });
    expect(db.prepare('SELECT * FROM aasl').get()).toMatchObject({
      service_number: '99999999',
      seed_points: 45.5,
    });
    expect(
      db.prepare('SELECT arrival_corps_seed FROM competition_competitor').get(),
    ).toEqual({ arrival_corps_seed: 120.5 });

    // The single-column foreign keys are replaced by the composite ones
    const runKeys = foreignKeys(db, 'race_results').filter(
      (fk) => fk.table === 'race_run',
    );
    expect(runKeys).toHaveLength(3);
    expect(runKeys.map((fk) => fk.to).sort()).toEqual([
      'competition_id',
      'race_id',
      'run_number',
    ]);
    const raceKeys = foreignKeys(db, 'race_run').filter(
      (fk) => fk.table === 'races',
    );
    expect(raceKeys).toHaveLength(2);

    // The AASL foreign key to people is gone
    expect(foreignKeys(db, 'aasl')).toEqual([]);

    // Tables the legacy database never had are created from the baseline
    expect(tableExists(db, 'competition_final_seed_list')).toBe(true);
    expect(tableExists(db, 'result_events')).toBe(true);
  });

  it('is a no-op when run again', () => {
    const db = openDatabase();
    createSchema(db);
    const tablesBefore = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
      )
      .all();

    expect(createSchema(db)).toEqual([]);
    expect(getUserVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
        )
        .all(),
    ).toEqual(tablesBefore);
  });

  it('does not recreate baseline tables once the database is versioned', () => {
    const db = openDatabase();
    createSchema(db);
    // Simulate a later migration having dropped a baseline table
    db.exec('DROP TABLE result_events');

    createSchema(db);

    expect(tableExists(db, 'result_events')).toBe(false);
  });

  it('rolls a failed migration back and leaves the version unchanged', () => {
    const db = openDatabase();
    const failing = [
      {
        version: 1,
        name: 'explodes',
        up(handle) {
          handle.exec('CREATE TABLE scratch (x)');
          throw new Error('boom');
        },
      },
    ];

    expect(() => applyMigrations(db, failing)).toThrow('boom');
    expect(getUserVersion(db)).toBe(0);
    expect(tableExists(db, 'scratch')).toBe(false);
  });

  it('applies migrations in version order and stops at the first failure', () => {
    const db = openDatabase();
    const order = [];
    const migrations = [
      { version: 2, name: 'second', up: () => order.push(2) },
      { version: 1, name: 'first', up: () => order.push(1) },
      {
        version: 3,
        name: 'third',
        up: () => {
          order.push(3);
          throw new Error('third failed');
        },
      },
    ];

    expect(() => applyMigrations(db, migrations)).toThrow('third failed');
    expect(order).toEqual([1, 2, 3]);
    // The two successful migrations each committed their own version bump
    expect(getUserVersion(db)).toBe(2);

    // A retry only re-runs the failed migration
    order.length = 0;
    migrations[2].up = () => order.push(3);
    expect(applyMigrations(db, migrations)).toEqual([
      { version: 3, name: 'third' },
    ]);
    expect(order).toEqual([3]);
    expect(getUserVersion(db)).toBe(3);
  });

  it('refuses a database written by a newer app', () => {
    const db = openDatabase();
    db.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);

    expect(() => createSchema(db)).toThrow(/newer than this app supports/);
    expect(getUserVersion(db)).toBe(LATEST_SCHEMA_VERSION + 1);
  });
});
