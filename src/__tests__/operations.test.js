/**
 * @jest-environment node
 */
const { createSchema } = require('../main/utils/migrations');
const { runOperation } = require('../main/operations');

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
const events = (db) =>
  rows(
    db,
    `SELECT operation, run_number, racer_id, payload FROM result_events ORDER BY id`,
  );
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
      expect(
        events(db).map((e) => [e.operation, e.racer_id, JSON.parse(e.payload)]),
      ).toEqual([
        ['results.saveFields', 'A', { race_time: 61.2, is_dnf: 0 }],
        ['results.saveFields', 'A', { is_dsq: 1, dsq_gate: 4 }],
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
      expect(events(db).at(-1)).toMatchObject({
        operation: 'results.setRunComplete',
        run_number: 1,
      });
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
      expect(events(db)).toHaveLength(2);
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
});
