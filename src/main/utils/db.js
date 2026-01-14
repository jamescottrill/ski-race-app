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
  constructor(dbPath) {
    const finalPath = dbPath || preferences.databasePath || selectDatabaseFile();

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
      console.log('Connected to the SQLite database at:', finalPath);
      this.initializeDatabase();
    } catch (err) {
      console.error('Failed to connect to database at path:', finalPath);
      console.error('Error:', err.message);
      throw err;
    }
  }

  initializeDatabase() {
    const tableSchemas = {
      people: {
        columns: {
          id: 'TEXT PRIMARY KEY',
          first_name: 'TEXT',
          last_name: 'TEXT',
          title: 'TEXT',
          birth_year: 'INT',
          country: 'TEXT',
          gender: 'TEXT',
          is_competitor: 'BOOLEAN',
          is_committee: 'BOOLEAN',
        },
      },
      competitions: {
        columns: {
          id: 'TEXT PRIMARY KEY',
          competition_name: 'TEXT',
          competition_description: 'TEXT',
          competition_type: 'TEXT',
          season: 'TEXT',
        },
      },
      competition_competitor: {
        columns: {
          competition_id: 'TEXT',
          racer_id: 'TEXT',
          arrival_army_seed: 'NUMBER',
          arrival_corps_seed: 'NUMBER',
          title: 'TEXT',
          is_novice: 'BOOLEAN',
          is_junior: 'BOOLEAN',
          is_senior: 'BOOLEAN',
          is_veteran: 'BOOLEAN',
          is_reserve: 'BOOLEAN',
          is_female: 'BOOLEAN',
          is_hc: 'BOOLEAN',
          is_withdrawn: 'BOOLEAN DEFAULT 0',
          regiment: 'TEXT',
        },
        constraints: [
          'PRIMARY KEY (competition_id, racer_id)',
          'FOREIGN KEY (competition_id) REFERENCES competitions(id)',
          'FOREIGN KEY (racer_id) REFERENCES people(id)',
        ],
      },
      competition_team: {
        columns: {
          competition_id: 'TEXT',
          team_id: 'TEXT',
          team_name: 'TEXT',
          is_corps: 'BOOLEAN',
          is_reserve: 'BOOLEAN',
          is_female: 'BOOLEAN',
          is_hc: 'BOOLEAN',
        },
        constraints: [
          'PRIMARY KEY (competition_id, team_id)',
          'FOREIGN KEY (competition_id) REFERENCES competitions(id)',
        ],
      },
      competition_team_members: {
        columns: {
          competition_id: 'TEXT',
          team_id: 'TEXT',
          race_id: 'TEXT',
          racer_id: 'TEXT',
        },
        constraints: [
          'PRIMARY KEY (competition_id, team_id, race_id, racer_id)',
          'FOREIGN KEY (competition_id) REFERENCES competitions(id)',
          'FOREIGN KEY (racer_id) REFERENCES people(id)',
          'FOREIGN KEY (team_id) REFERENCES competition_team(team_id)',
          'FOREIGN KEY (race_id) REFERENCES races(race_id)',
        ],
      },
      races: {
        columns: {
          competition_id: 'TEXT',
          race_id: 'TEXT',
          race_name: 'TEXT',
          race_date: 'DATE',
          race_type: 'TEXT',
          is_individual: 'BOOLEAN',
          is_team: 'BOOLEAN',
          is_training: 'BOOLEAN',
          is_seeding: 'BOOLEAN',
          women_separate: 'BOOLEAN',
          number_runs: 'INTEGER',
          venue: 'TEXT',
          course_name: 'TEXT',
          weather: 'TEXT',
          snow: 'TEXT',
          temp_start: 'INTEGER',
          temp_finish: 'INTEGER',
          chief_of_race: 'STRING',
          tech_delegate: 'STRING',
          referee: 'STRING',
          asst_referee: 'STRING',
          start_altitude: 'INTEGER',
          finish_altitude: 'INTEGER',
          homologation: 'TEXT',
          flip_count: 'INTEGER DEFAULT 15',
          flip_count_women: 'INTEGER DEFAULT 5',
        },
        constraints: [
          'PRIMARY KEY (competition_id, race_id)',
          'FOREIGN KEY (competition_id) REFERENCES competitions(id)',
        ],
      },
      race_run: {
        columns: {
          competition_id: 'TEXT',
          race_id: 'TEXT',
          run_id: 'TEXT',
          run_number: 'INTEGER',
          course_setter: 'TEXT',
          number_gates: 'INTEGER',
          turning_gates: 'INTEGER',
          start_time: 'TIME',
          forerunner_a: 'TEXT',
          forerunner_b: 'TEXT',
          forerunner_c: 'TEXT',
          forerunner_d: 'TEXT',
          is_complete: 'BOOLEAN',
        },
        constraints: [
          'PRIMARY KEY (competition_id, race_id, run_number)',
          'FOREIGN KEY (competition_id) REFERENCES competitions(id)',
          'FOREIGN KEY (race_id) REFERENCES races(race_id)',
        ],
      },
      race_competitor: {
        columns: {
          competition_id: 'TEXT',
          race_id: 'TEXT',
          racer_id: 'TEXT',
          bib_number: 'INTEGER',
          seed_points: 'FLOAT',
        },
        constraints: [
          'PRIMARY KEY (competition_id, race_id, racer_id)',
          'FOREIGN KEY (competition_id) REFERENCES competitions(id)',
          'FOREIGN KEY (race_id) REFERENCES races(race_id)',
          'FOREIGN KEY (racer_id) REFERENCES people(id)',
        ],
      },
      race_results: {
        columns: {
          competition_id: 'TEXT',
          race_id: 'TEXT',
          run_id: 'TEXT',
          run_number: 'INTEGER',
          racer_id: 'TEXT',
          race_time: 'FLOAT',
          is_dns: 'BOOLEAN',
          is_dnf: 'BOOLEAN',
          is_dsq: 'BOOLEAN',
          is_ns: 'BOOLEAN',
          dsq_gate: 'INTEGER',
          dsq_reason: 'TEXT',
        },
        constraints: [
          'PRIMARY KEY (competition_id, race_id, run_number, racer_id)',
          'FOREIGN KEY (competition_id) REFERENCES competitions(id)',
          'FOREIGN KEY (race_id) REFERENCES races(race_id)',
          'FOREIGN KEY (racer_id) REFERENCES people(id)',
          'FOREIGN KEY (run_number) REFERENCES race_run(run_number)',
        ],
      },
      aasl: {
        columns: {
          service_number: 'TEXT NOT NULL',
          first_name: 'TEXT',
          last_name: 'TEXT',
          gender: 'TEXT',
          category: 'TEXT',
          seed_points: 'NUMBER NOT NULL',
          season: 'TEXT NOT NULL',
          import_date: 'TEXT',
        },
        constraints: [
          'PRIMARY KEY (service_number, season)',
          'FOREIGN KEY (service_number) REFERENCES people(id)',
        ],
      },
      competition_cpp: {
        columns: {
          id: 'TEXT PRIMARY KEY',
          competition_id: 'TEXT NOT NULL',
          cpp_value: 'NUMBER NOT NULL',
          calculation_date: 'TEXT',
          t1_sum: 'NUMBER',
          t2_sum: 'NUMBER',
          t3_sum: 'NUMBER',
          skiers_used: 'INTEGER',
        },
        constraints: ['FOREIGN KEY (competition_id) REFERENCES competitions(id)'],
      },
      competition_final_seed_list: {
        columns: {
          competition_id: 'TEXT NOT NULL',
          racer_id: 'TEXT NOT NULL',
          raw_seed_points: 'NUMBER',
          cpp_applied: 'NUMBER',
          final_seed_points: 'NUMBER NOT NULL',
          aasl_points: 'NUMBER',
          finalised_date: 'TEXT',
        },
        constraints: [
          'PRIMARY KEY (competition_id, racer_id)',
          'FOREIGN KEY (competition_id) REFERENCES competitions(id)',
          'FOREIGN KEY (racer_id) REFERENCES people(id)',
        ],
      },
    };

    const errors = [];

    for (const [tableName, schema] of Object.entries(tableSchemas)) {
      try {
        const createQuery = this.buildCreateTableQuery(tableName, schema);
        this.db.exec(createQuery);
        this.ensureColumnsExist(tableName, schema.columns);
      } catch (err) {
        console.error(`Error with table ${tableName}:`, err.message);
        errors.push(`${tableName}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      console.error(`Failed to create/update ${errors.length} table(s):`, errors);
    }
  }

  buildCreateTableQuery(tableName, schema) {
    const columnDefs = Object.entries(schema.columns)
      .map(([name, type]) => `${name} ${type}`)
      .join(',\n        ');

    const constraints = schema.constraints ? `,\n        ${schema.constraints.join(',\n        ')}` : '';

    return `CREATE TABLE IF NOT EXISTS ${tableName} (\n        ${columnDefs}${constraints}\n      )`;
  }

  ensureColumnsExist(tableName, columns) {
    const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
    const existingColumns = new Set(tableInfo.map((col) => col.name));

    for (const [columnName, columnType] of Object.entries(columns)) {
      if (!existingColumns.has(columnName)) {
        try {
          this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
          console.log(`Added column ${columnName} to ${tableName}`);
        } catch (err) {
          console.error(`Error adding column ${columnName} to ${tableName}:`, err.message);
        }
      }
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
        console.error('Error fetching data:', query);
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
