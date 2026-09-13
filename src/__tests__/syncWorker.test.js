/**
 * @jest-environment node
 */
const { createSchema } = require('../main/utils/migrations');
const { runOperation } = require('../main/operations');
const { createSettingsStore } = require('../main/sync/settings');
const { createClient } = require('../main/sync/client');
const { createSyncWorker, STATES } = require('../main/sync/worker');
const outbox = require('../main/sync/outbox');

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
const MEETING = '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4';
const T0 = Date.UTC(2026, 0, 5, 10, 0, 0);

function openDatabase({ syncEnabled = 1, remoteMeetingId = MEETING } = {}) {
  const db = new sqlite.DatabaseSync(':memory:');
  createSchema(db);
  db.prepare(
    `INSERT INTO competitions (id, competition_name, level, season, sync_enabled, remote_meeting_id)
     VALUES (?, 'Test', 'corps', '2025-26', ?, ?)`,
  ).run(COMP, syncEnabled, remoteMeetingId);
  db.prepare(
    `INSERT INTO races (competition_id, race_id, race_name, race_type, number_runs) VALUES (?, ?, 'GS', 'GS', 2)`,
  ).run(COMP, RACE);
  [1, 2].forEach((run) =>
    db
      .prepare(
        `INSERT INTO race_run (competition_id, race_id, run_id, run_number, is_complete) VALUES (?, ?, ?, ?, 0)`,
      )
      .run(COMP, RACE, `${RACE}-run-${run}`, run),
  );
  ['A', 'B', 'C', 'D'].forEach((id, i) => {
    db.prepare(
      `INSERT INTO people (id, first_name, last_name, gender) VALUES (?, ?, 'Racer', 'M')`,
    ).run(id, id);
    db.prepare(
      `INSERT INTO competition_competitor (competition_id, racer_id) VALUES (?, ?)`,
    ).run(COMP, id);
    db.prepare(
      `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number) VALUES (?, ?, ?, ?)`,
    ).run(COMP, RACE, id, i + 1);
  });
  return db;
}

const record = (db, racerId, time) =>
  runOperation(db, 'results.saveFields', {
    competitionId: COMP,
    raceId: RACE,
    runNumber: 1,
    racerId,
    fields: { race_time: time },
  });

const statuses = (db) =>
  db.prepare(`SELECT id, status, attempts FROM sync_events ORDER BY id`).all();

const response = ({ status = 200, body = {}, headers = {} }) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const accept = (upTo, rejected = []) => ({
  status: 200,
  body: {
    accepted_up_to_event_id: upTo,
    applied: upTo,
    duplicates: 0,
    rejected,
  },
});

// Timers under test control: nothing fires until flush() is called
function fakeTimers() {
  const pending = [];
  let seq = 0;
  return {
    pending,
    setTimeout: (fn, ms) => {
      seq += 1;
      const handle = { id: seq, fn, ms };
      pending.push(handle);
      return handle;
    },
    clearTimeout: (handle) => {
      const index = pending.indexOf(handle);
      if (index >= 0) pending.splice(index, 1);
    },
    setInterval: (fn, ms) => ({ fn, ms, interval: true }),
    clearInterval: () => {},
    async flush() {
      while (pending.length > 0) {
        const handle = pending.shift();
        // eslint-disable-next-line no-await-in-loop
        await handle.fn();
      }
    },
  };
}

function makeWorker(db, responses = [], { withKey = true } = {}) {
  const queue = [...responses];
  const fetchImpl = jest.fn(async () => {
    const next = queue.shift() || accept(Number.MAX_SAFE_INTEGER);
    if (next.throw) throw next.throw;
    return response(next);
  });
  let file = {};
  const settings = createSettingsStore({
    load: () => JSON.parse(JSON.stringify(file)),
    save: (prefs) => {
      file = JSON.parse(JSON.stringify(prefs));
    },
  });
  settings.setServerUrl('https://abc.supabase.co');
  if (withKey) settings.setApiKey(COMP, 'awsa_key_1234');
  const timers = fakeTimers();
  const clock = { now: T0 };
  const notifications = [];
  const worker = createSyncWorker({
    db,
    operation: (name, payload) => runOperation(db, name, payload),
    settings,
    createClient: (options) => createClient({ fetchImpl, ...options }),
    notify: (status) => notifications.push(status),
    now: () => clock.now,
    random: () => 0.5,
    timers,
    log: { info() {}, warn() {}, error() {} },
    appVersion: '0.2.0',
    hostname: 'test-laptop',
  });
  const calls = () =>
    fetchImpl.mock.calls.map(([url, init]) => ({
      url,
      headers: init.headers,
      body: JSON.parse(init.body),
    }));
  return { worker, fetchImpl, settings, timers, clock, notifications, calls };
}

