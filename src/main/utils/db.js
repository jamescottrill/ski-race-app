const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(
      path.join(__dirname, '../../races.db'),
      (err) => {
        if (!err) {
          console.log('Connected to the SQLite database.');
          this.initializeDatabase(); // Initialize the database when the connection is established
        } else {
          console.error('Could not connect to database:', err.message);
        }
      });
  }

  initializeDatabase() {
    // List all the table creation queries
    const tableCreationQueries = [
      `
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        title TEXT,
        dob INT,
        country TEXT,
        service_number TEXT,
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
        is_novice BOOLEAN,
        is_junior BOOLEAN,
        is_senior BOOLEAN,
        is_veteran BOOLEAN,
        is_reserve BOOLEAN,
        is_female BOOLEAN,
        is_hc BOOLEAN,
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
          racer_id TEXT,
          PRIMARY KEY (competition_id, team_id, racer_id),
          FOREIGN KEY (competition_id) REFERENCES competitions(id),
          FOREIGN KEY (racer_id) REFERENCES people(id),
          FOREIGN KEY (team_id) REFERENCES competition_team(team_id)
          )
      `,
      `
      CREATE TABLE IF NOT EXISTS races (
        competition_id TEXT,
        race_id TEXT,
        race_name TEXT,
        race_date DATE,
        race_type TEXT,
        is_team BOOLEAN,
        number_runs INTEGER,
        venue TEXT,
        course_name TEXT,
        weather TEXT,
        snow TEXT,
        temp_start INTEGER,
        temp_finish INTEGER,
        chief_of_race INTEGER,
        tech_delegate INTEGER,
        referee INTEGER,
        asst_referee INTEGER,
        start_altitude INTEGER,
        finish_altitude INTEGER,
        homologation TEXT,
        PRIMARY KEY (competition_id, race_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id)
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS race_run (
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
        PRIMARY KEY (competition_id, race_id, racer_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (race_id) REFERENCES races(race_id),
        FOREIGN KEY (racer_id) REFERENCES people(id)
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS race_results (
        competition_id TEXT,
        race_id TEXT,
        run_id TEXT,
        run_number INTEGER,
        racer_id TEXT,
        race_time TIME,
        started BOOLEAN,
        finished BOOLEAN,
        disqualified BOOLEAN,
        dsq_gate INTEGER,
        dsq_reason TEXT,
        PRIMARY KEY (competition_id, race_id, run_number, racer_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (race_id) REFERENCES races(race_id),
        FOREIGN KEY (racer_id) REFERENCES people(id)
      )
      `,
      // `
      // CREATE TABLE IF NOT EXISTS seed_list (
      //   competition_id TEXT,
      //   version INTEGER,
      //   version_id TEXT,
      //   racer_id TEXT,
      //   races TEXT,
      //   seed_points NUMBER,
      //   PRIMARY KEY (competition_id, version, racer_id),
      //   FOREIGN KEY (competition_id) REFERENCES competitions(id),
      //   FOREIGN KEY (racer_id) REFERENCES people(id)
      // )
      // `
    ];

    // Execute each query to create tables
    tableCreationQueries.forEach((query) => {
      this.db.run(query, (err) => {
        if (err) {
          console.log(query);
          console.error('Error creating table:', err.message);
        } else {

          console.log('Table created or already exists.');
        }
      });
    });
  }

  run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          console.error('Error running query:', err.message);
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          console.error('Error fetching data:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error fetching data:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  delete(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          console.error('Error deleting data:', err.message);
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
}

module.exports = new Database();
