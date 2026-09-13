/**
 * Sync contract v1. See README.md for the shape of the exchange.
 */
const { z } = require('zod');

const SYNC_SCHEMA_VERSION = 1;
const MAX_EVENTS_PER_BATCH = 500;

const ENTITY_TYPES = [
  'meeting',
  'competitor',
  'competitor_merge',
  'meeting_entry',
  'team',
  'team_members',
  'race',
  'race_run',
  'start_list',
  'result',
  'race_scores',
  'seed_list_snapshot',
  'standings_snapshot',
  'cpp',
  'final_seed_list',
  'snapshot_marker',
];

const OPERATIONS = ['upsert', 'delete'];
const RACE_TYPES = ['SL', 'GS', 'SG', 'DH', 'AC'];
const RACE_STATUSES = [
  'scheduled',
  'live',
  'provisional',
  'official',
  'cancelled',
];
const STANDINGS_KINDS = ['individual', 'team', 'princess_marina'];

const text = z.string().nullable();
const num = z.number().nullable();
const int = z.number().int().nullable();
const isoDate = z.iso.date().nullable();
const isoDateTime = z.iso.datetime({ offset: true }).nullable();
const serviceNumber = z.string().min(1);

const entryRow = z.object({
  service_number: serviceNumber,
  bib_number: z.number().int().positive(),
  seed_points: num,
});

// Key and data schema per entity type. Keys are strict: an unexpected key
// field usually means a stale client.
const entitySchemas = {
  meeting: {
    key: z.object({}).strict(),
    data: z.object({
      name: z.string().min(1),
      description: text,
      venue: text,
      starts_on: isoDate,
      ends_on: isoDate,
    }),
  },
  competitor: {
    key: z.object({ service_number: serviceNumber }).strict(),
    data: z.object({
      first_name: text,
      last_name: text,
      title: text,
      birth_year: int,
      gender: z.enum(['M', 'F']).nullable(),
      country: text,
    }),
  },
  competitor_merge: {
    key: z
      .object({
        source_service_number: serviceNumber,
        target_service_number: serviceNumber,
      })
      .strict(),
    data: z.object({}).strict(),
  },
  meeting_entry: {
    key: z.object({ service_number: serviceNumber }).strict(),
    data: z.object({
      title: text,
      regiment: text,
      arrival_army_seed: num,
      arrival_corps_seed: num,
      is_novice: z.boolean(),
      is_junior: z.boolean(),
      is_senior: z.boolean(),
      is_veteran: z.boolean(),
      is_reserve: z.boolean(),
      is_female: z.boolean(),
      is_hc: z.boolean(),
      training_group: int,
      do_not_publish: z.boolean(),
      army_opt_out: z.boolean(),
    }),
  },
  team: {
    key: z.object({ team_id: z.string().min(1) }).strict(),
    data: z.object({
      name: z.string().min(1),
      team_type: text,
      is_corps: z.boolean(),
      is_reserve: z.boolean(),
      is_female: z.boolean(),
      is_hc: z.boolean(),
    }),
  },
  team_members: {
    // race_id null means "nominated for the whole meeting"
    key: z.object({ team_id: z.string().min(1), race_id: text }).strict(),
    data: z.object({ service_numbers: z.array(serviceNumber) }),
  },
  race: {
    key: z.object({ race_id: z.string().min(1) }).strict(),
    data: z.object({
      name: z.string().min(1),
      race_date: isoDate,
      race_type: z.enum(RACE_TYPES).nullable(),
      is_individual: z.boolean(),
      is_team: z.boolean(),
      is_training: z.boolean(),
      is_seeding: z.boolean(),
      women_separate: z.boolean(),
      number_runs: z.number().int().min(1).max(2),
      venue: text,
      course_name: text,
      weather: text,
      snow: text,
      temp_start: num,
      temp_finish: num,
      start_altitude: num,
      finish_altitude: num,
      homologation: text,
      flip_count: int,
      flip_count_women: int,
      // Display strings, never service numbers
      officials: z.object({
        tech_delegate: text,
        referee: text,
        asst_referee: text,
        chief_of_race: text,
      }),
      status: z.enum(RACE_STATUSES),
      official_at: isoDateTime,
      dsq_notice_posted_at: isoDateTime,
    }),
  },
  race_run: {
    key: z
      .object({ race_id: z.string().min(1), run_number: z.number().int() })
      .strict(),
    data: z.object({
      course_setter: text,
      number_gates: int,
      turning_gates: int,
      start_time: text,
      forerunners: z.array(text).length(4),
      is_complete: z.boolean(),
    }),
  },
  start_list: {
    key: z.object({ race_id: z.string().min(1) }).strict(),
    data: z.object({ entries: z.array(entryRow) }),
  },
  result: {
    key: z
      .object({
        race_id: z.string().min(1),
        run_number: z.number().int(),
        service_number: serviceNumber,
      })
      .strict(),
    data: z.object({
      race_time: num,
      is_dns: z.boolean(),
      is_dnf: z.boolean(),
      is_dsq: z.boolean(),
      is_ns: z.boolean(),
      dsq_gate: int,
      dsq_reason: text,
    }),
  },
  race_scores: {
    key: z.object({ race_id: z.string().min(1) }).strict(),
    data: z.object({
      computed_at: z.iso.datetime({ offset: true }),
      rows: z.array(
        z.object({
          service_number: serviceNumber,
          position: int,
          race_points: num,
          run_1_time: num,
          run_2_time: num,
          total_time: num,
          points_run_1: num,
          points_run_2: num,
        }),
      ),
    }),
  },
  seed_list_snapshot: {
    key: z.object({ after_race_count: z.number().int().min(0) }).strict(),
    data: z.object({
      label: text,
      race_ids: z.array(z.string()),
      computed_at: z.iso.datetime({ offset: true }),
      rows: z.array(
        z.object({
          service_number: serviceNumber,
          position: z.number().int(),
          seed_points: num,
          initial_points: num,
          aasl_points: num,
          race_points: z.record(z.string(), num),
          penalty_race_ids: z.array(z.string()),
        }),
      ),
    }),
  },
  standings_snapshot: {
    key: z.object({ kind: z.enum(STANDINGS_KINDS) }).strict(),
    data: z.object({
      race_ids: z.array(z.string()),
      computed_at: z.iso.datetime({ offset: true }),
      rows: z.array(
        z
          .object({
            service_number: serviceNumber.optional(),
            team_id: z.string().optional(),
            position: z.number().int(),
            total_points: z.number(),
            race_points: z.record(z.string(), num),
          })
          .refine(
            (row) =>
              (row.service_number === undefined) !==
              (row.team_id === undefined),
            'a standings row names either a competitor or a team',
          ),
      ),
    }),
  },
  cpp: {
    key: z.object({}).strict(),
    data: z.object({
      cpp_value: z.number(),
      t1: num,
      t2: num,
      t3: num,
      divisor: int,
      skiers_used: int,
      calculated_at: z.iso.datetime({ offset: true }),
    }),
  },
  final_seed_list: {
    key: z.object({}).strict(),
    data: z.object({
      finalised_at: z.iso.datetime({ offset: true }),
      cpp_value: num,
      rows: z.array(
        z.object({
          service_number: serviceNumber,
          position: int,
          raw_seed_points: num,
          cpp_applied: num,
          final_seed_points: z.number(),
          aasl_points: num,
        }),
      ),
    }),
  },
  snapshot_marker: {
    key: z.object({ snapshot_id: z.string().min(1) }).strict(),
    data: z.object({ counts: z.record(z.string(), z.number().int()) }),
  },
};

