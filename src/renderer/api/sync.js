/**
 * Sync with the central results service, exposed by the preload script as
 * window.sync. Thin wrappers so pages never touch the bridge directly.
 */
const bridge = () => window.sync;

export const getSyncSettings = (competitionId) =>
  bridge().getSettings(competitionId);

export const setSyncSettings = (competitionId, patch) =>
  bridge().setSettings(competitionId, patch);

export const testConnection = (competitionId, overrides) =>
  bridge().testConnection(competitionId, overrides);

export const syncNow = (competitionId) => bridge().syncNow(competitionId);

export const publishAll = (competitionId) => bridge().publishAll(competitionId);

export const getSyncStatus = () => bridge().getStatus();

export const getSyncLog = (competitionId, options) =>
  bridge().getLog(competitionId, options);

export const retrySyncEvents = (competitionId, ids) =>
  bridge().retryEvents(competitionId, ids);

export const discardSyncEvents = (competitionId, ids) =>
  bridge().discardEvents(competitionId, ids);

export const onSyncStatus = (callback) => bridge().onStatus(callback);
