/**
 * Seed list calculation.
 *
 * The list after a sequence of races is built incrementally: the list after
 * each race is derived from the list before it, which is also the "current
 * seed list" that the B13 exceptions use to award race points to
 * competitors who lack them. Everything here is plain data in, plain data
 * out; the SQL lives in ../queries.
 *
 * Rules implemented:
 * - Initial points are the competitor's AASL points (the base list under B3),
 *   else the entered arrival corps seed, else 2000. The seeding race scores
 *   the best of run 1, run 2 and the initial points.
 * - After c championship races the seed points are: c = 1 the better of
 *   initial points and the race; c = 2 the mean of the best two of initial
 *   points and both races; c = 3 the mean of the best two races (initial
 *   points dropped); c = 4 the best three; c >= 5 the best c - 2.
 * - B13.a(1): when the rule above cannot be applied, the competitor's
 *   position on the current seed list is matched to the finisher in that
 *   position and they receive those points plus 20% or 10, whichever is
 *   greater. Below the last finisher they receive the last finisher's points
 *   plus 20% or their own seed points, whichever is greater.
 * - B13.c: a non-starter (NS) receives the matched points without penalty,
 *   once per meeting. Below the last finisher: the last finisher's points or
 *   their own, whichever is greater (the rule is silent; no penalty added).
 * - B13.d: points awarded this way are carried forward for the meeting and
 *   flagged `<raceId>-penalty`. Pass `awardPenalties: false` for the uses
 *   B13.d excludes (combination results, final seed lists).
 */
import { seedPointsOneRun, seedPointsTwoRun } from '../queries/SeedPoints';
import { seedingPoints } from '../queries/SeedResults';
import {
  raceResultsOneRunQuery,
  raceResultsTwoRunQuery,
} from '../queries/RaceResults';
import { round } from './MathFx';

export const DEFAULT_SEED_POINTS = 2000;

const select = (query, params) => window.api.select(query, params);

const getPeople = async (competitionId) =>
  select(
    `SELECT cc.*, p.first_name, p.last_name, p.birth_year, p.gender, cc.regiment AS team_name,
            (SELECT a.seed_points FROM aasl a WHERE a.service_number = cc.racer_id
             ORDER BY a.season DESC LIMIT 1) AS aasl_points
     FROM competition_competitor cc
     LEFT JOIN people p ON cc.racer_id = p.id
     WHERE cc.competition_id = ?`,
    [competitionId],
  );

const getRaces = async (competitionId) => {
  const rows = await select(
    `SELECT race_id, is_seeding, number_runs, race_date FROM races WHERE competition_id = ?`,
    [competitionId],
  );
  return new Map(rows.map((race) => [race.race_id, race]));
};

// racer_id -> race points for one race (null when the competitor has no
// points there)
const getRacePoints = async (race) => {
  const query = race.is_seeding
    ? seedingPoints
    : race.number_runs === 1
      ? seedPointsOneRun
      : seedPointsTwoRun;
  const params =
    race.is_seeding || race.number_runs !== 1
      ? [race.race_id, race.race_id]
      : [race.race_id];
  const rows = await select(query, params);
  return new Map(rows.map((row) => [row.racer_id, row.seed_point ?? null]));
};

// Full results of one race, in finishing order, for the B13 awards
const getRaceResults = async (race) =>
  race.number_runs === 1
    ? select(raceResultsOneRunQuery, [race.race_id])
    : select(raceResultsTwoRunQuery, [race.race_id, race.race_id]);

// B3: the Army Alpine Seed List is the base list, so a competitor's AASL
// points come first; failing that the arrival seed the race secretary
// entered; failing that 2000
const initialPoints = (person) =>
  person.aasl_points ?? person.arrival_corps_seed ?? DEFAULT_SEED_POINTS;

/**
 * How many results the rule for c championship races needs, and whether the
 * initial points are part of the pool.
 */
export function combinationRule(championshipRaces) {
  if (championshipRaces <= 1) return { needed: 1, useInitial: true };
  if (championshipRaces === 2) return { needed: 2, useInitial: true };
  if (championshipRaces === 3) return { needed: 2, useInitial: false };
  if (championshipRaces === 4) return { needed: 3, useInitial: false };
  return { needed: championshipRaces - 2, useInitial: false };
}

/** Mean of the best `needed` values, or null when there are none. */
export function combinePoints(values, needed) {
  const available = values
    .filter((v) => v !== null && v !== undefined)
    .sort((a, b) => a - b);
  if (available.length === 0) return null;
  const best = available.slice(0, needed);
  return round(best.reduce((sum, v) => sum + v, 0) / best.length);
}

/** Sort by points (missing last), then name, and assign tied ranks. */
export function rankList(rows) {
  const sorted = [...rows].sort((a, b) => {
    const pa = a.seed_points ?? Infinity;
    const pb = b.seed_points ?? Infinity;
    if (pa !== pb) return pa - pb;
    return `${a.last_name ?? ''} ${a.first_name ?? ''}`.localeCompare(
      `${b.last_name ?? ''} ${b.first_name ?? ''}`,
    );
  });
  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || row.seed_points !== sorted[index - 1].seed_points)
      rank = index + 1;
    return { ...row, position: rank };
  });
}

