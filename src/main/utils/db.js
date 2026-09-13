const Database = require('better-sqlite3');
const path = require('path');
const { app, dialog } = require('electron');
const fs = require('fs');
const { normaliseParams } = require('./sqlParams');
const { TABLE_SCHEMAS } = require('./schema');
const { runOperation } = require('../operations');

const MAX_AUTOMATIC_BACKUPS = 10;

// The connection currently serving the app, so quit/relaunch paths can
// close it cleanly (see closeActiveDatabase)
let activeDatabase = null;

class AppPreferences {
  static preferencesPath = path.join(app.getPath('userData'), 'config.json');

  static loadPreferences() {
    try {
      if (fs.existsSync(this.preferencesPath)) {
        const data = fs.readFileSync(this.preferencesPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      // Keep the unreadable file for manual recovery rather than overwriting it
      try {
        fs.copyFileSync(
          this.preferencesPath,
          `${this.preferencesPath}.corrupt`,
        );
      } catch (backupError) {
        console.error('Failed to back up corrupt preferences:', backupError);
      }
    }
    return {};
  }

  static savePreferences(preferences) {
    try {
      // Write to a temp file then rename so a crash mid-write can't
      // leave a truncated config.json behind
      const tmpPath = `${this.preferencesPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(preferences, null, 2));
      fs.renameSync(tmpPath, this.preferencesPath);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw new Error('Could not save preferences: ' + error.message);
    }
  }
}

const preferences = AppPreferences.loadPreferences();

function selectDatabaseFile() {
  const result = dialog.showOpenDialogSync({
    title: 'Select or Create Database File',
    properties: ['openFile', 'createDirectory', 'promptToCreate'],
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });

  if (result && result.length > 0) {
    preferences.databasePath = result[0];
    AppPreferences.savePreferences(preferences);
    return result[0];
  }
  return undefined;
}

class DatabaseWrapper {
  constructor(dbPath) {
    const finalPath =
      dbPath || preferences.databasePath || selectDatabaseFile();

    if (!finalPath) {
      throw new Error('Database file must be selected to proceed.');
    }

    try {
      // Ensure the directory exists
      const dbDir = path.dirname(finalPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new Database(finalPath);
      this.db.pragma('journal_mode = WAL');
      // better-sqlite3 v12 turned foreign key enforcement ON by default.
      // Existing databases carry FK declarations that SQLite considers
      // malformed (references to non-unique parent columns), which makes
      // every statement on those tables fail at prepare time under
      // enforcement. Keep enforcement off (the behaviour the app was
      // written against) until existing data has been cleaned up;
      // repairInvalidForeignKeys() below fixes the declarations so
      // enforcement can be switched on deliberately later.
      this.db.pragma('foreign_keys = OFF');
      console.log('Connected to the SQLite database at:', finalPath);
      // Snapshot BEFORE any schema work so a bad migration is recoverable
      this.createAutomaticBackup(finalPath);
      this.initializeDatabase();
      this.applyColumnMigrations();
      this.repairInvalidForeignKeys();
      activeDatabase = this;
    } catch (err) {
      console.error('Failed to connect to database at path:', finalPath);
      console.error('Error:', err.message);
      // Don't leak the handle if the file opened but setup failed; the
      // caller will offer to open a different database
      if (this.db && this.db.open) {
        this.db.close();
      }
      throw err;
    }
  }

  initializeDatabase() {
    const errors = [];
    for (const [table, query] of Object.entries(TABLE_SCHEMAS)) {
      try {
        this.db.exec(query);
      } catch (err) {
        console.error(`Error creating table ${table}:`, err.message);
        errors.push(err.message);
      }
    }

    if (errors.length > 0) {
      console.error(`Failed to create ${errors.length} table(s):`, errors);
    }
  }

  // CREATE TABLE IF NOT EXISTS never alters tables that already exist, so
  // columns added to the schema after a database was created have to be
  // back-filled here.
  applyColumnMigrations() {
    const columnMigrations = [
      { table: 'races', column: 'flip_count', ddl: 'INTEGER DEFAULT 15' },
      { table: 'races', column: 'flip_count_women', ddl: 'INTEGER DEFAULT 5' },
      { table: 'competition_team', column: 'team_type', ddl: 'TEXT' },
      {
        table: 'competition_competitor',
        column: 'training_group',
        ddl: 'INTEGER',
      },
    ];

    for (const { table, column, ddl } of columnMigrations) {
      try {
        const exists = this.db
          .prepare('SELECT 1 FROM pragma_table_info(?) WHERE name = ?')
          .get(table, column);
        if (!exists) {
          this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
          console.log(`Added missing column ${table}.${column}`);
        }
      } catch (err) {
        console.error(
          `Failed to migrate column ${table}.${column}:`,
          err.message,
        );
      }
    }
  }

  // Earlier versions declared foreign keys against non-unique parent
  // columns (e.g. race_results.run_number -> race_run.run_number, where
  // race_run's key is composite). SQLite reports these as "foreign key
  // mismatch" and, with enforcement on (the better-sqlite3 v12 default),
  // refuses to prepare ANY insert/delete against the child table. Rebuild
  // affected tables with the corrected declarations from TABLE_SCHEMAS.
  repairInvalidForeignKeys() {
    const invalidParentRefs = new Set([
      'races.race_id',
      'race_run.run_number',
      'competition_team.team_id',
    ]);
    const candidates = [
      'competition_team_members',
      'race_run',
      'race_competitor',
      'race_results',
    ];

    for (const table of candidates) {
      try {
        const foreignKeys = this.db.pragma(`foreign_key_list(${table})`);
        // Count columns per FK: the corrected composite FKs also contain
        // e.g. a run_number -> race_run.run_number column pair, so only a
        // SINGLE-column FK to one of these parents is invalid
        const columnsPerFk = {};
        for (const fk of foreignKeys) {
          columnsPerFk[fk.id] = (columnsPerFk[fk.id] || 0) + 1;
        }
        const needsRebuild = foreignKeys.some(
          (fk) =>
            columnsPerFk[fk.id] === 1 &&
            invalidParentRefs.has(`${fk.table}.${fk.to}`),
        );
        if (needsRebuild) {
          this.rebuildTable(table);
          console.log(`Rebuilt ${table} with corrected foreign keys`);
        }
      } catch (err) {
        console.error(`Failed to repair table ${table}:`, err.message);
      }
    }
  }

  // Standard SQLite table rebuild: create the corrected table under a
  // temporary name, copy every shared column across, then swap it in.
  // Runs as one transaction so a failure leaves the original untouched.
  rebuildTable(table) {
    const createSql = TABLE_SCHEMAS[table].replace(
      `CREATE TABLE IF NOT EXISTS ${table}`,
      `CREATE TABLE ${table}_rebuild`,
    );

    const rebuild = this.db.transaction(() => {
      this.db.exec(`DROP TABLE IF EXISTS ${table}_rebuild`);
      this.db.exec(createSql);
      const oldColumns = this.db
        .pragma(`table_info(${table})`)
        .map((c) => c.name);
      const newColumns = this.db
        .pragma(`table_info(${table}_rebuild)`)
        .map((c) => c.name);
      const shared = oldColumns
        .filter((c) => newColumns.includes(c))
        .join(', ');
      this.db.exec(
        `INSERT INTO ${table}_rebuild (${shared}) SELECT ${shared} FROM ${table}`,
      );
      this.db.exec(`DROP TABLE ${table}`);
      this.db.exec(`ALTER TABLE ${table}_rebuild RENAME TO ${table}`);
    });
    rebuild();
  }

  // A plain file copy of a WAL-mode database can miss recent writes, so
  // back up via VACUUM INTO, which produces a consistent snapshot.
  createAutomaticBackup(dbPath) {
    try {
      const backupDir = path.join(app.getPath('userData'), 'backups');
      fs.mkdirSync(backupDir, { recursive: true });

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseName = path.basename(dbPath, path.extname(dbPath));
      const backupPath = path.join(backupDir, `${baseName}-${stamp}.db`);

      this.db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
      console.log('Automatic backup created at:', backupPath);

      const backups = fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('.db'))
        .map((f) => ({
          name: f,
          mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      for (const old of backups.slice(MAX_AUTOMATIC_BACKUPS)) {
        fs.unlinkSync(path.join(backupDir, old.name));
      }
    } catch (err) {
      // A failed backup must never stop the app from starting
      console.error('Automatic backup failed:', err.message);
    }
  }

  run(query, params = []) {
    const result = this.db.prepare(query).run(...normaliseParams(params));
    return { id: result.lastInsertRowid, changes: result.changes };
  }

  get(query, params = []) {
    return this.db.prepare(query).get(...normaliseParams(params));
  }

  all(query, params = []) {
    return this.db.prepare(query).all(...normaliseParams(params));
  }

  delete(query, params = []) {
    const result = this.db.prepare(query).run(...normaliseParams(params));
    return { changes: result.changes };
  }

  // Executes a list of {type, query, params} operations atomically.
  // better-sqlite3's transaction() runs the whole batch synchronously, so
  // no other IPC-dispatched statement can interleave between BEGIN and
  // COMMIT, and any thrown error rolls the entire batch back.
  transaction(operations) {
    const runAll = this.db.transaction((ops) => {
      const results = [];
      for (const op of ops) {
        switch (op.type) {
          case 'select':
            results.push(this.all(op.query, op.params || []));
            break;
          case 'insert':
          case 'update':
          case 'run':
            results.push(this.run(op.query, op.params || []));
            break;
          case 'delete':
            results.push(this.delete(op.query, op.params || []));
            break;
          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
      }
      return results;
    });
    return runAll(operations);
  }

  // Runs a named operation (see ../operations) in one transaction
  operation(name, payload) {
    return runOperation(this.db, name, payload);
  }

  // Checkpoints the WAL into the main file and releases the handle, so a
  // plain file copy of the .db taken after quitting is complete
  close() {
    if (this.db && this.db.open) {
      this.db.close();
    }
    if (activeDatabase === this) {
      activeDatabase = null;
    }
  }
}

// Called from the quit and relaunch paths. Safe to call when nothing is open.
function closeActiveDatabase() {
  if (!activeDatabase) return;
  try {
    activeDatabase.close();
    console.log('Database closed');
  } catch (err) {
    console.error('Failed to close database cleanly:', err.message);
  }
  activeDatabase = null;
}

function exportDatabase() {
  const currentDbPath = preferences.databasePath;
  if (!currentDbPath) {
    dialog.showErrorBox('Export Error', 'No database is currently open.');
    return null;
  }

  const result = dialog.showSaveDialogSync({
    title: 'Export Database',
    defaultPath: `ski-race-backup-${new Date().toISOString().split('T')[0]}.db`,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });

  if (result) {
    try {
      // VACUUM INTO on a fresh connection gives a consistent snapshot even
      // in WAL mode, where copying just the .db file can miss recent writes
      const source = new Database(currentDbPath, { readonly: true });
      try {
        if (fs.existsSync(result)) {
          fs.unlinkSync(result);
        }
        source.exec(`VACUUM INTO '${result.replace(/'/g, "''")}'`);
      } finally {
        source.close();
      }
      dialog.showMessageBoxSync({
        type: 'info',
        title: 'Export Successful',
        message: `Database exported to:\n${result}`,
      });
      return result;
    } catch (error) {
      dialog.showErrorBox(
        'Export Error',
        `Failed to export database: ${error.message}`,
      );
      return null;
    }
  }
  return null;
}

