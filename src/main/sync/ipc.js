/**
 * IPC surface for sync: settings, connection test, manual sync, status and
 * the event log. The renderer reaches these through window.sync (preload).
 */
const outbox = require('./outbox');

const CHANNELS = {
  settingsGet: 'sync-settings-get',
  settingsSet: 'sync-settings-set',
  testConnection: 'sync-test-connection',
  syncNow: 'sync-now',
  publishAll: 'sync-publish-all',
  statusGet: 'sync-status-get',
  log: 'sync-log',
  retryEvents: 'sync-retry-events',
  discardEvents: 'sync-discard-events',
  statusPush: 'sync-status',
};

/**
 * @param {{ ipcMain: any, worker: any, settings: any, db: any,
 *   operation: (name: string, payload?: any) => any }} options
 */
function registerSyncIpc({ ipcMain, worker, settings, db, operation }) {
  const settingsFor = (competitionId) => {
    const row = outbox.competition(db, competitionId);
    return {
      serverUrl: settings.getServerUrl(),
      hasApiKey: settings.hasApiKey(competitionId),
      apiKeyHint: settings.apiKeyHint(competitionId),
      syncEnabled: Boolean(row && row.sync_enabled),
      remoteMeetingId: row ? row.remote_meeting_id : null,
      level: row ? row.level : null,
      season: row ? row.season : null,
    };
  };

  ipcMain.handle(CHANNELS.settingsGet, (event, competitionId) =>
    settingsFor(competitionId),
  );

  ipcMain.handle(CHANNELS.settingsSet, (event, competitionId, patch = {}) => {
    if (patch.serverUrl !== undefined) settings.setServerUrl(patch.serverUrl);
    if (patch.apiKey !== undefined) {
      if (patch.apiKey) settings.setApiKey(competitionId, patch.apiKey);
      else settings.clearApiKey(competitionId);
    }
    if (patch.syncEnabled !== undefined) {
      operation('competitions.update', {
        competitionId,
        fields: { sync_enabled: Boolean(patch.syncEnabled) },
      });
    }
    worker.settingsChanged(competitionId);
    return settingsFor(competitionId);
  });

  ipcMain.handle(CHANNELS.testConnection, (event, competitionId, overrides) =>
    worker.testConnection(competitionId, overrides || {}),
  );
  ipcMain.handle(CHANNELS.syncNow, (event, competitionId) =>
    worker.syncNow(competitionId),
  );
  ipcMain.handle(CHANNELS.publishAll, (event, competitionId) =>
    worker.publishAll(competitionId),
  );
  ipcMain.handle(CHANNELS.statusGet, () => worker.status());
  ipcMain.handle(CHANNELS.log, (event, competitionId, options) =>
    outbox.logEvents(db, competitionId, options || {}),
  );
  ipcMain.handle(CHANNELS.retryEvents, (event, competitionId, ids) => {
    const changed = outbox.retryEvents(db, ids || []);
    worker.settingsChanged(competitionId);
    return { changed };
  });
  ipcMain.handle(CHANNELS.discardEvents, (event, competitionId, ids) => ({
    changed: outbox.discardEvents(db, ids || []),
  }));
}

module.exports = { registerSyncIpc, CHANNELS };
