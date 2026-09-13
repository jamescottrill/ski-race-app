// Envelope checks for the sync contract v1, kept pure so they unit test
// without a network. The per-entity data is validated by the database
// appliers; this only guards the batch shape the worker promises.
import { MAX_BATCH_EVENTS, SUPPORTED_SCHEMA_VERSIONS } from './http.ts';

export interface Problem {
  status: number;
  code: string;
  message: string;
  extra?: Record<string, unknown>;
}

export interface Envelope {
  installation_id: string;
  meeting_id: string;
  schema_version: number;
  app_version?: string;
  hostname?: string;
  events: SyncEvent[];
}

export interface SyncEvent {
  event_id: number;
  entity_type: string;
  operation: 'upsert' | 'delete';
  key: Record<string, unknown>;
  data: Record<string, unknown> | null;
  occurred_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bad = (message: string, extra?: Record<string, unknown>): Problem => ({
  status: 400,
  code: 'bad_envelope',
  message,
  extra,
});

export function validateEnvelope(
  body: unknown,
  meetingId: string,
): Problem | null {
  if (!isObject(body)) return bad('The body must be a JSON object');
  if (
    typeof body.installation_id !== 'string' ||
    !UUID.test(body.installation_id)
  ) {
    return bad('installation_id must be a UUID');
  }
  if (body.meeting_id !== meetingId) {
    return {
      status: 403,
      code: 'meeting_mismatch',
      message: 'This API key belongs to a different meeting',
    };
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(body.schema_version as number)) {
    return {
      status: 409,
      code: 'schema_version_unsupported',
      message:
        'This version of the sync contract is not supported; update the app',
      extra: { supported: SUPPORTED_SCHEMA_VERSIONS },
    };
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return bad('events must be a non-empty array');
  }
  if (body.events.length > MAX_BATCH_EVENTS) {
    return {
      status: 413,
      code: 'too_many_events',
      message: `A batch may hold at most ${MAX_BATCH_EVENTS} events`,
      extra: { max_batch_events: MAX_BATCH_EVENTS },
    };
  }
  let previous = 0;
  for (const [index, event] of body.events.entries()) {
    const problem = validateEvent(event, index, previous);
    if (problem) return problem;
    previous = (event as SyncEvent).event_id;
  }
  return null;
}

function validateEvent(
  event: unknown,
  index: number,
  previous: number,
): Problem | null {
  const where = `events[${index}]`;
  if (!isObject(event)) return bad(`${where} must be an object`);
  const id = event.event_id;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    return bad(`${where}.event_id must be a positive integer`);
  }
  if (id <= previous) {
    return bad(`${where}.event_id must be greater than the event before it`, {
      event_id: id,
    });
  }
  if (typeof event.entity_type !== 'string' || event.entity_type.length === 0) {
    return bad(`${where}.entity_type is required`);
  }
  if (event.operation !== 'upsert' && event.operation !== 'delete') {
    return bad(`${where}.operation must be upsert or delete`);
  }
  if (!isObject(event.key)) return bad(`${where}.key must be an object`);
  if (event.operation === 'upsert' && !isObject(event.data)) {
    return bad(`${where}.data must be an object for an upsert`);
  }
  if (
    event.operation === 'delete' &&
    event.data !== null &&
    event.data !== undefined
  ) {
    return bad(`${where}.data must be null for a delete`);
  }
  if (
    typeof event.occurred_at !== 'string' ||
    Number.isNaN(Date.parse(event.occurred_at))
  ) {
    return bad(`${where}.occurred_at must be an ISO 8601 timestamp`);
  }
  return null;
}
