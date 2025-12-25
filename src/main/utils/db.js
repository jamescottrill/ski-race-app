const Database = require('better-sqlite3');
const path = require('path');
const { app, dialog } = require('electron');
const fs = require('fs');

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
    }
    this.savePreferences({});
    return {};
  }

  static savePreferences(preferences) {
    try {
      fs.writeFileSync(
        this.preferencesPath,
        JSON.stringify(preferences, null, 2),
      );
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
  constructor() {
    const dbPath = preferences.databasePath || selectDatabaseFile();

    if (!dbPath) {
      throw new Error('Database file must be selected to proceed.');
    }

    try {
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      console.log('Connected to the SQLite database at:', dbPath);
      this.initializeDatabase();
    } catch (err) {
      console.error('Failed to connect to database:', err.message);
      throw err;
    }
  }

  initializeDatabase() {
    const tableCreationQueries = [
      `
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        title TEXT,
        birth_year INT,
        country TEXT,
        gender TEXT,
        is_competitor BOOLEAN,
        is_committee BOOLEAN
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS competitions (
        id TEXT PRIMARY KEY,
        competition_name TEXT,
        competition_description TEXT
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS competition_competitor (
        competition_id TEXT,
        racer_id TEXT,
        arrival_army_seed NUMBER,
        arrival_corps_seed NUMBER,
        title TEXT,
        is_novice BOOLEAN,
        is_junior BOOLEAN,
        is_senior BOOLEAN,
        is_veteran BOOLEAN,
        is_reserve BOOLEAN,
        is_female BOOLEAN,
        is_hc BOOLEAN,
        regiment TEXT,
        PRIMARY KEY (competition_id, racer_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (racer_id) REFERENCES people(id)
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS competition_team (
        competition_id TEXT,
        team_id TEXT,
        team_name TEXT,
        is_corps BOOLEAN,
        is_reserve BOOLEAN,
        is_female BOOLEAN,
        is_hc BOOLEAN,
        PRIMARY KEY (competition_id, team_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id)
      )
      `,
      `
        CREATE TABLE IF NOT EXISTS competition_team_members (
          competition_id TEXT,
          team_id TEXT,
          race_id TEXT,
          racer_id TEXT,
          PRIMARY KEY (competition_id, team_id, race_id, racer_id),
          FOREIGN KEY (competition_id) REFERENCES competitions(id),
          FOREIGN KEY (racer_id) REFERENCES people(id),
          FOREIGN KEY (team_id) REFERENCES competition_team(team_id),
          FOREIGN KEY (race_id) REFERENCES races(race_id)
          )
      `,
      `
      CREATE TABLE IF NOT EXISTS races (
        competition_id TEXT,
        race_id TEXT,
        race_name TEXT,
        race_date DATE,
        race_type TEXT,
        is_individual BOOLEAN,
        is_team BOOLEAN,
        is_training BOOLEAN,
        is_seeding BOOLEAN,
        women_separate BOOLEAN,
        number_runs INTEGER,
        venue TEXT,
        course_name TEXT,
        weather TEXT,
        snow TEXT,
        temp_start INTEGER,
        temp_finish INTEGER,
        chief_of_race STRING,
        tech_delegate STRING,
        referee STRING,
        asst_referee STRING,
        start_altitude INTEGER,
        finish_altitude INTEGER,
        homologation TEXT,
        flip_count INTEGER DEFAULT 15,
        flip_count_women INTEGER DEFAULT 5,
        PRIMARY KEY (competition_id, race_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id)
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS  race_run (
        competition_id TEXT,
        race_id TEXT,
        run_id TEXT,
        run_number INTEGER,
        course_setter TEXT,
        number_gates INTEGER,
        turning_gates INTEGER,
        start_time TIME,
        forerunner_a TEXT,
        forerunner_b TEXT,
        forerunner_c TEXT,
        forerunner_d TEXT,
        is_complete BOOLEAN,
        PRIMARY KEY (competition_id, race_id, run_number),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (race_id) REFERENCES races(race_id)
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS race_competitor (
        competition_id TEXT,
        race_id TEXT,
        racer_id TEXT,
        bib_number INTEGER,
        seed_points FLOAT,
        PRIMARY KEY (competition_id, race_id, racer_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (race_id) REFERENCES races(race_id),
        FOREIGN KEY (racer_id) REFERENCES people(id)
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS  race_results (
        competition_id TEXT,
        race_id TEXT,
        run_id TEXT,
        run_number INTEGER,
        racer_id TEXT,
        race_time FLOAT,
        is_dns BOOLEAN,
        is_dnf BOOLEAN,
        is_dsq BOOLEAN,
        is_ns BOOLEAN,
        dsq_gate INTEGER,
        dsq_reason TEXT,
        PRIMARY KEY (competition_id, race_id, run_number, racer_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (race_id) REFERENCES races(race_id),
        FOREIGN KEY (racer_id) REFERENCES people(id),
        FOREIGN KEY (run_number) REFERENCES race_run(run_number)
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS aasl (
        service_number TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        gender TEXT,
        category TEXT,
        seed_points NUMBER NOT NULL,
        season TEXT NOT NULL,
        import_date TEXT,
        PRIMARY KEY (service_number, season),
        FOREIGN KEY (service_number) REFERENCES people(id)
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS competition_cpp (
        id TEXT PRIMARY KEY,
        competition_id TEXT NOT NULL,
        cpp_value NUMBER NOT NULL,
        calculation_date TEXT,
        t1_sum NUMBER,
        t2_sum NUMBER,
        t3_sum NUMBER,
        skiers_used INTEGER,
        FOREIGN KEY (competition_id) REFERENCES competitions(id)
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS competition_final_seed_list (
        competition_id TEXT NOT NULL,
        racer_id TEXT NOT NULL,
        raw_seed_points NUMBER,
        cpp_applied NUMBER,
        final_seed_points NUMBER NOT NULL,
        aasl_points NUMBER,
        finalised_date TEXT,
        PRIMARY KEY (competition_id, racer_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (racer_id) REFERENCES people(id)
      )
      `,
    ];

    const errors = [];
    for (const query of tableCreationQueries) {
      try {
        this.db.exec(query);
        console.log('Table created or already exists.');
      } catch (err) {
        console.error('Error creating table:', err.message);
        errors.push(err.message);
      }
    }

    if (errors.length > 0) {
      console.error(`Failed to create ${errors.length} table(s):`, errors);
    }
  }

  run(query, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(query);
        const result = stmt.run(...params);
        resolve({ id: result.lastInsertRowid, changes: result.changes });
      } catch (err) {
        console.error('Error running query:', err.message);
        reject(err);
      }
    });
  }

  get(query, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(query);
        const row = stmt.get(...params);
        resolve(row);
      } catch (err) {
        console.error('Error fetching data:', err.message);
        reject(err);
      }
    });
  }

  all(query, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        resolve(rows);
      } catch (err) {
        console.error('Error fetching data:', err.message);
        reject(err);
      }
    });
  }

  delete(query, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(query);
        const result = stmt.run(...params);
        resolve({ changes: result.changes });
      } catch (err) {
        console.error('Error deleting data:', err.message);
        reject(err);
      }
    });
  }

  beginTransaction() {
    return new Promise((resolve, reject) => {
      try {
        this.db.exec('BEGIN TRANSACTION');
        resolve();
      } catch (err) {
        console.error('Error beginning transaction:', err.message);
        reject(err);
      }
    });
  }

  commit() {
    return new Promise((resolve, reject) => {
      try {
        this.db.exec('COMMIT');
        resolve();
      } catch (err) {
        console.error('Error committing transaction:', err.message);
        reject(err);
      }
    });
  }

  rollback() {
    return new Promise((resolve, reject) => {
      try {
        this.db.exec('ROLLBACK');
        resolve();
      } catch (err) {
        console.error('Error rolling back transaction:', err.message);
        reject(err);
      }
    });
  }

  async transaction(callback) {
    try {
      await this.beginTransaction();
      const result = await callback();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
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
      fs.copyFileSync(currentDbPath, result);
      dialog.showMessageBoxSync({
        type: 'info',
        title: 'Export Successful',
        message: `Database exported to:\n${result}`,
      });
      return result;
    } catch (error) {
      dialog.showErrorBox('Export Error', `Failed to export database: ${error.message}`);
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
      dialog.showErrorBox('Import Error', 'The selected file is not a valid SQLite database.');
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
  exportDatabase,
  importDatabase,
  switchDatabase,
  getCurrentDatabasePath,
};
