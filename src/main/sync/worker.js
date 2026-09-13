/**
 * The sync worker: drains the outbox to the central results service,
 * store-and-forward. Runs in the main process next to the database.
 *
 * Per competition it sends pending events strictly in id order, one batch
 * at a time, and interprets the answer:
 *   200          rows up to accepted_up_to_event_id are synced, rejected
 *                ids are dead (a data error the service will never accept)
 *   network      offline: back off, blame no event
 *   401          the key is wrong: stop until settings change or "Sync now"
 *   403 / 409    the key belongs to another meeting / the contract version is
 *                unsupported: stop likewise
 *   413          halve the batch and retry at once
 *   429          wait as long as the service asks
 *   other 4xx    isolate the bad event by resending one at a time
 *   5xx          the service is unwell: back off, attempts recorded
 *
 * Timers and randomness are injected so the tests drive it deterministically.
 */
const { SYNC_SCHEMA_VERSION, validateEvent } = require('@awsa/sync-contract');
const outbox = require('./outbox');

const DEBOUNCE_MS = 1500;
const TICK_MS = 15000;
const PING_MS = 60000;
const STATUS_THROTTLE_MS = 250;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

const STATES = {
  idle: 'idle',
  syncing: 'syncing',
  offline: 'offline',
  error: 'error',
  authError: 'auth_error',
  disabled: 'disabled',
};

const defaultTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => clearInterval(handle),
};

/**
 * @param {{ db: any, operation: (name: string, payload?: any) => any, settings: any,
 *   createClient: (options: any) => any, notify?: (status: any) => void,
 *   now?: () => number, random?: () => number, timers?: any, log?: any,
 *   appVersion?: string, hostname?: string }} options
 */
