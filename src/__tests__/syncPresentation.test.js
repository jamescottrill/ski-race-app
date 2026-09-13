import {
  SYNC_STATE_TONES,
  LOG_STATUS_TONES,
  formatClock,
  formatDateTime,
  describeSyncStatus,
  describeSyncDetail,
  summariseKey,
  prettyPayload,
  parseJson,
  entityLabel,
} from '../renderer/utils/syncPresentation';

const status = (overrides) => ({
  state: 'idle',
  pending: 0,
  dead: 0,
  synced: 10,
  lastSuccessAt: null,
  lastError: null,
  nextAttemptAt: null,
  halted: false,
  ...overrides,
});

// A fixed local time so the clock text is predictable wherever the test runs
const at = new Date(2026, 0, 5, 10, 42).toISOString();

describe('describeSyncStatus', () => {
  it('labels every worker state', () => {
    expect(describeSyncStatus(null)).toEqual({
      label: 'Not published',
      tone: 'default',
    });
    expect(describeSyncStatus(status({ state: 'disabled' }))).toEqual({
      label: 'Not published',
      tone: 'default',
    });
    expect(describeSyncStatus(status({ state: 'auth_error' }))).toEqual({
      label: 'API key rejected',
      tone: 'danger',
    });
    expect(describeSyncStatus(status({ state: 'error' }))).toEqual({
      label: 'Sync halted',
      tone: 'danger',
    });
    expect(
      describeSyncStatus(status({ state: 'syncing', pending: 12 })),
    ).toEqual({ label: 'Syncing · 12 pending', tone: 'primary' });
    expect(
      describeSyncStatus(status({ state: 'offline', pending: 340 })),
    ).toEqual({ label: 'Offline · 340 queued', tone: 'warning' });
  });

  it('shows the last success time when idle and up to date', () => {
    expect(describeSyncStatus(status({ lastSuccessAt: at }))).toEqual({
      label: 'Up to date · 10:42',
      tone: 'success',
    });
    expect(describeSyncStatus(status())).toEqual({
      label: 'Up to date',
      tone: 'success',
    });
  });

  it('puts failed and pending events before up to date', () => {
    expect(describeSyncStatus(status({ dead: 3, lastSuccessAt: at }))).toEqual({
      label: '3 failed',
      tone: 'danger',
    });
    expect(describeSyncStatus(status({ pending: 2 }))).toEqual({
      label: '2 pending',
      tone: 'warning',
    });
  });

  it('has a tone for every state and log status', () => {
    ['idle', 'syncing', 'offline', 'error', 'auth_error', 'disabled'].forEach(
      (state) => expect(SYNC_STATE_TONES[state]).toEqual(expect.any(String)),
    );
    ['pending', 'synced', 'dead', 'superseded'].forEach((state) =>
      expect(LOG_STATUS_TONES[state]).toEqual(expect.any(String)),
    );
  });
});

describe('describeSyncDetail', () => {
  it('lists what is waiting, what failed and the last success', () => {
    expect(
      describeSyncDetail(status({ pending: 1, dead: 2, lastSuccessAt: at })),
    ).toBe('1 event waiting, 2 events failed, last success 5 Jan 10:42');
    expect(describeSyncDetail(status())).toBe('Nothing waiting to sync.');
    expect(describeSyncDetail(null)).toBe(
      'Sync is not set up for this competition.',
    );
  });

  it('mentions the next attempt only while offline', () => {
    expect(
      describeSyncDetail(status({ state: 'offline', nextAttemptAt: at })),
    ).toBe('next attempt 10:42');
    expect(
      describeSyncDetail(status({ state: 'idle', nextAttemptAt: at })),
    ).toBe('Nothing waiting to sync.');
  });
});

describe('time formatting', () => {
  it('returns empty text for missing or unusable timestamps', () => {
    expect(formatClock(null)).toBe('');
    expect(formatClock('not a date')).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });
});

describe('summariseKey', () => {
  it('shortens uuids and labels the known fields', () => {
    expect(
      summariseKey(
        'result',
        JSON.stringify({
          race_id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
          run_number: 1,
          service_number: '30123456',
        }),
      ),
    ).toBe('race c3d4e5f6 · run 1 · 30123456');
    expect(
      summariseKey('team_members', {
        team_id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        race_id: null,
      }),
    ).toBe('team b2c3d4e5 · race meeting-wide');
    expect(summariseKey('seed_list_snapshot', '{"after_race_count":3}')).toBe(
      'after 3',
    );
  });

  it('names the meeting for an empty key and copes with bad JSON', () => {
    expect(summariseKey('meeting', '{}')).toBe('the meeting');
    expect(summariseKey('cpp', '{}')).toBe('cpp');
    expect(summariseKey('race', 'not json')).toBe('race');
  });
});

describe('payloads', () => {
  it('pretty-prints JSON and explains a delete', () => {
    expect(prettyPayload('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyPayload(null)).toBe('(no payload: a delete)');
    expect(parseJson('{bad')).toBeNull();
    expect(parseJson({ already: true })).toEqual({ already: true });
  });

  it('turns entity types into words', () => {
    expect(entityLabel('seed_list_snapshot')).toBe('seed list snapshot');
    expect(entityLabel(undefined)).toBe('');
  });
});
