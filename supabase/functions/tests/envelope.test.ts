import { assertEquals } from 'jsr:@std/assert@1';
import { validateEnvelope } from '../_shared/envelope.ts';

const MEETING = '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4';
const INSTALLATION = '5f0c3e2a-7c1e-4a6b-9d3f-2b1c8e7a6d54';

const event = (overrides: Record<string, unknown> = {}) => ({
  event_id: 1,
  entity_type: 'result',
  operation: 'upsert',
  key: { race_id: 'r', run_number: 1, service_number: '30123456' },
  data: { race_time: 61.2 },
  occurred_at: '2026-01-05T10:14:03.120Z',
  ...overrides,
});

const envelope = (overrides: Record<string, unknown> = {}) => ({
  installation_id: INSTALLATION,
  meeting_id: MEETING,
  schema_version: 1,
  app_version: '0.3.0',
  events: [event()],
  ...overrides,
});

Deno.test('a well-formed envelope passes', () => {
  assertEquals(validateEnvelope(envelope(), MEETING), null);
});

Deno.test('a key bound to another meeting is a 403', () => {
  const problem = validateEnvelope(
    envelope(),
    '11111111-1111-4111-8111-111111111111',
  );
  assertEquals(problem?.status, 403);
  assertEquals(problem?.code, 'meeting_mismatch');
});

Deno.test(
  'an unsupported schema version is a 409 listing what is supported',
  () => {
    const problem = validateEnvelope(envelope({ schema_version: 2 }), MEETING);
    assertEquals(problem?.status, 409);
    assertEquals(problem?.extra, { supported: [1] });
  },
);

Deno.test('too many events is a 413', () => {
  const events = Array.from({ length: 501 }, (_, i) =>
    event({ event_id: i + 1 }),
  );
  assertEquals(validateEnvelope(envelope({ events }), MEETING)?.status, 413);
});

Deno.test('event ids must increase, and a delete carries no data', () => {
  const unordered = envelope({
    events: [event({ event_id: 5 }), event({ event_id: 5 })],
  });
  assertEquals(validateEnvelope(unordered, MEETING)?.code, 'bad_envelope');
  const badDelete = envelope({ events: [event({ operation: 'delete' })] });
  assertEquals(validateEnvelope(badDelete, MEETING)?.code, 'bad_envelope');
  const goodDelete = envelope({
    events: [event({ operation: 'delete', data: null })],
  });
  assertEquals(validateEnvelope(goodDelete, MEETING), null);
});

Deno.test('a malformed installation id or empty batch is a 400', () => {
  assertEquals(
    validateEnvelope(envelope({ installation_id: 'laptop' }), MEETING)?.status,
    400,
  );
  assertEquals(
    validateEnvelope(envelope({ events: [] }), MEETING)?.status,
    400,
  );
});
