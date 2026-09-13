/**
 * Sync outbox.
 *
 * Every named operation that changes something the central results service
 * mirrors appends an event here, inside the same transaction as the write.
 * An upsert carries the entity as it stands after the write, read back from
 * the table by the loader for its type, so the outbox can never disagree
 * with the data and replaying any event converges. A delete carries the key
 * only. The sync worker drains the table in id order; the id is the event id
 * the server deduplicates on.
 *
 * Keys use the server's vocabulary (service_number rather than racer_id) and
 * never include the competition: the batch names the meeting once.
 */
const { SYNC_SCHEMA_VERSION } = require('@awsa/sync-contract');

const flag = (value) => Boolean(value);
const orNull = (value) => (value === undefined ? null : value);
const upper = (value) => (value ? String(value).toUpperCase() : null);
const initial = (value) => (value ? String(value).slice(0, 1) : null);

// People are stored by service number; the service sees display strings only,
// in the same formats the printed sheets use (see renderer/utils/RaceDetails).
// The official columns on races and race_run are declared STRING, which gives
// them numeric affinity, so a numeric service number comes back as an integer
// and must be matched by number as well as by text (as the app's joins do).
function person(tx, id) {
  if (id === null || id === undefined || id === '') return null;
  return (
    tx.get(
      `SELECT title, first_name, last_name, country FROM people
       WHERE id = ? OR (typeof(?) IN ('integer', 'real') AND CAST(id AS INTEGER) = ?)`,
      [String(id), id, id],
    ) || null
  );
}
const joinParts = (parts) => {
  const joined = parts.filter(Boolean).join(' ').trim();
  return joined || null;
};
function officialName(tx, id) {
  const p = person(tx, id);
  return p
    ? joinParts([
        p.title,
        upper(p.last_name),
        initial(p.first_name),
        upper(p.country),
      ])
    : null;
}
function courseSetterName(tx, id) {
  const p = person(tx, id);
  return p
    ? joinParts([p.title, upper(p.last_name), p.first_name, upper(p.country)])
    : null;
}
function forerunnerName(tx, id) {
  const p = person(tx, id);
  return p ? joinParts([upper(p.last_name), upper(p.country)]) : null;
}

const raceStatus = (value) => value || 'scheduled';

/**
 * One loader per entity type: (tx, competitionId, key) => data, or null when
 * the row no longer exists. Also used to build a full snapshot.
 */
