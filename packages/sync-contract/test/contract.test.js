import { readFileSync } from 'node:fs';
import {
  SYNC_SCHEMA_VERSION,
  ENTITY_TYPES,
  entitySchemas,
  validateEvent,
  validateEnvelope,
} from '../src/index.js';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/batch.v1.json', import.meta.url), 'utf8'),
);

const event = (overrides) => ({
  event_id: 1,
  entity_type: 'result',
  operation: 'upsert',
  key: { race_id: 'r1', run_number: 1, service_number: '30123456' },
  data: {
    race_time: 61.2,
    is_dns: false,
    is_dnf: false,
    is_dsq: false,
    is_ns: false,
    dsq_gate: null,
    dsq_reason: null,
  },
  occurred_at: '2026-01-05T10:14:03.120Z',
  ...overrides,
});

describe('the reference batch', () => {
  it('validates and declares the current schema version', () => {
    const parsed = validateEnvelope(fixture);
    expect(parsed.schema_version).toBe(SYNC_SCHEMA_VERSION);
    expect(parsed.events).toHaveLength(fixture.events.length);
  });

  it('has a schema for every entity type', () => {
    ENTITY_TYPES.forEach((type) => {
      expect(entitySchemas[type]).toBeDefined();
    });
  });
});

describe('validateEvent', () => {
  it('rejects an unknown entity type, a stray key field and a wrong data field', () => {
    expect(() => validateEvent(event({ entity_type: 'racer' }))).toThrow(
      /invalid event: entity_type/,
    );
    expect(() =>
      validateEvent(
        event({
          key: { race_id: 'r1', run_number: 1, service_number: 'x', extra: 1 },
        }),
      ),
    ).toThrow(/invalid result key/);
    expect(() =>
      validateEvent(event({ data: { ...event().data, is_dns: 0 } })),
    ).toThrow(/invalid result data: is_dns/);
  });

  it('requires a delete to carry no data', () => {
    expect(() => validateEvent(event({ operation: 'delete' }))).toThrow(
      /delete: data must be null/,
    );
    expect(
      validateEvent(event({ operation: 'delete', data: null })),
    ).toMatchObject({ operation: 'delete' });
  });

  it('keeps service numbers out of race officials by shape', () => {
    // officials are free text; the contract cannot detect a service number,
    // but it does insist on the display-string object rather than ids
    const race = fixture.events.find((e) => e.entity_type === 'race');
    expect(() =>
      validateEvent({
        ...race,
        data: { ...race.data, officials: '30123456' },
      }),
    ).toThrow(/invalid race data: officials/);
  });
});

describe('validateEnvelope', () => {
  it('rejects a batch whose event ids do not increase', () => {
    const [first, second] = fixture.events;
    expect(() =>
      validateEnvelope({
        ...fixture,
        events: [
          { ...second, event_id: 5 },
          { ...first, event_id: 5 },
        ],
      }),
    ).toThrow(/event ids must increase/);
  });

  it('rejects an unsupported schema version', () => {
    expect(() => validateEnvelope({ ...fixture, schema_version: 2 })).toThrow(
      /invalid envelope: schema_version/,
    );
  });
});
