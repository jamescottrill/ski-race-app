/**
 * Pure presentation helpers for the sync status and the outbox log: labels,
 * badge tones and key summaries. No React, so they are unit tested directly.
 */

// Badge variants for each worker state
export const SYNC_STATE_TONES = {
  idle: 'success',
  syncing: 'primary',
  offline: 'warning',
  error: 'danger',
  auth_error: 'danger',
  disabled: 'default',
};

// Badge variants for each outbox row status
export const LOG_STATUS_TONES = {
  pending: 'warning',
  synced: 'success',
  dead: 'danger',
  superseded: 'default',
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 'HH:MM' in local time, or '' for a missing timestamp. */
export function formatClock(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 'D Mon HH:MM' in local time for the log, or '' when missing. */
export function formatDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })} ${formatClock(iso)}`;
}

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * The short line shown for a competition's sync status, with the badge tone
 * to render it in. Failed events take precedence over "up to date" because
 * they need the organiser's attention.
 */
export function describeSyncStatus(status) {
  if (!status || status.state === 'disabled') {
    return { label: 'Not published', tone: 'default' };
  }
  const pending = status.pending || 0;
  const dead = status.dead || 0;
  switch (status.state) {
    case 'auth_error':
      return { label: 'API key rejected', tone: 'danger' };
    case 'error':
      return { label: 'Sync halted', tone: 'danger' };
    case 'syncing':
      return { label: `Syncing · ${pending} pending`, tone: 'primary' };
    case 'offline':
      return { label: `Offline · ${pending} queued`, tone: 'warning' };
    default:
      break;
  }
  if (dead > 0) {
    return { label: `${dead} failed`, tone: 'danger' };
  }
  if (pending > 0) {
    return { label: `${pending} pending`, tone: 'warning' };
  }
  const at = formatClock(status.lastSuccessAt);
  return { label: at ? `Up to date · ${at}` : 'Up to date', tone: 'success' };
}

/** Longer wording for the status card. */
export function describeSyncDetail(status) {
  if (!status) return 'Sync is not set up for this competition.';
  const parts = [];
  if (status.pending) parts.push(`${plural(status.pending, 'event')} waiting`);
  if (status.dead) parts.push(`${plural(status.dead, 'event')} failed`);
  if (status.lastSuccessAt) {
    parts.push(`last success ${formatDateTime(status.lastSuccessAt)}`);
  }
  if (status.nextAttemptAt && status.state === 'offline') {
    parts.push(`next attempt ${formatClock(status.nextAttemptAt)}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'Nothing waiting to sync.';
}

const KEY_LABELS = {
  race_id: 'race',
  run_number: 'run',
  team_id: 'team',
  after_race_count: 'after',
  snapshot_id: 'snapshot',
  source_service_number: 'from',
  target_service_number: 'to',
};

const shortId = (value) =>
  typeof value === 'string' && UUID_PATTERN.test(value)
    ? value.slice(0, 8)
    : String(value);

/** Parse a JSON column that may already be an object; null when unusable. */
export function parseJson(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

/**
 * A one-line summary of an event key, e.g. 'race c3d4e5f6 · run 1 · 30123456'.
 * Uuids are shortened; an empty key means the meeting itself.
 */
export function summariseKey(entityType, key) {
  const parsed = parseJson(key) || {};
  const parts = Object.entries(parsed).map(([field, value]) => {
    const label = KEY_LABELS[field];
    const shown = value === null ? 'meeting-wide' : shortId(value);
    return label ? `${label} ${shown}` : shown;
  });
  if (parts.length === 0) {
    return entityType === 'meeting' ? 'the meeting' : entityType;
  }
  return parts.join(' · ');
}

/** Pretty JSON for the payload modal; a delete carries none. */
export function prettyPayload(payload) {
  const parsed = parseJson(payload);
  if (parsed === null) return '(no payload: a delete)';
  return JSON.stringify(parsed, null, 2);
}

/** Human labels for the entity types in the contract. */
export function entityLabel(entityType) {
  return String(entityType || '').replace(/_/g, ' ');
}
