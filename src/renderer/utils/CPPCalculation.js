/**
 * Championship Penalty Points (CPP) Calculation
 *
 * CPP is a normalisation mechanism to enable fair comparison of racers'
 * performance across different meetings.
 *
 * Formula: CPP = (T1 + T2 - T3) / divisor
 *
 * T1: Sum of AASL points for reference skiers with lowest AASL points on current seed list
 * T2: Sum of AASL points for those same skiers (who finished in top 10)
 * T3: Sum of current meeting seed points for those same skiers
 *
 * Divisor: 10 (5 skiers), 8 (4 skiers), 6 (3 skiers)
 */

import { getAASLPoints } from './AASLManagement';

/**
 * Calculate CPP for a competition based on seed list
 * @param {string} competitionId - Competition ID
 * @param {Array} seedList - Array of seed list entries with racer_id and seed_points
 * @returns {Promise<Object>} CPP calculation result
 */
export const calculateCPP = async (competitionId, seedList) => {
  // Step 1: Get AASL points for all competitors in the seed list
  const competitorsWithAASL = [];

  for (const entry of seedList) {
    const aaslEntry = await getAASLPoints(entry.racer_id);
    if (aaslEntry) {
      competitorsWithAASL.push({
        racer_id: entry.racer_id,
        name: `${entry.last_name}, ${entry.first_name}`,
        seed_points: entry.seed_points,
        aasl_points: aaslEntry.seed_points,
        seed_position: seedList.findIndex(s => s.racer_id === entry.racer_id) + 1
      });
    }
  }

  if (competitorsWithAASL.length < 3) {
    return {
      success: false,
      error: 'Not enough competitors with AASL points (minimum 3 required)',
      competitorsWithAASL: competitorsWithAASL.length
    };
  }

  // Step 2: Sort by AASL points (lowest first) and take top 5
  const sortedByAASL = [...competitorsWithAASL].sort((a, b) => a.aasl_points - b.aasl_points);

  // Step 3: Filter to those who finished in top 10 of current seed list
  const qualifyingSkiers = sortedByAASL
    .filter(skier => skier.seed_position <= 10)
    .slice(0, 5);

  if (qualifyingSkiers.length < 3) {
    return {
      success: false,
      error: `Not enough qualifying skiers (found ${qualifyingSkiers.length}, need at least 3)`,
      qualifyingSkiers: qualifyingSkiers.length
    };
  }

  // Step 4: Calculate T1, T2, T3
  const T1 = qualifyingSkiers.reduce((sum, s) => sum + s.aasl_points, 0);
  const T2 = T1; // Same skiers, same AASL points
  const T3 = qualifyingSkiers.reduce((sum, s) => sum + s.seed_points, 0);

  // Step 5: Calculate CPP with appropriate divisor
  const numSkiers = qualifyingSkiers.length;
  let divisor;
  switch (numSkiers) {
    case 5:
      divisor = 10;
      break;
    case 4:
      divisor = 8;
      break;
    case 3:
      divisor = 6;
      break;
    default:
      return {
        success: false,
        error: 'Invalid number of qualifying skiers'
      };
  }

  const cpp = (T1 + T2 - T3) / divisor;

  return {
    success: true,
    cpp: cpp,
    t1: T1,
    t2: T2,
    t3: T3,
    divisor: divisor,
    skiersUsed: numSkiers,
    qualifyingSkiers: qualifyingSkiers,
    formula: `(${T1.toFixed(2)} + ${T2.toFixed(2)} - ${T3.toFixed(2)}) / ${divisor} = ${cpp.toFixed(2)}`
  };
};

/**
 * Apply CPP to a seed list
 * @param {Array} seedList - Original seed list
 * @param {number} cpp - CPP value to apply
 * @returns {Array} Seed list with CPP-adjusted points
 */