function importDatabase() {
  const result = dialog.showOpenDialogSync({
    title: 'Import Database',
    properties: ['openFile'],
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });

  if (result && result.length > 0) {
    const importPath = result[0];

    try {
      const testDb = new Database(importPath, { readonly: true });
      testDb.close();
    } catch (error) {
      dialog.showErrorBox(
        'Import Error',
        'The selected file is not a valid SQLite database.',
      );
      return null;
    }

    preferences.databasePath = importPath;
    AppPreferences.savePreferences(preferences);

    dialog.showMessageBoxSync({
      type: 'info',
      title: 'Import Successful',
      message: `Database imported. The application will now restart to use the new database.`,
    });

    return importPath;
  }
  return null;
}

function switchDatabase() {
  const result = selectDatabaseFile();
  if (result) {
    dialog.showMessageBoxSync({
      type: 'info',
      title: 'Database Changed',
      message: `Database switched. The application will now restart to use the new database.`,
    });
    return result;
  }
  return null;
}

function getCurrentDatabasePath() {
  return preferences.databasePath || null;
}

module.exports = {
  Database: DatabaseWrapper,
  AppPreferences,
  closeActiveDatabase,
  exportDatabase,
  importDatabase,
  switchDatabase,
  getCurrentDatabasePath,
};
