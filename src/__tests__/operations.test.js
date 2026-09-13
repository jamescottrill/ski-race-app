/**
 * @jest-environment node
 */
const { validateEvent } = require('@awsa/sync-contract');
const { createSchema } = require('../main/utils/migrations');
const { runOperation, createTx } = require('../main/operations');
const { ENTITY_LOADERS, emitEntity } = require('../main/operations/events');

// node:sqlite ships with Node 22.13+; on older Node these tests are skipped
let sqlite = null;
try {
  // eslint-disable-next-line global-require
  sqlite = require('node:sqlite');
} catch (error) {
  sqlite = null;
}
const describeWithSqlite = sqlite ? describe : describe.skip;

const COMP = 'comp';
const RACE = 'race';

function openDatabase({ numberRuns = 2, isSeeding = 0 } = {}) {
  const db = new sqlite.DatabaseSync(':memory:');
  createSchema(db);
  db.prepare(
    `INSERT INTO competitions (id, competition_name) VALUES (?, ?)`,
  ).run(COMP, 'Test');
  db.prepare(
    `INSERT INTO races (competition_id, race_id, race_name, number_runs, is_seeding) VALUES (?, ?, ?, ?, ?)`,
  ).run(COMP, RACE, 'GS', numberRuns, isSeeding);
  for (let run = 1; run <= numberRuns; run += 1) {
    db.prepare(
      `INSERT INTO race_run (competition_id, race_id, run_id, run_number, is_complete) VALUES (?, ?, ?, ?, 0)`,
    ).run(COMP, RACE, `${RACE}-run-${run}`, run);
  }
  ['A', 'B', 'C'].forEach((id, i) => {
    db.prepare(
      `INSERT INTO people (id, first_name, last_name) VALUES (?, ?, ?)`,
    ).run(id, id, 'Racer');
    db.prepare(
      `INSERT INTO competition_competitor (competition_id, racer_id) VALUES (?, ?)`,
    ).run(COMP, id);
    db.prepare(
      `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number, seed_points) VALUES (?, ?, ?, ?, ?)`,
    ).run(COMP, RACE, id, i + 1, 100 + i);
  });
  return db;
}

const rows = (db, sql, params = []) => db.prepare(sql).all(...params);
// The sync outbox, decoded. Every event is also checked against the contract
// so a payload the service would reject fails here first.
const events = (db) =>
  rows(
    db,
    `SELECT id, entity_type, entity_key, op, payload, source_operation, schema_version, created_at
     FROM sync_events ORDER BY id`,
  ).map((row) => {
    const event = {
      ...row,
      entity_key: JSON.parse(row.entity_key),
      payload: row.payload === null ? null : JSON.parse(row.payload),
    };
    validateEvent({
      event_id: event.id,
      entity_type: event.entity_type,
      operation: event.op,
      key: event.entity_key,
      data: event.payload,
      occurred_at: event.created_at,
    });
    return event;
  });
const lastEvent = (db) => events(db).at(-1);
const noFinish = {
  is_dns: false,
  is_dnf: false,
  is_dsq: false,
  is_ns: false,
  dsq_gate: null,
  dsq_reason: null,
};
const run = (db, name, payload) => runOperation(db, name, payload);

