/**
 * Pure helpers that turn race result query rows into what the results tables
 * and PDF generators consume. No React and no database access, so the
 * scoring and grouping rules can be unit tested directly.
 */
import { convertRaceTime } from './time.js';
import { round } from './math.js';

export const TEAM_SCORING_SIZE = 3;
export const PODIUM_SIZE = 3;

const hasTime = (seconds) => seconds !== null && seconds !== undefined;

/**
 * 'DNS', 'DNF' or 'DSQ' for a run the competitor did not complete, else null.
 * NS (a no-start with a valid reason, which waives the seeding penalty) is
 * still a no-start, so it is reported as DNS.
 */
export function runStatus(row, run) {
  if (row[`run${run}Dns`] || row[`run${run}Ns`]) return 'DNS';
  if (row[`run${run}Dnf`]) return 'DNF';
  if (row[`run${run}Dsq`]) return 'DSQ';
  return null;
}

/** What a run's time cell shows: the status, the formatted time, or nothing. */
export function runDisplay(row, run) {
  return runStatus(row, run) || row[`run${run}Time`] || '';
}

/**
 * Map one query row (snake_case, 0/1 flags) to the camelCase row the tables
 * and PDF generators read. `runStatus` and `runCompleted` are keyed by run
 * number; `completed` is true when no run carries a non-finish status.
 */
export function mapIndividualResult(result, runs = 1) {
  const row = {
    id: `${result.racer_id}/results`,
    racerId: result.racer_id,
    raceId: result.race_id,
    firstName: result.first_name,
    lastName: result.last_name,
    title: result.title,
    team: result.team,
    teamName: result.team_name,
    bibNumber: result.bib_number,
    position: result.position,
    seedPoints: result.seed_points,
    gender: result.gender,
    is_novice: result.is_novice,
    is_junior: result.is_junior,
    is_senior: result.is_senior,
    is_veteran: result.is_veteran,
    is_reserve: result.is_reserve,
    runStatus: {},
    runCompleted: {},
  };

  for (let run = 1; run <= runs; run += 1) {
    const seconds = result[`run_${run}_time`];
    Object.assign(row, {
      [`run${run}TimeSecs`]: hasTime(seconds) ? seconds : null,
      [`run${run}Time`]: hasTime(seconds) ? convertRaceTime(seconds) : '',
      [`run${run}Dns`]: Boolean(result[`run_${run}_dns`]),
      [`run${run}Dnf`]: Boolean(result[`run_${run}_dnf`]),
      [`run${run}Dsq`]: Boolean(result[`run_${run}_dsq`]),
      [`run${run}Ns`]: Boolean(result[`run_${run}_ns`]),
      [`run${run}DsqGate`]: result[`run_${run}_dsq_gate`],
      [`run${run}DsqReason`]: result[`run_${run}_dsq_reason`],
    });
    row.runStatus[run] = runStatus(row, run);
    row.runCompleted[run] = row.runStatus[run] === null && hasTime(seconds);
  }

  if (runs === 2) {
    // A total only means something once both runs are in
    const both = row.runCompleted[1] && row.runCompleted[2];
    row.totalTimeSecs = both
      ? round(row.run1TimeSecs + row.run2TimeSecs)
      : null;
    row.totalTime = both ? convertRaceTime(row.totalTimeSecs) : '';
  }

  row.completed = Object.values(row.runStatus).every(
    (status) => status === null,
  );
  return row;
}

/** Seeding race rows carry per-run points and show the status in the time cell. */
export function mapSeedResult(result) {
  const row = mapIndividualResult(result, 2);
  return {
    ...row,
    points1: result.seed_1,
    points2: result.seed_2,
    finalSeed: result.overall_seed,
    run1Time: runDisplay(row, 1),
    run2Time: runDisplay(row, 2),
  };
}

export const finishedAllRuns = (row) =>
  Object.values(row.runCompleted).every(Boolean);
export const finishedAnyRun = (row) =>
  Object.values(row.runCompleted).some(Boolean);
export const noNonFinishStatus = (row) => row.completed;

const byBib = (a, b) => a.bibNumber - b.bibNumber;
const byPosition = (a, b) => a.position - b.position;

/**
 * Split mapped rows into the finished list (by position) and, per run, the
 * DNS, DNF and DSQ lists (by bib number).
 */
export function partitionResults(
  rows,
  { runs = 1, isFinished = noNonFinishStatus } = {},
) {
  const partition = {
    finished: rows.filter(isFinished).sort(byPosition),
    runs: {},
  };
  for (let run = 1; run <= runs; run += 1) {
    const withStatus = (status) =>
      rows.filter((row) => row.runStatus[run] === status).sort(byBib);
    partition.runs[run] = {
      dns: withStatus('DNS'),
      dnf: withStatus('DNF'),
      dsq: withStatus('DSQ'),
    };
  }
  return partition;
}

export const PODIUM_CATEGORIES = [
  {
    key: 'junior',
    title: 'Junior Results',
    includes: (row) => Boolean(row.is_junior),
  },
  {
    key: 'novice',
    title: 'Novice Results',
    includes: (row) => Boolean(row.is_novice),
  },
  {
    key: 'veteran',
    title: 'Veteran Results',
    includes: (row) => Boolean(row.is_veteran),
  },
  {
    key: 'female',
    title: 'Female Results',
    includes: (row) => row.gender === 'F',
  },
  { key: 'open', title: 'Open Results', includes: () => true },
];

/** Top finishers per category, in finishing order. */
export function categoryPodiums(finished, size = PODIUM_SIZE) {
  return PODIUM_CATEGORIES.map(({ key, title, includes }) => ({
    key,
    title,
    rows: finished.filter(includes).slice(0, size),
  }));
}

/**
 * Score teams from individual rows: each team's best three finishers by race
 * points, summed. Teams with fewer than three finishers are listed as
 * incomplete rather than scored.
 * @param {string} timeField - Row field holding the seconds to sum
 *   ('run1TimeSecs' or 'totalTimeSecs')
 */
export function buildTeamResults(rows, { timeField }) {
  const teamNames = [
    ...new Set(rows.map((row) => row.teamName).filter(Boolean)),
  ];
  const scoring = rows.filter((row) => row.teamName && finishedAllRuns(row));
  const teams = [];
  const incomplete = [];

  teamNames.forEach((teamName) => {
    const racers = scoring
      .filter((row) => row.teamName === teamName)
      .sort((a, b) => a.seedPoints - b.seedPoints)
      .slice(0, TEAM_SCORING_SIZE);
    if (racers.length < TEAM_SCORING_SIZE) {
      incomplete.push({ teamName });
      return;
    }
    const timeSecs = round(
      racers.reduce((total, racer) => total + racer[timeField], 0),
    );
    teams.push({
      teamName,
      racers,
      points: round(
        racers.reduce((total, racer) => total + racer.seedPoints, 0),
      ),
      timeSecs,
      time: convertRaceTime(timeSecs),
    });
  });

  teams
    .sort((a, b) => a.points - b.points)
    .forEach((team, index) => {
      team.position = index + 1;
    });
  return { teams, incomplete };
}