describeWithSqlite('sync worker', () => {
  it('sends pending events in order and marks them synced when accepted', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    record(db, 'B', 61);
    const { worker, calls, settings } = makeWorker(db, [accept(2)]);

    await worker.drain(COMP);

    const [call] = calls();
    expect(call.url).toBe('https://abc.supabase.co/functions/v1/ingest');
    expect(call.headers['x-api-key']).toBe('awsa_key_1234');
    expect(call.body).toMatchObject({
      installation_id: settings.installationId(),
      meeting_id: MEETING,
      schema_version: 1,
      app_version: '0.2.0',
      hostname: 'test-laptop',
    });
    expect(call.body.events.map((e) => e.event_id)).toEqual([1, 2]);
    expect(statuses(db)).toEqual([
      { id: 1, status: 'synced', attempts: 0 },
      { id: 2, status: 'synced', attempts: 0 },
    ]);
    expect(outbox.getState(db, COMP)).toMatchObject({
      last_synced_event_id: 2,
      last_success_at: new Date(T0).toISOString(),
      last_error: null,
    });
    expect(worker.status()[COMP]).toMatchObject({
      state: STATES.idle,
      pending: 0,
      synced: 2,
      dead: 0,
    });
  });

  it('dead-letters events the service rejects and keeps going', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    record(db, 'B', 61);
    record(db, 'C', 62);
    const { worker } = makeWorker(db, [
      accept(3, [{ event_id: 2, code: 'P0001', reason: 'unknown entry' }]),
    ]);
    await worker.drain(COMP);
    expect(statuses(db)).toEqual([
      { id: 1, status: 'synced', attempts: 0 },
      { id: 2, status: 'dead', attempts: 1 },
      { id: 3, status: 'synced', attempts: 0 },
    ]);
    expect(
      db.prepare(`SELECT last_error FROM sync_events WHERE id = 2`).get(),
    ).toEqual({ last_error: 'P0001: unknown entry' });
    expect(worker.status()[COMP]).toMatchObject({ dead: 1, pending: 0 });
  });

  it('backs off on a server error, recording the attempt', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    const { worker, clock, fetchImpl } = makeWorker(db, [
      { status: 500, body: { error: 'db down' } },
    ]);
    await worker.drain(COMP);
    expect(statuses(db)).toEqual([{ id: 1, status: 'pending', attempts: 1 }]);
    const status = worker.status()[COMP];
    expect(status.state).toBe(STATES.offline);
    expect(status.lastError).toContain('db down');
    // failures = 1: 2 s * 2^1 * (0.5 + 0.5) = 4 s
    expect(new Date(status.nextAttemptAt).getTime()).toBe(T0 + 4000);
    // Not due yet: the tick leaves it alone
    await worker.tick();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock.now = T0 + 4001;
    await worker.tick();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(statuses(db)).toEqual([{ id: 1, status: 'synced', attempts: 1 }]);
  });

  it('treats a network failure or a non-JSON answer as offline without blaming events', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    const { worker, clock } = makeWorker(db, [
      { throw: new Error('ENETUNREACH') },
      { status: 200, body: '<html>captive portal</html>' },
    ]);
    await worker.drain(COMP);
    expect(worker.status()[COMP]).toMatchObject({
      state: STATES.offline,
      lastError: 'ENETUNREACH',
    });
    expect(statuses(db)).toEqual([{ id: 1, status: 'pending', attempts: 0 }]);
    clock.now = T0 + 60000;
    await worker.tick();
    expect(worker.status()[COMP].lastError).toContain('captive portal');
    expect(statuses(db)).toEqual([{ id: 1, status: 'pending', attempts: 0 }]);
  });

  it('stops on a rejected key until asked to sync again', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    const { worker, fetchImpl, clock } = makeWorker(db, [
      { status: 401, body: { error: 'unknown key' } },
      accept(1),
    ]);
    await worker.drain(COMP);
    expect(worker.status()[COMP]).toMatchObject({
      state: STATES.authError,
      halted: true,
    });
    clock.now = T0 + 3600000;
    await worker.tick();
    await worker.drain(COMP);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await worker.syncNow(COMP);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(statuses(db)).toEqual([{ id: 1, status: 'synced', attempts: 0 }]);
  });

  it('halts on a meeting mismatch or an unsupported contract version', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    const { worker } = makeWorker(db, [
      { status: 409, body: { supported: [2] } },
    ]);
    await worker.drain(COMP);
    expect(worker.status()[COMP]).toMatchObject({
      state: STATES.error,
      halted: true,
    });
    expect(worker.status()[COMP].lastError).toContain('update the app');
  });

  it('halves the batch on 413 and dead-letters a lone oversized event', async () => {
    const db = openDatabase();
    ['A', 'B', 'C', 'D'].forEach((id, i) => record(db, id, 60 + i));
    const { worker, calls } = makeWorker(db, [
      { status: 413, body: {} },
      accept(2),
      accept(4),
    ]);
    await worker.drain(COMP);
    expect(calls().map((c) => c.body.events.length)).toEqual([4, 2, 2]);
    expect(statuses(db).every((row) => row.status === 'synced')).toBe(true);

    const single = openDatabase();
    record(single, 'A', 60);
    const lone = makeWorker(single, [{ status: 413, body: {} }]);
    await lone.worker.drain(COMP);
    expect(statuses(single)).toEqual([{ id: 1, status: 'dead', attempts: 1 }]);
  });

  it('waits as long as the service asks when rate limited', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    const { worker, fetchImpl } = makeWorker(db, [
      { status: 429, body: { retry_after_seconds: 30 } },
    ]);
    await worker.drain(COMP);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const status = worker.status()[COMP];
    expect(new Date(status.nextAttemptAt).getTime()).toBe(T0 + 30000);
    expect(statuses(db)).toEqual([{ id: 1, status: 'pending', attempts: 0 }]);
  });

  it('isolates a refused event by sending one at a time', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    record(db, 'B', 61);
    const { worker, calls } = makeWorker(db, [
      { status: 400, body: { error: 'bad_envelope' } },
      { status: 400, body: { error: 'bad event' } },
      accept(2),
    ]);
    await worker.drain(COMP);
    expect(calls().map((c) => c.body.events.map((e) => e.event_id))).toEqual([
      [1, 2],
      [1],
      [2],
    ]);
    expect(statuses(db)).toEqual([
      { id: 1, status: 'dead', attempts: 1 },
      { id: 2, status: 'synced', attempts: 0 },
    ]);
  });

  it('sends the next batch only after the previous one is answered', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    record(db, 'B', 61);
    let release;
    const first = new Promise((resolve) => {
      release = resolve;
    });
    const fetchImpl = jest.fn();
    fetchImpl
      .mockImplementationOnce(async () => {
        await first;
        return response(accept(1));
      })
      .mockImplementationOnce(async () => response(accept(2)));
    let file = {};
    const settings = createSettingsStore({
      load: () => JSON.parse(JSON.stringify(file)),
      save: (prefs) => {
        file = prefs;
      },
    });
    settings.setApiKey(COMP, 'k');
    const worker = createSyncWorker({
      db,
      operation: (name, payload) => runOperation(db, name, payload),
      settings,
      createClient: (options) => createClient({ fetchImpl, ...options }),
      timers: fakeTimers(),
      log: { info() {}, warn() {}, error() {} },
    });
    const draining = worker.drain(COMP);
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // A second request while in flight is queued, not sent in parallel
    await worker.drain(COMP);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    release();
    await draining;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(statuses(db).map((row) => row.status)).toEqual(['synced', 'synced']);
  });

  it('coalesces bursts of change notifications into one drain', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    const { worker, timers, fetchImpl } = makeWorker(db, [accept(1)]);
    worker.requestSync({ competitionId: COMP });
    worker.requestSync({ competitionId: COMP });
    worker.requestSync({ competitionId: COMP });
    expect(timers.pending.filter((h) => h.ms === 1500)).toHaveLength(1);
    await timers.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a competition that is not publishable', async () => {
    const disabled = openDatabase({ syncEnabled: 0 });
    record(disabled, 'A', 60);
    const off = makeWorker(disabled);
    await off.worker.drain(COMP);
    await off.worker.tick();
    expect(off.fetchImpl).not.toHaveBeenCalled();
    expect(off.worker.status()[COMP].state).toBe(STATES.disabled);

    const unbound = openDatabase({ remoteMeetingId: null });
    record(unbound, 'A', 60);
    const noMeeting = makeWorker(unbound);
    await noMeeting.worker.drain(COMP);
    expect(noMeeting.fetchImpl).not.toHaveBeenCalled();

    const keyless = openDatabase();
    record(keyless, 'A', 60);
    const noKey = makeWorker(keyless, [], { withKey: false });
    await noKey.worker.drain(COMP);
    expect(noKey.fetchImpl).not.toHaveBeenCalled();
    expect(noKey.worker.status()[COMP].state).toBe(STATES.disabled);
  });

  it('restates everything as a new installation after a backup restore', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    outbox.updateState(db, COMP, { last_synced_event_id: 500 });
    const { worker, settings, calls } = makeWorker(db, [
      accept(Number.MAX_SAFE_INTEGER),
    ]);
    const before = settings.installationId();

    await worker.drain(COMP);

    expect(settings.installationId()).not.toBe(before);
    const [call] = calls();
    expect(call.body.installation_id).toBe(settings.installationId());
    const types = call.body.events.map((e) => e.entity_type);
    expect(types[0]).toBe('meeting');
    expect(types.at(-1)).toBe('snapshot_marker');
    expect(outbox.getState(db, COMP).last_snapshot_id).toEqual(
      expect.any(String),
    );
  });

  it('publishAll snapshots then syncs, and testConnection binds the meeting', async () => {
    const db = openDatabase({ remoteMeetingId: null });
    const { worker, calls, fetchImpl } = makeWorker(db, [
      {
        status: 200,
        body: {
          ok: true,
          meeting: {
            id: MEETING,
            slug: 'demo',
            name: 'Demo',
            is_published: false,
          },
          supported_schema_versions: [1],
        },
      },
      accept(Number.MAX_SAFE_INTEGER),
    ]);
    const test = await worker.testConnection(COMP, {});
    expect(test).toMatchObject({ ok: true, meeting: { id: MEETING } });
    expect(calls()[0].url).toBe('https://abc.supabase.co/functions/v1/ping');
    expect(
      db
        .prepare(`SELECT remote_meeting_id FROM competitions WHERE id = ?`)
        .get(COMP),
    ).toEqual({ remote_meeting_id: MEETING });

    const result = await worker.publishAll(COMP);
    expect(result.counts.meeting).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(calls()[1].body.events.at(-1).entity_type).toBe('snapshot_marker');
    expect(worker.status()[COMP]).toMatchObject({
      state: STATES.idle,
      pending: 0,
    });

    const bad = makeWorker(db, [
      { status: 401, body: { error: 'unknown key' } },
    ]);
    expect(await bad.worker.testConnection(COMP, { apiKey: 'wrong' })).toEqual({
      ok: false,
      status: 401,
      error: 'unknown key',
    });
    const offline = makeWorker(db, [{ throw: new Error('ENETUNREACH') }]);
    expect(await offline.worker.testConnection(COMP, {})).toMatchObject({
      ok: false,
      offline: true,
    });
  });

  it('pushes a throttled status notification', async () => {
    const db = openDatabase();
    record(db, 'A', 60);
    const { worker, timers, notifications } = makeWorker(db, [accept(1)]);
    await worker.drain(COMP);
    expect(notifications).toHaveLength(0);
    await timers.flush();
    expect(notifications).toHaveLength(1);
    expect(notifications[0][COMP]).toMatchObject({
      state: STATES.idle,
      synced: 1,
    });
  });
});