function createSyncWorker({
  db,
  operation,
  settings,
  createClient,
  notify = () => {},
  now = Date.now,
  random = Math.random,
  timers = defaultTimers,
  log = console,
  appVersion = '',
  hostname = '',
}) {
  const perCompetition = new Map();
  const debounceHandles = new Map();
  let tickHandle = null;
  let pingHandle = null;
  let statusHandle = null;
  let statusDirty = false;

  const iso = (ms) => new Date(ms).toISOString();
  const backoffDelay = (failures) =>
    Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** failures) *
    (0.5 + random());

  function stateFor(competitionId) {
    if (!perCompetition.has(competitionId)) {
      perCompetition.set(competitionId, {
        state: STATES.idle,
        failures: 0,
        nextAttemptAt: 0,
        lastError: null,
        halted: false,
        inFlight: false,
        dirty: false,
        batchSize: outbox.MAX_BATCH_EVENTS,
      });
    }
    return perCompetition.get(competitionId);
  }

  // ---- status -----------------------------------------------------------

  function statusOf(competitionId, st) {
    const totals = outbox.counts(db, competitionId);
    const persisted = outbox.getState(db, competitionId) || {};
    return {
      state: st.state,
      pending: totals.pending,
      dead: totals.dead,
      synced: totals.synced,
      lastSuccessAt: persisted.last_success_at || null,
      lastError: st.lastError || persisted.last_error || null,
      nextAttemptAt: st.nextAttemptAt ? iso(st.nextAttemptAt) : null,
      halted: st.halted,
    };
  }

  function status() {
    const result = {};
    db.prepare(`SELECT id, sync_enabled, remote_meeting_id FROM competitions`)
      .all()
      .forEach((row) => {
        const st = stateFor(row.id);
        const canPublish =
          Boolean(row.sync_enabled) &&
          Boolean(row.remote_meeting_id) &&
          settings.hasApiKey(row.id);
        if (!canPublish && !st.inFlight) st.state = STATES.disabled;
        else if (st.state === STATES.disabled) st.state = STATES.idle;
        result[row.id] = statusOf(row.id, st);
      });
    return result;
  }

  // Coalesce bursts of changes into one notification
  function publishStatus() {
    statusDirty = true;
    if (statusHandle) return;
    statusHandle = timers.setTimeout(() => {
      statusHandle = null;
      if (!statusDirty) return;
      statusDirty = false;
      try {
        notify(status());
      } catch (error) {
        log.error('sync status notification failed', error);
      }
    }, STATUS_THROTTLE_MS);
  }

  // ---- sending ----------------------------------------------------------

  function publishable(competitionId) {
    const row = outbox.competition(db, competitionId);
    if (
      !row ||
      !row.sync_enabled ||
      !row.remote_meeting_id ||
      !settings.hasApiKey(competitionId)
    ) {
      return null;
    }
    return row;
  }

  function clientFor(competitionId, overrides = {}) {
    return createClient({
      serverUrl: overrides.serverUrl || settings.getServerUrl(),
      apiKey: overrides.apiKey || settings.getApiKey(competitionId),
      appVersion,
    });
  }

  function recordFailure(competitionId, st, state, message) {
    st.state = state;
    st.lastError = message;
    st.failures += 1;
    st.nextAttemptAt = now() + backoffDelay(st.failures);
    outbox.updateState(db, competitionId, {
      last_error: message,
      last_error_at: iso(now()),
    });
  }

  function halt(competitionId, st, state, message) {
    st.state = state;
    st.lastError = message;
    st.halted = true;
    st.nextAttemptAt = 0;
    outbox.updateState(db, competitionId, {
      last_error: message,
      last_error_at: iso(now()),
    });
  }

  function errorMessage(response) {
    const body = response.body || {};
    return body.error || body.message || `HTTP ${response.status}`;
  }

  // Applies a service answer to the rows just sent. Returns true when the
  // worker should send the next batch straight away.
  function handleResponse(competitionId, st, sent, response) {
    const ids = sent.map((entry) => entry.row.id);
    const at = iso(now());
    const { status: code, body } = response;

    if (response.ok) {
      const acceptedUpTo = Number(body && body.accepted_up_to_event_id);
      if (!Number.isFinite(acceptedUpTo)) {
        recordFailure(
          competitionId,
          st,
          STATES.offline,
          'the service answered without accepted_up_to_event_id',
        );
        return false;
      }
      const rejected = Array.isArray(body.rejected) ? body.rejected : [];
      const rejectedIds = new Set(rejected.map((entry) => entry.event_id));
      outbox.markDead(
        db,
        rejected.map((entry) => ({
          id: entry.event_id,
          error: `${entry.code || 'rejected'}: ${entry.reason || 'rejected by the service'}`,
        })),
        at,
      );
      const synced = ids.filter(
        (id) => id <= acceptedUpTo && !rejectedIds.has(id),
      );
      outbox.markSynced(db, synced, at);
      st.failures = 0;
      st.batchSize = outbox.MAX_BATCH_EVENTS;
      st.lastError = null;
      st.nextAttemptAt = 0;
      st.state = STATES.idle;
      outbox.updateState(db, competitionId, {
        last_synced_event_id: Math.max(
          acceptedUpTo,
          (outbox.getState(db, competitionId) || {}).last_synced_event_id || 0,
        ),
        last_success_at: at,
        last_error: null,
        last_error_at: null,
      });
      return true;
    }

    if (code === 401) {
      halt(competitionId, st, STATES.authError, 'the API key was rejected');
      return false;
    }
    if (code === 403) {
      halt(
        competitionId,
        st,
        STATES.error,
        'the API key belongs to a different meeting',
      );
      return false;
    }
    if (code === 409) {
      halt(
        competitionId,
        st,
        STATES.error,
        'this version of the app is not supported by the service; update the app',
      );
      return false;
    }
    if (code === 413) {
      if (sent.length === 1) {
        outbox.markDead(db, [{ id: ids[0], error: 'event too large' }], at);
      } else {
        st.batchSize = Math.max(1, Math.floor(sent.length / 2));
      }
      return true;
    }
    if (code === 429) {
      st.state = STATES.offline;
      st.lastError = 'rate limited by the service';
      st.nextAttemptAt =
        now() + (response.retryAfterMs || backoffDelay(st.failures + 1));
      return false;
    }
    if (code >= 500) {
      outbox.bumpAttempts(db, ids, errorMessage(response), at);
      recordFailure(
        competitionId,
        st,
        STATES.offline,
        `the service failed (${errorMessage(response)})`,
      );
      return false;
    }
    // Any other 4xx: the batch as a whole was refused. Narrow down to the
    // offending event by sending one at a time; a lone refused event is dead.
    if (sent.length === 1) {
      outbox.markDead(db, [{ id: ids[0], error: errorMessage(response) }], at);
    } else {
      st.batchSize = 1;
    }
    return true;
  }

  async function sendOne(competitionId, comp, st) {
    const rows = outbox.pendingBatch(db, competitionId, {
      maxEvents: st.batchSize,
    });
    if (rows.length === 0) {
      st.state = STATES.idle;
      return false;
    }
    // A row that fails the contract is a bug in this app, not a retry case
    const sent = [];
    const invalid = [];
    rows.forEach((row) => {
      try {
        const event = validateEvent(outbox.toEnvelopeEvent(row));
        sent.push({ row, event });
      } catch (error) {
        invalid.push({ id: row.id, error: error.message });
      }
    });
    if (invalid.length > 0) outbox.markDead(db, invalid, iso(now()));
    if (sent.length === 0) return true;

    const envelope = {
      installation_id: settings.installationId(),
      meeting_id: comp.remote_meeting_id,
      schema_version: SYNC_SCHEMA_VERSION,
      app_version: appVersion,
      hostname,
      events: sent.map((entry) => entry.event),
    };
    let response;
    try {
      response = await clientFor(competitionId).pushBatch(envelope);
    } catch (error) {
      recordFailure(competitionId, st, STATES.offline, error.message);
      return false;
    }
    return handleResponse(competitionId, st, sent, response);
  }

  async function drain(competitionId) {
    const st = stateFor(competitionId);
    if (st.inFlight) {
      st.dirty = true;
      return;
    }
    const comp = publishable(competitionId);
    if (!comp) {
      st.state = STATES.disabled;
      publishStatus();
      return;
    }
    if (st.halted) return;
    st.inFlight = true;
    st.state = STATES.syncing;
    publishStatus();
    try {
      if (outbox.detectRestore(db, competitionId)) {
        log.warn(
          `sync: outbox for ${competitionId} is behind the service; restating everything as a new installation`,
        );
        settings.rotateInstallationId();
        operation('sync.snapshotCompetition', { competitionId });
      }
      let more = true;
      while (more) {
        // eslint-disable-next-line no-await-in-loop
        more = await sendOne(competitionId, comp, st);
      }
    } catch (error) {
      recordFailure(competitionId, st, STATES.error, error.message);
      log.error(`sync: drain of ${competitionId} failed`, error);
    } finally {
      st.inFlight = false;
      if (st.dirty) {
        // Changes arrived while this drain was in flight: go again at once
        st.dirty = false;
        timers.setTimeout(() => {
          drain(competitionId).catch((error) =>
            log.error('sync drain failed', error),
          );
        }, 0);
      }
      publishStatus();
    }
  }

  // ---- scheduling -------------------------------------------------------

  async function tick() {
    const due = outbox
      .publishableCompetitions(db)
      .map((row) => row.id)
      .filter((id) => {
        const st = stateFor(id);
        return (
          !st.inFlight &&
          !st.halted &&
          st.nextAttemptAt <= now() &&
          outbox.counts(db, id).pending > 0
        );
      });
    await Promise.all(due.map((id) => drain(id)));
  }

  /** @param {{ competitionId?: string, immediate?: boolean }} [request] */
  function requestSync({ competitionId, immediate = false } = {}) {
    if (!competitionId) {
      tick().catch((error) => log.error('sync tick failed', error));
      return;
    }
    if (debounceHandles.has(competitionId)) {
      timers.clearTimeout(debounceHandles.get(competitionId));
    }
    const handle = timers.setTimeout(
      () => {
        debounceHandles.delete(competitionId);
        const st = stateFor(competitionId);
        if (st.nextAttemptAt > now() || st.halted) return;
        drain(competitionId).catch((error) =>
          log.error('sync drain failed', error),
        );
      },
      immediate ? 0 : DEBOUNCE_MS,
    );
    debounceHandles.set(competitionId, handle);
  }

  function resetForRetry(competitionId) {
    const st = stateFor(competitionId);
    st.halted = false;
    st.failures = 0;
    st.nextAttemptAt = 0;
    st.lastError = null;
    if (st.state !== STATES.syncing) st.state = STATES.idle;
  }

  async function syncNow(competitionId) {
    resetForRetry(competitionId);
    await drain(competitionId);
    return status()[competitionId] || null;
  }

  async function publishAll(competitionId) {
    const result = operation('sync.snapshotCompetition', { competitionId });
    await syncNow(competitionId);
    return result;
  }

  // Called when the organiser changes the key or server: a halted competition
  // deserves another go
  function settingsChanged(competitionId) {
    resetForRetry(competitionId);
    requestSync({ competitionId, immediate: true });
  }

  async function testConnection(competitionId, overrides = {}) {
    let response;
    try {
      response = await clientFor(competitionId, overrides).ping({
        installation_id: settings.installationId(),
        app_version: appVersion,
        schema_version: SYNC_SCHEMA_VERSION,
        hostname,
      });
    } catch (error) {
      return { ok: false, offline: true, error: error.message };
    }
    if (!response.ok || !response.body || !response.body.meeting) {
      return {
        ok: false,
        status: response.status,
        error: errorMessage(response),
      };
    }
    const { meeting } = response.body;
    operation('competitions.update', {
      competitionId,
      fields: { remote_meeting_id: meeting.id },
    });
    resetForRetry(competitionId);
    publishStatus();
    return {
      ok: true,
      meeting,
      supportedSchemaVersions: response.body.supported_schema_versions || [],
    };
  }

  async function pingAll() {
    await Promise.all(
      outbox.publishableCompetitions(db).map(async ({ id }) => {
        if (!settings.hasApiKey(id)) return;
        try {
          const persisted = outbox.getState(db, id) || {};
          await clientFor(id).ping({
            installation_id: settings.installationId(),
            app_version: appVersion,
            schema_version: SYNC_SCHEMA_VERSION,
            hostname,
            outbox_pending: outbox.counts(db, id).pending,
            last_event_id: persisted.last_synced_event_id || 0,
          });
        } catch (error) {
          log.info(`sync: ping for ${id} failed: ${error.message}`);
        }
      }),
    );
  }

  function start() {
    if (tickHandle) return;
    tickHandle = timers.setInterval(() => {
      tick().catch((error) => log.error('sync tick failed', error));
    }, TICK_MS);
    pingHandle = timers.setInterval(() => {
      pingAll().catch((error) => log.error('sync ping failed', error));
    }, PING_MS);
    if (tickHandle && typeof tickHandle.unref === 'function')
      tickHandle.unref();
    if (pingHandle && typeof pingHandle.unref === 'function')
      pingHandle.unref();
    requestSync();
  }

  function stop() {
    if (tickHandle) timers.clearInterval(tickHandle);
    if (pingHandle) timers.clearInterval(pingHandle);
    tickHandle = null;
    pingHandle = null;
    debounceHandles.forEach((handle) => timers.clearTimeout(handle));
    debounceHandles.clear();
    if (statusHandle) {
      timers.clearTimeout(statusHandle);
      statusHandle = null;
    }
  }

  return {
    start,
    stop,
    requestSync,
    syncNow,
    publishAll,
    settingsChanged,
    testConnection,
    drain,
    tick,
    pingAll,
    status,
  };
}

module.exports = { createSyncWorker, STATES, DEBOUNCE_MS, TICK_MS, PING_MS };