describeWithSqlite('operations', () => {
  it('rejects an unknown operation', () => {
    const db = openDatabase();
    expect(() => run(db, 'nope', {})).toThrow('Unknown operation: nope');
  });

  describe('results.saveFields', () => {
    it('creates then updates a result row and logs each write', () => {
      const db = openDatabase();
      const target = {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        racerId: 'A',
      };
      run(db, 'results.saveFields', {
        ...target,
        fields: { race_time: 61.2, is_dnf: 0 },
      });
      run(db, 'results.saveFields', {
        ...target,
        fields: { is_dsq: 1, dsq_gate: 4 },
      });
      expect(
        rows(db, `SELECT race_time, is_dsq, dsq_gate FROM race_results`),
      ).toEqual([{ race_time: 61.2, is_dsq: 1, dsq_gate: 4 }]);
      // Each write publishes the whole row as it now stands
      const key = { race_id: RACE, run_number: 1, service_number: 'A' };
      expect(events(db)).toEqual([
        expect.objectContaining({
          entity_type: 'result',
          op: 'upsert',
          source_operation: 'results.saveFields',
          schema_version: 1,
          entity_key: key,
          payload: { race_time: 61.2, ...noFinish },
        }),
        expect.objectContaining({
          entity_key: key,
          payload: { race_time: 61.2, ...noFinish, is_dsq: true, dsq_gate: 4 },
        }),
      ]);
    });

    it('refuses unknown columns and missing identifiers', () => {
      const db = openDatabase();
      const target = {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        racerId: 'A',
      };
      expect(() =>
        run(db, 'results.saveFields', { ...target, fields: { bib_number: 9 } }),
      ).toThrow('unknown column(s) bib_number');
      expect(() =>
        run(db, 'results.saveFields', {
          ...target,
          racerId: '',
          fields: { race_time: 1 },
        }),
      ).toThrow('racerId is required');
      expect(rows(db, `SELECT * FROM race_results`)).toEqual([]);
      expect(events(db)).toEqual([]);
    });
  });

  describe('results.setRunComplete', () => {
    const recordRunOne = (db) => {
      run(db, 'results.saveFields', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        racerId: 'A',
        fields: { race_time: 60 },
      });
      run(db, 'results.saveFields', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        racerId: 'B',
        fields: { is_dnf: 1 },
      });
      // C never had run 1 recorded
    };

    it('locks the run and advances only finishers to the next run', () => {
      const db = openDatabase();
      recordRunOne(db);
      // A stale run-2 row for the DNF competitor from an earlier attempt
      db.prepare(
        `INSERT INTO race_results (competition_id, race_id, run_number, racer_id) VALUES (?, ?, 2, 'B')`,
      ).run(COMP, RACE);

      const result = run(db, 'results.setRunComplete', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        isComplete: true,
      });

      expect(result.nextRun).toEqual({ advanced: 1, removed: 2 });
      expect(
        rows(db, `SELECT is_complete FROM race_run WHERE run_number = 1`),
      ).toEqual([{ is_complete: 1 }]);
      expect(
        rows(db, `SELECT racer_id FROM race_results WHERE run_number = 2`),
      ).toEqual([{ racer_id: 'A' }]);
      // The stale run-2 row for B is withdrawn, A's run-2 row is published,
      // and the lock on run 1 goes last
      const published = events(db).filter(
        (e) => e.source_operation === 'results.setRunComplete',
      );
      expect(published.map((e) => [e.entity_type, e.op, e.entity_key])).toEqual(
        [
          [
            'result',
            'delete',
            { race_id: RACE, run_number: 2, service_number: 'B' },
          ],
          [
            'result',
            'upsert',
            { race_id: RACE, run_number: 2, service_number: 'A' },
          ],
          ['race_run', 'upsert', { race_id: RACE, run_number: 1 }],
        ],
      );
      expect(published[1].payload).toEqual({ race_time: null, ...noFinish });
      expect(published[2].payload).toMatchObject({ is_complete: true });
    });

    it('keeps next-run times already entered when a run is unlocked and relocked', () => {
      const db = openDatabase();
      recordRunOne(db);
      run(db, 'results.setRunComplete', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        isComplete: true,
      });
      run(db, 'results.saveFields', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 2,
        racerId: 'A',
        fields: { race_time: 59 },
      });
      run(db, 'results.setRunComplete', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        isComplete: false,
      });
      run(db, 'results.setRunComplete', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        isComplete: true,
      });
      expect(
        rows(
          db,
          `SELECT racer_id, race_time FROM race_results WHERE run_number = 2`,
        ),
      ).toEqual([{ racer_id: 'A', race_time: 59 }]);
    });

    it('advances everyone in a seeding race', () => {
      const db = openDatabase({ isSeeding: 1 });
      recordRunOne(db);
      const result = run(db, 'results.setRunComplete', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        isComplete: true,
      });
      expect(result.nextRun).toEqual({ advanced: 3, removed: 0 });
      expect(
        rows(
          db,
          `SELECT racer_id FROM race_results WHERE run_number = 2 ORDER BY racer_id`,
        ),
      ).toEqual([{ racer_id: 'A' }, { racer_id: 'B' }, { racer_id: 'C' }]);
    });

    it('does not build a next run for the final run', () => {
      const db = openDatabase({ numberRuns: 1 });
      const result = run(db, 'results.setRunComplete', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        isComplete: true,
      });
      expect(result.nextRun).toBeNull();
    });
  });

  describe('results.importBatch', () => {
    it('creates missing runs, upserts every result and logs each one', () => {
      const db = openDatabase({ numberRuns: 1 });
      db.exec(`DELETE FROM race_run`);
      const result = run(db, 'results.importBatch', {
        competitionId: COMP,
        raceId: RACE,
        results: [
          { racerId: 'A', runNumber: 1, time: 55.1, status: null },
          { racerId: 'B', runNumber: 1, time: 70, status: 'DNF' },
        ],
      });
      expect(result).toEqual({ success: true, imported: 2, runs: [1] });
      expect(rows(db, `SELECT run_number, is_complete FROM race_run`)).toEqual([
        { run_number: 1, is_complete: 0 },
      ]);
      expect(
        rows(
          db,
          `SELECT racer_id, race_time, is_dnf FROM race_results ORDER BY racer_id`,
        ),
      ).toEqual([
        { racer_id: 'A', race_time: 55.1, is_dnf: 0 },
        { racer_id: 'B', race_time: null, is_dnf: 1 },
      ]);
      // The run it created is published before the results that need it
      expect(events(db).map((e) => [e.entity_type, e.entity_key])).toEqual([
        ['race_run', { race_id: RACE, run_number: 1 }],
        ['result', { race_id: RACE, run_number: 1, service_number: 'A' }],
        ['result', { race_id: RACE, run_number: 1, service_number: 'B' }],
      ]);
      expect(events(db)[2].payload).toMatchObject({
        race_time: null,
        is_dnf: true,
      });
    });

    it('refuses a locked run and writes nothing on any failure', () => {
      const db = openDatabase();
      db.prepare(
        `UPDATE race_run SET is_complete = 1 WHERE run_number = 1`,
      ).run();
      expect(() =>
        run(db, 'results.importBatch', {
          competitionId: COMP,
          raceId: RACE,
          results: [{ racerId: 'A', runNumber: 1, time: 55 }],
        }),
      ).toThrow('run 1 is marked complete');
      expect(() =>
        run(db, 'results.importBatch', {
          competitionId: COMP,
          raceId: RACE,
          results: [
            { racerId: 'A', runNumber: 2, time: 55 },
            { racerId: 'B', runNumber: 2, status: 'LATE' },
          ],
        }),
      ).toThrow('unknown status "LATE"');
      expect(rows(db, `SELECT * FROM race_results`)).toEqual([]);
      expect(events(db)).toEqual([]);
    });
  });

  describe('startList', () => {
    it('regenerate replaces the start list atomically', () => {
      const db = openDatabase();
      run(db, 'startList.regenerate', {
        competitionId: COMP,
        raceId: RACE,
        entries: [
          { racerId: 'C', bibNumber: 1, seedPoints: 5 },
          { racerId: 'A', bibNumber: 2 },
        ],
      });
      expect(
        rows(
          db,
          `SELECT racer_id, bib_number, seed_points FROM race_competitor ORDER BY bib_number`,
        ),
      ).toEqual([
        { racer_id: 'C', bib_number: 1, seed_points: 5 },
        { racer_id: 'A', bib_number: 2, seed_points: 0 },
      ]);
      // The whole list is published in bib order
      expect(lastEvent(db)).toMatchObject({
        entity_type: 'start_list',
        op: 'upsert',
        entity_key: { race_id: RACE },
        payload: {
          entries: [
            { service_number: 'C', bib_number: 1, seed_points: 5 },
            { service_number: 'A', bib_number: 2, seed_points: 0 },
          ],
        },
      });
    });

    it('saveBibOrder renumbers and rejects duplicate or invalid bibs', () => {
      const db = openDatabase();
      expect(
        run(db, 'startList.saveBibOrder', {
          competitionId: COMP,
          raceId: RACE,
          bibs: [
            { racerId: 'A', bibNumber: 3 },
            { racerId: 'C', bibNumber: 1 },
          ],
        }),
      ).toEqual({ success: true, updated: 2 });
      expect(
        rows(db, `SELECT racer_id FROM race_competitor ORDER BY bib_number`),
      ).toEqual([{ racer_id: 'C' }, { racer_id: 'B' }, { racer_id: 'A' }]);
      expect(
        lastEvent(db).payload.entries.map((e) => e.service_number),
      ).toEqual(['C', 'B', 'A']);
      expect(() =>
        run(db, 'startList.saveBibOrder', {
          competitionId: COMP,
          raceId: RACE,
          bibs: [
            { racerId: 'A', bibNumber: 1 },
            { racerId: 'B', bibNumber: 1 },
          ],
        }),
      ).toThrow('bib 1 is assigned to both A and B');
      expect(() =>
        run(db, 'startList.saveBibOrder', {
          competitionId: COMP,
          raceId: RACE,
          bibs: [{ racerId: 'A', bibNumber: 0 }],
        }),
      ).toThrow('not a positive whole number');
    });
  });

  describe('people.merge', () => {
    it('moves references, drops colliding rows and deletes the source', () => {
      const db = openDatabase();
      run(db, 'results.saveFields', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        racerId: 'A',
        fields: { race_time: 60 },
      });
      run(db, 'results.saveFields', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        racerId: 'B',
        fields: { race_time: 62 },
      });
      db.prepare(`UPDATE races SET chief_of_race = 'A'`).run();

      run(db, 'people.merge', { sourceId: 'A', targetId: 'B' });

      expect(rows(db, `SELECT id FROM people ORDER BY id`)).toEqual([
        { id: 'B' },
        { id: 'C' },
      ]);
      // B already had a run-1 result, so A's colliding row was dropped
      expect(rows(db, `SELECT racer_id, race_time FROM race_results`)).toEqual([
        { racer_id: 'B', race_time: 62 },
      ]);
      expect(
        rows(
          db,
          `SELECT racer_id FROM competition_competitor ORDER BY racer_id`,
        ),
      ).toEqual([{ racer_id: 'B' }, { racer_id: 'C' }]);
      expect(rows(db, `SELECT chief_of_race FROM races`)).toEqual([
        { chief_of_race: 'B' },
      ]);
      expect(lastEvent(db)).toMatchObject({
        entity_type: 'competitor_merge',
        entity_key: { source_service_number: 'A', target_service_number: 'B' },
        payload: {},
      });
    });

    it('refuses a self-merge or an unknown person', () => {
      const db = openDatabase();
      expect(() =>
        run(db, 'people.merge', { sourceId: 'A', targetId: 'A' }),
      ).toThrow('same person');
      expect(() =>
        run(db, 'people.merge', { sourceId: 'A', targetId: 'Z' }),
      ).toThrow('person Z not found');
      expect(rows(db, `SELECT id FROM people`)).toHaveLength(3);
    });
  });

  describe('competitions.create', () => {
    it('creates a competition with a generated id and the given metadata', () => {
      const db = openDatabase();
      const result = run(db, 'competitions.create', {
        name: 'Ex SPARTAN HIKE',
        description: 'Qualifying meeting',
        level: 'qualifying',
        season: '2025-26',
        startDate: '2026-01-05',
        endDate: '2026-01-10',
        venue: 'Serre Chevalier',
      });

      expect(result.success).toBe(true);
      expect(result.competitionId).toMatch(/^[0-9a-f-]{36}$/);
      const row = db
        .prepare('SELECT * FROM competitions WHERE id = ?')
        .get(result.competitionId);
      expect(row).toMatchObject({
        competition_name: 'Ex SPARTAN HIKE',
        competition_description: 'Qualifying meeting',
        level: 'qualifying',
        season: '2025-26',
        start_date: '2026-01-05',
        end_date: '2026-01-10',
        venue: 'Serre Chevalier',
        sync_enabled: 0,
      });
      expect(row.updated_at).toEqual(expect.any(String));
      expect(lastEvent(db)).toMatchObject({
        entity_type: 'meeting',
        entity_key: {},
        payload: {
          name: 'Ex SPARTAN HIKE',
          description: 'Qualifying meeting',
          venue: 'Serre Chevalier',
          starts_on: '2026-01-05',
          ends_on: '2026-01-10',
        },
      });
    });

    it('stores blank optional fields as null', () => {
      const db = openDatabase();
      const { competitionId } = run(db, 'competitions.create', {
        name: 'Corps meeting',
        level: 'corps',
        season: '2025-26',
        startDate: '',
        venue: '',
      });
      expect(
        db
          .prepare('SELECT * FROM competitions WHERE id = ?')
          .get(competitionId),
      ).toMatchObject({
        competition_description: null,
        start_date: null,
        end_date: null,
        venue: null,
      });
    });

    it('rejects a missing name, an unknown level, a malformed season and reversed dates', () => {
      const db = openDatabase();
      const valid = { name: 'X', level: 'army', season: '2025-26' };
      expect(() =>
        run(db, 'competitions.create', { ...valid, name: '' }),
      ).toThrow('name is required');
      expect(() =>
        run(db, 'competitions.create', { ...valid, level: 'divisional' }),
      ).toThrow('level must be one of');
      expect(() =>
        run(db, 'competitions.create', { ...valid, season: '2025' }),
      ).toThrow('season must look like');
      expect(() =>
        run(db, 'competitions.create', { ...valid, season: '2025-27' }),
      ).toThrow('season must look like');
      expect(() =>
        run(db, 'competitions.create', { ...valid, startDate: '05/01/2026' }),
      ).toThrow('start_date must be a date');
      expect(() =>
        run(db, 'competitions.create', {
          ...valid,
          startDate: '2026-01-10',
          endDate: '2026-01-05',
        }),
      ).toThrow('end_date is before start_date');
      expect(rows(db, 'SELECT id FROM competitions')).toHaveLength(1);
    });
  });

  describe('competitions.update', () => {
    it('changes the given columns and stamps updated_at', () => {
      const db = openDatabase();
      run(db, 'competitions.update', {
        competitionId: COMP,
        fields: {
          competition_name: 'Renamed',
          level: 'corps',
          season: '2025-26',
          start_date: '2026-01-05',
          end_date: '2026-01-09',
          venue: "Val d'Isere",
          sync_enabled: true,
          remote_meeting_id: 'remote-1',
        },
      });
      expect(
        db.prepare('SELECT * FROM competitions WHERE id = ?').get(COMP),
      ).toMatchObject({
        competition_name: 'Renamed',
        level: 'corps',
        season: '2025-26',
        start_date: '2026-01-05',
        end_date: '2026-01-09',
        venue: "Val d'Isere",
        sync_enabled: 1,
        remote_meeting_id: 'remote-1',
        updated_at: expect.any(String),
      });
      // Level, season and the sync settings are the service's own business
      expect(lastEvent(db).payload).toEqual({
        name: 'Renamed',
        description: null,
        venue: "Val d'Isere",
        starts_on: '2026-01-05',
        ends_on: '2026-01-09',
      });
    });

    it('validates a changed date against the stored one', () => {
      const db = openDatabase();
      run(db, 'competitions.update', {
        competitionId: COMP,
        fields: { start_date: '2026-01-05' },
      });
      expect(() =>
        run(db, 'competitions.update', {
          competitionId: COMP,
          fields: { end_date: '2026-01-04' },
        }),
      ).toThrow('end_date is before start_date');
      // Clearing the start date lifts the constraint
      run(db, 'competitions.update', {
        competitionId: COMP,
        fields: { start_date: '', end_date: '2026-01-04' },
      });
      expect(
        db
          .prepare('SELECT start_date, end_date FROM competitions WHERE id = ?')
          .get(COMP),
      ).toEqual({ start_date: null, end_date: '2026-01-04' });
    });

    it('rejects unknown columns, a blank name, an empty change and a missing competition', () => {
      const db = openDatabase();
      expect(() =>
        run(db, 'competitions.update', {
          competitionId: COMP,
          fields: { id: 'other' },
        }),
      ).toThrow('unknown column(s) id');
      expect(() =>
        run(db, 'competitions.update', {
          competitionId: COMP,
          fields: { competition_name: '' },
        }),
      ).toThrow('competition_name cannot be blank');
      expect(() =>
        run(db, 'competitions.update', { competitionId: COMP, fields: {} }),
      ).toThrow('no columns given');
      expect(() =>
        run(db, 'competitions.update', {
          competitionId: 'missing',
          fields: { venue: 'X' },
        }),
      ).toThrow('competition missing not found');
    });
  });

  describe('sync outbox', () => {
    it('renders officials as display strings, never service numbers', () => {
      const db = openDatabase();
      db.prepare(
        `INSERT INTO people (id, first_name, last_name, title, country) VALUES ('30000009', 'Brian', 'Baker', 'Maj', 'GBR')`,
      ).run();
      db.prepare(
        `UPDATE races SET tech_delegate = '30000009', race_type = 'GS', race_date = '2026-01-05'`,
      ).run();
      db.prepare(
        `UPDATE race_run SET course_setter = '30000009', forerunner_a = '30000009', forerunner_b = 'unknown' WHERE run_number = 1`,
      ).run();
      const tx = createTx(db);

      const race = ENTITY_LOADERS.race(tx, COMP, { race_id: RACE });
      expect(race).toMatchObject({
        name: 'GS',
        race_type: 'GS',
        race_date: '2026-01-05',
        number_runs: 2,
        is_seeding: false,
        status: 'scheduled',
        officials: {
          tech_delegate: 'Maj BAKER B GBR',
          referee: null,
          asst_referee: null,
          chief_of_race: null,
        },
      });
      expect(JSON.stringify(race)).not.toContain('30000009');

      const run1 = ENTITY_LOADERS.race_run(tx, COMP, {
        race_id: RACE,
        run_number: 1,
      });
      expect(run1).toEqual({
        course_setter: 'Maj BAKER Brian GBR',
        number_gates: null,
        turning_gates: null,
        start_time: null,
        forerunners: ['BAKER GBR', null, null, null],
        is_complete: false,
      });
    });

    it('loads competitors, entries and teams in the contract shape', () => {
      const db = openDatabase();
      db.prepare(
        `UPDATE people SET title = 'Capt', birth_year = 1994, gender = 'F', country = 'GBR' WHERE id = 'A'`,
      ).run();
      db.prepare(
        `UPDATE competition_competitor SET regiment = '1 RHA', is_female = 1, is_senior = 1,
           arrival_corps_seed = 150.25, army_qual_opt_out = 1 WHERE racer_id = 'A'`,
      ).run();
      db.prepare(
        `INSERT INTO competition_team (competition_id, team_id, team_name, team_type, is_corps) VALUES (?, 't1', '1 RHA A', 'unit', 0)`,
      ).run(COMP);
      db.prepare(
        `INSERT INTO competition_team_members (competition_id, team_id, race_id, racer_id) VALUES (?, 't1', NULL, 'A'), (?, 't1', ?, 'B')`,
      ).run(COMP, COMP, RACE);
      const tx = createTx(db);

      expect(
        ENTITY_LOADERS.competitor(tx, COMP, { service_number: 'A' }),
      ).toEqual({
        first_name: 'A',
        last_name: 'Racer',
        title: 'Capt',
        birth_year: 1994,
        gender: 'F',
        country: 'GBR',
      });
      expect(
        ENTITY_LOADERS.meeting_entry(tx, COMP, { service_number: 'A' }),
      ).toMatchObject({
        regiment: '1 RHA',
        arrival_corps_seed: 150.25,
        arrival_army_seed: null,
        is_female: true,
        is_senior: true,
        is_novice: false,
        do_not_publish: false,
        army_opt_out: true,
      });
      expect(ENTITY_LOADERS.team(tx, COMP, { team_id: 't1' })).toEqual({
        name: '1 RHA A',
        team_type: 'unit',
        is_corps: false,
        is_reserve: false,
        is_female: false,
        is_hc: false,
      });
      expect(
        ENTITY_LOADERS.team_members(tx, COMP, { team_id: 't1', race_id: null }),
      ).toEqual({ service_numbers: ['A'] });
      expect(
        ENTITY_LOADERS.team_members(tx, COMP, { team_id: 't1', race_id: RACE }),
      ).toEqual({ service_numbers: ['B'] });
      // A missing row is null, so nothing stale can be published
      expect(
        ENTITY_LOADERS.competitor(tx, COMP, { service_number: 'Z' }),
      ).toBeNull();
    });

    it('every loader output satisfies the contract for its entity type', () => {
      const db = openDatabase();
      const tx = createTx(db);
      run(db, 'results.saveFields', {
        competitionId: COMP,
        raceId: RACE,
        runNumber: 1,
        racerId: 'A',
        fields: { race_time: 60 },
      });
      const cases = {
        meeting: {},
        competitor: { service_number: 'A' },
        meeting_entry: { service_number: 'A' },
        race: { race_id: RACE },
        race_run: { race_id: RACE, run_number: 1 },
        start_list: { race_id: RACE },
        result: { race_id: RACE, run_number: 1, service_number: 'A' },
      };
      Object.entries(cases).forEach(([entityType, key]) => {
        const data = ENTITY_LOADERS[entityType](tx, COMP, key);
        expect(() =>
          validateEvent({
            event_id: 1,
            entity_type: entityType,
            operation: 'upsert',
            key,
            data,
            occurred_at: new Date().toISOString(),
          }),
        ).not.toThrow();
      });
    });

    it('refuses to publish an entity that does not exist', () => {
      const db = openDatabase();
      const tx = createTx(db);
      expect(() =>
        emitEntity(tx, {
          competitionId: COMP,
          entityType: 'race',
          key: { race_id: 'missing' },
          operation: 'test',
        }),
      ).toThrow('cannot publish race {"race_id":"missing"}: not found');
      expect(events(db)).toEqual([]);
    });
  });
});
