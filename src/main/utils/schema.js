/**
 * Canonical table definitions, kept free of Electron imports so tests can
 * build the schema in an in-memory database.
 *
 * result_events is an append-only log written in the same transaction as
 * every results operation (see ../operations/results.js). It is the audit
 * trail today and the outbox a sync worker will drain when live results
 * are pushed to a server.
 */
// Canonical table definitions, used both to create tables in new databases
// and to rebuild existing tables whose foreign key declarations are invalid
// (see repairInvalidForeignKeys). Every foreign key must reference the
// parent table's primary key or a unique index — SQLite treats anything
// else as a "foreign key mismatch" and refuses to prepare statements
// against the child table while enforcement is on.
const TABLE_SCHEMAS = {
  people: `
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
  competitions: `
      CREATE TABLE IF NOT EXISTS competitions (
        id TEXT PRIMARY KEY,
        competition_name TEXT,
        competition_description TEXT
      )
      `,
  competition_competitor: `
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
  competition_team: `
      CREATE TABLE IF NOT EXISTS competition_team (
        competition_id TEXT,
        team_id TEXT,
        team_name TEXT,
        team_type TEXT,
        is_corps BOOLEAN,
        is_reserve BOOLEAN,
        is_female BOOLEAN,
        is_hc BOOLEAN,
        PRIMARY KEY (competition_id, team_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id)
      )
      `,
  races: `
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
  competition_team_members: `
      CREATE TABLE IF NOT EXISTS competition_team_members (
        competition_id TEXT,
        team_id TEXT,
        race_id TEXT,
        racer_id TEXT,
        PRIMARY KEY (competition_id, team_id, race_id, racer_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (racer_id) REFERENCES people(id),
        FOREIGN KEY (competition_id, team_id) REFERENCES competition_team(competition_id, team_id),
        FOREIGN KEY (competition_id, race_id) REFERENCES races(competition_id, race_id)
      )
      `,
  race_run: `
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
        is_complete BOOLEAN,
        PRIMARY KEY (competition_id, race_id, run_number),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (competition_id, race_id) REFERENCES races(competition_id, race_id)
      )
      `,
  race_competitor: `
      CREATE TABLE IF NOT EXISTS race_competitor (
        competition_id TEXT,
        race_id TEXT,
        racer_id TEXT,
        bib_number INTEGER,
        seed_points FLOAT,
        PRIMARY KEY (competition_id, race_id, racer_id),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (competition_id, race_id) REFERENCES races(competition_id, race_id),
        FOREIGN KEY (racer_id) REFERENCES people(id)
      )
      `,
  race_results: `
      CREATE TABLE IF NOT EXISTS race_results (
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
        FOREIGN KEY (competition_id, race_id) REFERENCES races(competition_id, race_id),
        FOREIGN KEY (racer_id) REFERENCES people(id),
        FOREIGN KEY (competition_id, race_id, run_number) REFERENCES race_run(competition_id, race_id, run_number)
      )
      `,
  aasl: `
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
  competition_cpp: `
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
  competition_final_seed_list: `
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
  result_events: `
      CREATE TABLE IF NOT EXISTS result_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competition_id TEXT NOT NULL,
        race_id TEXT NOT NULL,
        run_number INTEGER,
        racer_id TEXT,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT
      );
      CREATE INDEX IF NOT EXISTS result_events_unsynced
        ON result_events (synced_at) WHERE synced_at IS NULL
      `,
};

module.exports = { TABLE_SCHEMAS };