const eventSchema = z.object({
  event_id: z.number().int().positive(),
  entity_type: z.enum(ENTITY_TYPES),
  operation: z.enum(OPERATIONS),
  key: z.record(z.string(), z.unknown()),
  data: z.record(z.string(), z.unknown()).nullable(),
  occurred_at: z.iso.datetime({ offset: true }),
});

const envelopeSchema = z.object({
  installation_id: z.uuid(),
  meeting_id: z.uuid(),
  schema_version: z.literal(SYNC_SCHEMA_VERSION),
  app_version: z.string().min(1),
  hostname: z.string().optional(),
  events: z.array(eventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});

function describeIssues(prefix, error) {
  const issues = error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return new Error(`${prefix}: ${issues}`);
}

/**
 * Validate one event: the envelope-level shape, then the key and (for an
 * upsert) the data against the schemas for its entity type. Returns the
 * parsed event; throws with every problem listed.
 */
function validateEvent(event) {
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) {
    throw describeIssues('invalid event', parsed.error);
  }
  const { entity_type: entityType, operation } = parsed.data;
  const schemas = entitySchemas[entityType];
  const key = schemas.key.safeParse(parsed.data.key);
  if (!key.success) {
    throw describeIssues(`invalid ${entityType} key`, key.error);
  }
  if (operation === 'delete') {
    if (parsed.data.data !== null) {
      throw new Error(`invalid ${entityType} delete: data must be null`);
    }
    return parsed.data;
  }
  const data = schemas.data.safeParse(parsed.data.data);
  if (!data.success) {
    throw describeIssues(`invalid ${entityType} data`, data.error);
  }
  return parsed.data;
}

/** Validate a whole batch, including every event and its ordering. */
function validateEnvelope(envelope) {
  const parsed = envelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    throw describeIssues('invalid envelope', parsed.error);
  }
  parsed.data.events.forEach((event, index) => {
    validateEvent(event);
    if (index > 0 && event.event_id <= parsed.data.events[index - 1].event_id) {
      throw new Error(
        `invalid envelope: event ids must increase (event ${event.event_id} follows ${parsed.data.events[index - 1].event_id})`,
      );
    }
  });
  return parsed.data;
}

module.exports = {
  SYNC_SCHEMA_VERSION,
  MAX_EVENTS_PER_BATCH,
  ENTITY_TYPES,
  OPERATIONS,
  RACE_TYPES,
  RACE_STATUSES,
  STANDINGS_KINDS,
  entitySchemas,
  eventSchema,
  envelopeSchema,
  validateEvent,
  validateEnvelope,
};