const ENTITY_LOADERS = {
  meeting(tx, competitionId) {
    const row = tx.get(
      `SELECT competition_name, competition_description, venue, start_date, end_date
       FROM competitions WHERE id = ?`,
      [competitionId],
    );
    if (!row) return null;
    return {
      name: row.competition_name,
      description: orNull(row.competition_description),
      venue: orNull(row.venue),
      starts_on: orNull(row.start_date),
      ends_on: orNull(row.end_date),
    };
  },

  competitor(tx, competitionId, { service_number: id }) {
    const row = tx.get(
      `SELECT first_name, last_name, title, birth_year, country, gender FROM people WHERE id = ?`,
      [id],
    );
    if (!row) return null;
    return {
      first_name: orNull(row.first_name),
      last_name: orNull(row.last_name),
      title: orNull(row.title),
      birth_year: orNull(row.birth_year),
      gender: row.gender === 'M' || row.gender === 'F' ? row.gender : null,
      country: orNull(row.country),
    };
  },

  meeting_entry(tx, competitionId, { service_number: id }) {
    const row = tx.get(
      `SELECT * FROM competition_competitor WHERE competition_id = ? AND racer_id = ?`,
      [competitionId, id],
    );
    if (!row) return null;
    return {
      title: orNull(row.title),
      regiment: orNull(row.regiment),
      arrival_army_seed: orNull(row.arrival_army_seed),
      arrival_corps_seed: orNull(row.arrival_corps_seed),
      is_novice: flag(row.is_novice),
      is_junior: flag(row.is_junior),
      is_senior: flag(row.is_senior),
      is_veteran: flag(row.is_veteran),
      is_reserve: flag(row.is_reserve),
      is_female: flag(row.is_female),
      is_hc: flag(row.is_hc),
      training_group: orNull(row.training_group),
      do_not_publish: flag(row.do_not_publish),
      army_opt_out: flag(row.army_qual_opt_out),
    };
  },

  team(tx, competitionId, { team_id: teamId }) {
    const row = tx.get(
      `SELECT * FROM competition_team WHERE competition_id = ? AND team_id = ?`,
      [competitionId, teamId],
    );
    if (!row) return null;
    return {
      name: row.team_name,
      team_type: orNull(row.team_type),
      is_corps: flag(row.is_corps),
      is_reserve: flag(row.is_reserve),
      is_female: flag(row.is_female),
      is_hc: flag(row.is_hc),
    };
  },

  // The collection for one team and race (race_id null: nominated for the
  // meeting); an empty collection is a valid state, not a missing row
  team_members(tx, competitionId, { team_id: teamId, race_id: raceId }) {
    const rows = tx.all(
      `SELECT racer_id FROM competition_team_members
       WHERE competition_id = ? AND team_id = ? AND race_id IS ?
       ORDER BY racer_id`,
      [competitionId, teamId, raceId ?? null],
    );
    return { service_numbers: rows.map((row) => row.racer_id) };
  },

  race(tx, competitionId, { race_id: raceId }) {
    const row = tx.get(
      `SELECT * FROM races WHERE competition_id = ? AND race_id = ?`,
      [competitionId, raceId],
    );
    if (!row) return null;
    return {
      name: row.race_name,
      race_date: orNull(row.race_date),
      race_type: orNull(row.race_type),
      is_individual: flag(row.is_individual),
      is_team: flag(row.is_team),
      is_training: flag(row.is_training),
      is_seeding: flag(row.is_seeding),
      women_separate: flag(row.women_separate),
      number_runs: row.number_runs || 1,
      venue: orNull(row.venue),
      course_name: orNull(row.course_name),
      weather: orNull(row.weather),
      snow: orNull(row.snow),
      temp_start: orNull(row.temp_start),
      temp_finish: orNull(row.temp_finish),
      start_altitude: orNull(row.start_altitude),
      finish_altitude: orNull(row.finish_altitude),
      homologation: orNull(row.homologation),
      flip_count: orNull(row.flip_count),
      flip_count_women: orNull(row.flip_count_women),
      officials: {
        tech_delegate: officialName(tx, row.tech_delegate),
        referee: officialName(tx, row.referee),
        asst_referee: officialName(tx, row.asst_referee),
        chief_of_race: officialName(tx, row.chief_of_race),
      },
      status: raceStatus(row.status),
      official_at: orNull(row.official_at),
      dsq_notice_posted_at: orNull(row.dsq_notice_posted_at),
    };
  },

  race_run(tx, competitionId, { race_id: raceId, run_number: runNumber }) {
    const row = tx.get(
      `SELECT * FROM race_run WHERE competition_id = ? AND race_id = ? AND run_number = ?`,
      [competitionId, raceId, runNumber],
    );
    if (!row) return null;
    return {
      course_setter: courseSetterName(tx, row.course_setter),
      number_gates: orNull(row.number_gates),
      turning_gates: orNull(row.turning_gates),
      start_time: orNull(row.start_time),
      forerunners: [
        row.forerunner_a,
        row.forerunner_b,
        row.forerunner_c,
        row.forerunner_d,
      ].map((id) => forerunnerName(tx, id)),
      is_complete: flag(row.is_complete),
    };
  },

  start_list(tx, competitionId, { race_id: raceId }) {
    const rows = tx.all(
      `SELECT racer_id, bib_number, seed_points FROM race_competitor
       WHERE competition_id = ? AND race_id = ? ORDER BY bib_number, racer_id`,
      [competitionId, raceId],
    );
    return {
      entries: rows.map((row) => ({
        service_number: row.racer_id,
        bib_number: row.bib_number,
        seed_points: orNull(row.seed_points),
      })),
    };
  },

  result(
    tx,
    competitionId,
    { race_id: raceId, run_number: runNumber, service_number: id },
  ) {
    const row = tx.get(
      `SELECT * FROM race_results
       WHERE competition_id = ? AND race_id = ? AND run_number = ? AND racer_id = ?`,
      [competitionId, raceId, runNumber, id],
    );
    if (!row) return null;
    return {
      race_time: orNull(row.race_time),
      is_dns: flag(row.is_dns),
      is_dnf: flag(row.is_dnf),
      is_dsq: flag(row.is_dsq),
      is_ns: flag(row.is_ns),
      dsq_gate: orNull(row.dsq_gate),
      dsq_reason: orNull(row.dsq_reason),
    };
  },
};

/** Append one event. Payload null means a delete. */
function emit(
  tx,
  {
    competitionId,
    entityType,
    key,
    op,
    payload = null,
    operation,
    snapshotId = null,
  },
) {
  if (!competitionId)
    throw new Error(`${operation}: event needs a competitionId`);
  tx.run(
    `INSERT INTO sync_events (competition_id, entity_type, entity_key, op, payload,
       source_operation, schema_version, snapshot_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      competitionId,
      entityType,
      JSON.stringify(key),
      op,
      payload === null ? null : JSON.stringify(payload),
      operation,
      SYNC_SCHEMA_VERSION,
      snapshotId,
      new Date().toISOString(),
    ],
  );
}

/** Read the entity back and append it as an upsert. */
function emitEntity(
  tx,
  { competitionId, entityType, key, operation, snapshotId },
) {
  const load = ENTITY_LOADERS[entityType];
  if (!load) throw new Error(`${operation}: no loader for ${entityType}`);
  const payload = load(tx, competitionId, key);
  if (payload === null) {
    throw new Error(
      `${operation}: cannot publish ${entityType} ${JSON.stringify(key)}: not found`,
    );
  }
  emit(tx, {
    competitionId,
    entityType,
    key,
    op: 'upsert',
    payload,
    operation,
    snapshotId,
  });
}

function emitDelete(tx, { competitionId, entityType, key, operation }) {
  emit(tx, { competitionId, entityType, key, op: 'delete', operation });
}

module.exports = { ENTITY_LOADERS, emit, emitEntity, emitDelete };
