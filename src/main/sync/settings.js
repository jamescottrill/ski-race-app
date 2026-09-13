/**
 * Sync settings, kept in the app preferences file (config.json) beside the
 * database path. The installation id identifies this copy of the app to the
 * central service; each competition's API key is stored encrypted with
 * Electron's safeStorage where the platform provides it.
 *
 * The file is re-read before every write so that other writers of the same
 * file (the database path chooser) are never overwritten with stale data.
 */
const { randomUUID } = require('crypto');

const DEFAULT_SERVER_URL = 'https://example.supabase.co';

const trimSlashes = (url) =>
  String(url || '')
    .trim()
    .replace(/\/+$/, '');

// The API key travels in a header, so the service must be reached over TLS;
// plain HTTP is allowed only for a local development stack
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];
function assertServerUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error(`Server URL "${url}" is not a valid URL`);
  }
  const local = LOCAL_HOSTS.includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) {
    throw new Error('Server URL must use https (http only for localhost)');
  }
}

/**
 * @param {{ load: () => any, save: (prefs: any) => void, safeStorage?: any }} options
 */
function createSettingsStore({ load, save, safeStorage = null }) {
  const canEncrypt = () =>
    Boolean(
      safeStorage &&
      typeof safeStorage.isEncryptionAvailable === 'function' &&
      safeStorage.isEncryptionAvailable(),
    );

  const read = () => {
    const prefs = load() || {};
    if (!prefs.sync) prefs.sync = {};
    if (!prefs.sync.competitions) prefs.sync.competitions = {};
    return prefs;
  };
  const write = (mutate) => {
    const prefs = read();
    const result = mutate(prefs);
    save(prefs);
    return result;
  };

  const encode = (key) =>
    canEncrypt()
      ? { cipher: safeStorage.encryptString(key).toString('base64') }
      : { plain: true, value: key };
  const decode = (entry) => {
    if (!entry) return null;
    if (entry.plain) return entry.value || null;
    if (entry.cipher && canEncrypt()) {
      return safeStorage.decryptString(Buffer.from(entry.cipher, 'base64'));
    }
    return null;
  };

  function installationId() {
    const existing = read().installationId;
    if (existing) return existing;
    return write((prefs) => {
      prefs.installationId = randomUUID();
      return prefs.installationId;
    });
  }

  // After a backup restore the outbox ids rewind, so the app presents itself
  // as a new installation to keep (installation, event id) unique
  function rotateInstallationId() {
    return write((prefs) => {
      prefs.installationId = randomUUID();
      return prefs.installationId;
    });
  }

  const getServerUrl = () => read().sync.serverUrl || DEFAULT_SERVER_URL;
  const setServerUrl = (url) => {
    const cleaned = trimSlashes(url);
    if (cleaned) assertServerUrl(cleaned);
    write((prefs) => {
      if (cleaned) prefs.sync.serverUrl = cleaned;
      else delete prefs.sync.serverUrl;
    });
  };

  const getApiKey = (competitionId) => {
    const entry = read().sync.competitions[competitionId];
    return entry ? decode(entry.apiKey) : null;
  };
  const setApiKey = (competitionId, key) =>
    write((prefs) => {
      prefs.sync.competitions[competitionId] = {
        apiKey: encode(String(key).trim()),
      };
    });
  const clearApiKey = (competitionId) =>
    write((prefs) => {
      delete prefs.sync.competitions[competitionId];
    });
  const hasApiKey = (competitionId) => Boolean(getApiKey(competitionId));
  const apiKeyHint = (competitionId) => {
    const key = getApiKey(competitionId);
    return key ? key.slice(-4) : null;
  };

  return {
    installationId,
    rotateInstallationId,
    getServerUrl,
    setServerUrl,
    getApiKey,
    setApiKey,
    clearApiKey,
    hasApiKey,
    apiKeyHint,
  };
}

module.exports = { createSettingsStore, DEFAULT_SERVER_URL };
