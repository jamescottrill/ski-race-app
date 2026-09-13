/**
 * Start order for a race from the current seed list.
 *
 * Seeded competitors run in seed order with the top `randomiseTop` shuffled
 * (the "flip"). In the seeding race, competitors with no points anywhere
 * (no arrival corps or army seed and no AASL entry) start after every
 * seeded competitor, banded by training group (1 first, no group last) and
 * shuffled within each band. Training groups play no part in championship
 * races: by then everyone has seeding race points.
 */

// Fisher–Yates; nothing here needs to be unpredictable
export function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const missing = (value) => value === null || value === undefined;

export const hasNoSeedPoints = (row) =>
  missing(row.arrival_corps_seed) &&
  missing(row.arrival_army_seed) &&
  missing(row.aasl_points);

/** Seed order with the top `randomiseTop` shuffled; everyone shuffled when there are fewer. */
export function flipTop(rows, randomiseTop, shuffleFn = shuffle) {
  if (rows.length > randomiseTop) {
    return [
      ...shuffleFn(rows.slice(0, randomiseTop)),
      ...rows.slice(randomiseTop),
    ];
  }
  return shuffleFn(rows);
}

/** Bands by training group ascending (no group last), shuffled within each band. */
export function orderByTrainingGroup(rows, shuffleFn = shuffle) {
  const bands = new Map();
  rows.forEach((row) => {
    const group = Number.isInteger(row.training_group)
      ? row.training_group
      : null;
    if (!bands.has(group)) bands.set(group, []);
    bands.get(group).push(row);
  });
  return [...bands.keys()]
    .sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    })
    .flatMap((group) => shuffleFn(bands.get(group)));
}

/**
 * Build the start order for a race.
 * @param {Array} seedList - Rows from fetchSeedList (already in seed order), struck-out competitors removed
 * @param {Object} raceDetails - women_separate, randomise_top, randomise_top_women, is_seeding
 */
export function buildStartOrder(seedList, raceDetails, shuffleFn = shuffle) {
  const blocks = raceDetails.women_separate
    ? [
        ['F', raceDetails.randomise_top_women],
        ['M', raceDetails.randomise_top],
      ]
    : [[null, raceDetails.randomise_top]];

  return blocks.flatMap(([gender, randomiseTop]) => {
    const rows = gender
      ? seedList.filter((row) => row.gender === gender)
      : seedList;
    if (!raceDetails.is_seeding) return flipTop(rows, randomiseTop, shuffleFn);
    const seeded = rows.filter((row) => !hasNoSeedPoints(row));
    const unseeded = rows.filter(hasNoSeedPoints);
    return [
      ...flipTop(seeded, randomiseTop, shuffleFn),
      ...orderByTrainingGroup(unseeded, shuffleFn),
    ];
  });
}
