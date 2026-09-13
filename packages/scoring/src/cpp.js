/**
 * Championship Penalty Points (CPP)
 *
 * Normalises a meeting's seed points against the Army Alpine Seed List (AASL)
 * so results from different meetings compare fairly.
 *
 *   T1  AASL points of the five skiers on the meeting seed list with the
 *       lowest AASL points, added together
 *   T2  AASL points of the five skiers with the lowest AASL points who
 *       finished in the top ten of the meeting seed list, added together
 *   T3  the meeting seed points of those same T2 skiers, added together
 *   CPP = (T1 + T2 - T3) / 10, added to everyone on the list (may be negative)
 *
 * When fewer than five skiers qualify for T2, the same number of skiers is
 * used for T1 and the divisor is twice that number, which keeps the three
 * totals comparable; at least three are required.
 */

const REFERENCE_SKIERS = 5;
const TOP_FINISHERS = 10;
const MINIMUM_SKIERS = 3;

const sum = (skiers, field) =>
  skiers.reduce((total, skier) => total + skier[field], 0);

/**
 * Calculate the CPP for a seed list.
 * @param {Array} seedList - fetchSeedList rows (racer_id, names, position,
 *   seed_points, aasl_points)
 * @returns {Object} { success, cpp, t1, t2, t3, divisor, skiersUsed,
 *   referenceSkiers (T1 set), qualifyingSkiers (T2 set), formula } or
 *   { success: false, error }
 */
export const calculateCPP = async (competitionId, seedList) => {
  const withAasl = seedList
    .filter(
      (entry) => entry.aasl_points !== null && entry.aasl_points !== undefined,
    )
    .map((entry) => ({
      racer_id: entry.racer_id,
      name: `${entry.last_name}, ${entry.first_name}`,
      seed_points: entry.seed_points,
      aasl_points: entry.aasl_points,
      seed_position: entry.position ?? seedList.indexOf(entry) + 1,
    }))
    .sort((a, b) => a.aasl_points - b.aasl_points);

  const qualifyingSkiers = withAasl
    .filter((skier) => skier.seed_position <= TOP_FINISHERS)
    .slice(0, REFERENCE_SKIERS);
  if (qualifyingSkiers.length < MINIMUM_SKIERS) {
    return {
      success: false,
      error: `Not enough skiers with AASL points in the top ${TOP_FINISHERS} (found ${qualifyingSkiers.length}, need at least ${MINIMUM_SKIERS})`,
      qualifyingSkiers: qualifyingSkiers.length,
    };
  }
  const referenceSkiers = withAasl.slice(0, qualifyingSkiers.length);

  const t1 = sum(referenceSkiers, 'aasl_points');
  const t2 = sum(qualifyingSkiers, 'aasl_points');
  const t3 = sum(qualifyingSkiers, 'seed_points');
  const divisor = 2 * qualifyingSkiers.length;
  const cpp = (t1 + t2 - t3) / divisor;

  return {
    success: true,
    cpp,
    t1,
    t2,
    t3,
    divisor,
    skiersUsed: qualifyingSkiers.length,
    referenceSkiers,
    qualifyingSkiers,
    formula: `(${t1.toFixed(2)} + ${t2.toFixed(2)} - ${t3.toFixed(2)}) / ${divisor} = ${cpp.toFixed(2)}`,
  };
};

/**
 * Apply CPP to a seed list
 * @param {Array} seedList - Original seed list
 * @param {number} cpp - CPP value to apply
 * @returns {Array} Seed list with CPP-adjusted points
 */
export const applyCPPToSeedList = (seedList, cpp) => {
  return seedList.map((entry) => ({
    ...entry,
    cpp_applied: cpp,
    original_seed_points: entry.seed_points,
    final_seed_points: entry.seed_points + cpp,
  }));
};
