/**
 * @jest-environment node
 */
const {
  createSettingsStore,
  DEFAULT_SERVER_URL,
} = require('../main/sync/settings');

// A file-like store: load returns a copy, save replaces the copy
function memoryFile(initial = {}) {
  let contents = JSON.parse(JSON.stringify(initial));
  return {
    load: () => JSON.parse(JSON.stringify(contents)),
    save: (prefs) => {
      contents = JSON.parse(JSON.stringify(prefs));
    },
    peek: () => contents,
  };
}

// Reversible stand-in for Electron's safeStorage
const fakeSafeStorage = (available = true) => ({
  isEncryptionAvailable: () => available,
  encryptString: (text) =>
    Buffer.from(`enc:${text.split('').reverse().join('')}`),
  decryptString: (buffer) =>
    buffer.toString().replace(/^enc:/, '').split('').reverse().join(''),
});

describe('sync settings store', () => {
  it('generates an installation id once and keeps it', () => {
    const file = memoryFile({ databasePath: '/tmp/x.db' });
    const store = createSettingsStore({ ...file });
    const id = store.installationId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.installationId()).toBe(id);
    expect(createSettingsStore({ ...file }).installationId()).toBe(id);
    expect(store.rotateInstallationId()).not.toBe(id);
  });

  it('stores the API key encrypted when the platform allows it', () => {
    const file = memoryFile();
    const store = createSettingsStore({
      ...file,
      safeStorage: fakeSafeStorage(),
    });
    store.setApiKey('comp', ' awsa_abc_1234 ');
    expect(store.getApiKey('comp')).toBe('awsa_abc_1234');
    expect(store.hasApiKey('comp')).toBe(true);
    expect(store.apiKeyHint('comp')).toBe('1234');
    const stored = file.peek().sync.competitions.comp.apiKey;
    expect(stored.plain).toBeUndefined();
    expect(stored.cipher).not.toContain('awsa');
    store.clearApiKey('comp');
    expect(store.getApiKey('comp')).toBeNull();
    expect(store.apiKeyHint('comp')).toBeNull();
  });

  it('falls back to a marked plain value without encryption', () => {
    const file = memoryFile();
    const store = createSettingsStore({
      ...file,
      safeStorage: fakeSafeStorage(false),
    });
    store.setApiKey('comp', 'awsa_key');
    expect(file.peek().sync.competitions.comp.apiKey).toEqual({
      plain: true,
      value: 'awsa_key',
    });
    expect(store.getApiKey('comp')).toBe('awsa_key');
  });

  it('defaults the server URL and trims a trailing slash', () => {
    const file = memoryFile();
    const store = createSettingsStore({ ...file });
    expect(store.getServerUrl()).toBe(DEFAULT_SERVER_URL);
    store.setServerUrl('https://abc.supabase.co/ ');
    expect(store.getServerUrl()).toBe('https://abc.supabase.co');
    store.setServerUrl('');
    expect(store.getServerUrl()).toBe(DEFAULT_SERVER_URL);
  });

  it('refuses a server URL that would send the key in clear', () => {
    const store = createSettingsStore({ ...memoryFile() });
    expect(() => store.setServerUrl('http://abc.supabase.co')).toThrow(
      'must use https',
    );
    expect(() => store.setServerUrl('not a url')).toThrow('not a valid URL');
    store.setServerUrl('http://localhost:54321');
    expect(store.getServerUrl()).toBe('http://localhost:54321');
  });

  it('re-reads the file before writing so other keys survive', () => {
    const file = memoryFile({ databasePath: '/tmp/old.db' });
    const store = createSettingsStore({ ...file });
    store.setServerUrl('https://abc.supabase.co');
    // Another writer changes the database path in the meantime
    const other = file.load();
    other.databasePath = '/tmp/new.db';
    file.save(other);
    store.setApiKey('comp', 'k');
    expect(file.peek().databasePath).toBe('/tmp/new.db');
    expect(file.peek().sync.serverUrl).toBe('https://abc.supabase.co');
  });
});