const finished = (result) =>
  result.seed_points !== null &&
  result.seed_points !== undefined &&
  !result.is_dns &&
  !result.is_dnf &&
  !result.is_dsq &&
  !result.is_ns;

/**
 * B13 award for one competitor in one race. `listBefore` is the seed list as
 * it stood before the race; `results` the race's full results in finishing
 * order; `nsUsed` the set of competitors who have already used the
 * non-starter exception this meeting.
 */
export function awardRacePoints({ racerId, listBefore, results, nsUsed }) {
  const entry = listBefore.find((row) => row.racer_id === racerId);
  const position = entry ? entry.position : listBefore.length + 1;
  const ownPoints =
    entry && entry.seed_points !== null
      ? entry.seed_points
      : DEFAULT_SEED_POINTS;
  const finishers = results.filter(finished);
  const own = results.find((row) => row.racer_id === racerId);
  const nonStarter = Boolean(own && own.is_ns) && !nsUsed.has(racerId);

  let points;
  const matched = finishers[position - 1];
  if (matched) {
    points = nonStarter
      ? matched.seed_points
      : matched.seed_points + Math.max(matched.seed_points * 0.2, 10);
  } else if (finishers.length > 0) {
    const last = finishers[finishers.length - 1].seed_points;
    points = Math.max(nonStarter ? last : last * 1.2, ownPoints);
  } else {
    points = ownPoints;
  }
  if (nonStarter) nsUsed.add(racerId);
  return round(points);
}

/**
 * Build the seed list for a competition after the given races (in date
 * order). Returns one row per competitor with the person and entry fields,
 * a points column per requested race, `<raceId>-penalty` flags for awarded
 * points, `seed_points` and a tied `position`.
 */
export async function fetchSeedList(
  competitionId,
  raceIds,
  { awardPenalties = true } = {},
) {
  const people = await getPeople(competitionId);
  const rowsById = new Map(
    people.map((person) => [person.racer_id, { ...person }]),
  );

  const initialList = rankList(
    people.map((person) => ({ ...person, seed_points: initialPoints(person) })),
  );
  if (raceIds.length === 0) return initialList;

  const races = await getRaces(competitionId);
  raceIds.forEach((raceId) => {
    if (!races.has(raceId)) throw new Error(`Race not found: ${raceId}`);
  });

  // History always starts from the seeding race when the competition has
  // one, even if the caller has dropped it from the columns it wants
  const seedingRace = [...races.values()].find((race) => race.is_seeding);
  const requestedChampionship = raceIds
    .filter((id) => !races.get(id).is_seeding)
    .sort((a, b) =>
      String(races.get(a).race_date).localeCompare(
        String(races.get(b).race_date),
      ),
    );

  let current = initialList;
  if (seedingRace) {
    const points = await getRacePoints(seedingRace);
    people.forEach((person) => {
      const row = rowsById.get(person.racer_id);
      row[seedingRace.race_id] =
        points.get(person.racer_id) ?? initialPoints(person);
    });
    current = rankList(
      people.map((person) => ({
        ...rowsById.get(person.racer_id),
        seed_points: rowsById.get(person.racer_id)[seedingRace.race_id],
      })),
    );
  }
  const initialFor = (racerId) =>
    seedingRace
      ? rowsById.get(racerId)[seedingRace.race_id]
      : initialPoints(rowsById.get(racerId));

  const resultsCache = new Map();
  const nsUsed = new Set();
  const listsBefore = [];

  for (let c = 1; c <= requestedChampionship.length; c += 1) {
    const raceId = requestedChampionship[c - 1];
    const race = races.get(raceId);
    listsBefore[c - 1] = current;
    const points = await getRacePoints(race);
    people.forEach((person) => {
      rowsById.get(person.racer_id)[raceId] =
        points.get(person.racer_id) ?? null;
    });

    const { needed, useInitial } = combinationRule(c);
    const prefix = requestedChampionship.slice(0, c);
    for (const person of people) {
      const row = rowsById.get(person.racer_id);
      const pool = () => [
        ...(useInitial ? [initialFor(person.racer_id)] : []),
        ...prefix.map((id) => row[id]),
      ];
      if (awardPenalties) {
        // Fill the most recently missed race(s) until the rule can be applied
        for (let i = prefix.length - 1; i >= 0; i -= 1) {
          if (pool().filter((v) => v !== null).length >= needed) break;
          const missed = prefix[i];
          if (row[missed] === null) {
            if (!resultsCache.has(missed)) {
              resultsCache.set(missed, await getRaceResults(races.get(missed)));
            }
            row[missed] = awardRacePoints({
              racerId: person.racer_id,
              listBefore: listsBefore[i],
              results: resultsCache.get(missed),
              nsUsed,
            });
            row[`${missed}-penalty`] = true;
          }
        }
      }
      row.seed_points = combinePoints(pool(), needed);
    }
    current = rankList(
      people.map((person) => ({ ...rowsById.get(person.racer_id) })),
    );
  }

  // Only the requested races appear as columns
  const wanted = new Set(raceIds);
  return current.map((row) => {
    const out = { ...row };
    races.forEach((race) => {
      if (!wanted.has(race.race_id)) {
        delete out[race.race_id];
        delete out[`${race.race_id}-penalty`];
      }
    });
    return out;
  });
}