export const applyCPPToSeedList = (seedList, cpp) => {
  return seedList.map(entry => ({
    ...entry,
    cpp_applied: cpp,
    original_seed_points: entry.seed_points,
    final_seed_points: entry.seed_points + cpp
  }));
};

/**
 * Store CPP calculation result in database
 * @param {string} competitionId - Competition ID
 * @param {Object} cppResult - Result from calculateCPP
 * @returns {Promise<Object>} Storage result
 */
export const storeCPPResult = async (competitionId, cppResult) => {
  const { v4: uuid4 } = await import('uuid');

  const query = `
    INSERT INTO competition_cpp (id, competition_id, cpp_value, calculation_date, t1_sum, t2_sum, t3_sum, skiers_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    uuid4(),
    competitionId,
    cppResult.cpp,
    new Date().toISOString(),
    cppResult.t1,
    cppResult.t2,
    cppResult.t3,
    cppResult.skiersUsed
  ];

  try {
    await window.api.insert(query, params);
    return { success: true };
  } catch (error) {
    console.error('Failed to store CPP result:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Store finalised seed list with CPP applied
 * @param {string} competitionId - Competition ID
 * @param {Array} finalisedSeedList - Seed list with CPP applied
 * @returns {Promise<Object>} Storage result
 */
export const storeFinalSeedList = async (competitionId, finalisedSeedList) => {
  let successCount = 0;
  let errorCount = 0;
  const finalisedDate = new Date().toISOString();

  for (const entry of finalisedSeedList) {
    // Check if entry already exists
    const existing = await window.api.select(
      `SELECT competition_id FROM competition_final_seed_list WHERE competition_id = ? AND racer_id = ?`,
      [competitionId, entry.racer_id]
    );

    try {
      if (existing.length > 0) {
        // Update existing
        await window.api.insert(`
          UPDATE competition_final_seed_list
          SET raw_seed_points = ?, cpp_applied = ?, final_seed_points = ?, aasl_points = ?, finalised_date = ?
          WHERE competition_id = ? AND racer_id = ?
        `, [
          entry.original_seed_points || entry.seed_points,
          entry.cpp_applied,
          entry.final_seed_points,
          entry.aasl_points || null,
          finalisedDate,
          competitionId,
          entry.racer_id
        ]);
      } else {
        // Insert new
        await window.api.insert(`
          INSERT INTO competition_final_seed_list
          (competition_id, racer_id, raw_seed_points, cpp_applied, final_seed_points, aasl_points, finalised_date)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          competitionId,
          entry.racer_id,
          entry.original_seed_points || entry.seed_points,
          entry.cpp_applied,
          entry.final_seed_points,
          entry.aasl_points || null,
          finalisedDate
        ]);
      }
      successCount++;
    } catch (error) {
      console.error('Failed to store seed list entry:', error);
      errorCount++;
    }
  }

  return {
    success: errorCount === 0,
    successCount,
    errorCount
  };
};

/**
 * Get stored CPP result for a competition
 * @param {string} competitionId - Competition ID
 * @returns {Promise<Object|null>} CPP result or null
 */
export const getStoredCPP = async (competitionId) => {
  try {
    const result = await window.api.select(
      `SELECT * FROM competition_cpp WHERE competition_id = ? ORDER BY calculation_date DESC LIMIT 1`,
      [competitionId]
    );
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to get stored CPP:', error);
    return null;
  }
};

/**
 * Get finalised seed list for a competition
 * @param {string} competitionId - Competition ID
 * @returns {Promise<Array>} Finalised seed list entries
 */
export const getFinalSeedList = async (competitionId) => {
  try {
    return await window.api.select(`
      SELECT cfs.*, p.first_name, p.last_name
      FROM competition_final_seed_list cfs
      JOIN people p ON cfs.racer_id = p.id
      WHERE cfs.competition_id = ?
      ORDER BY cfs.final_seed_points ASC
    `, [competitionId]);
  } catch (error) {
    console.error('Failed to get final seed list:', error);
    return [];
  }
};
