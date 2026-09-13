/**
 * Championship Penalty Points (CPP) persistence.
 *
 * The calculation itself lives in @awsa/scoring (calculateCPP,
 * applyCPPToSeedList) so the public site and the server tests share it; this
 * module keeps the database reads and writes around it.
 */
import { calculateCPP, applyCPPToSeedList } from '@awsa/scoring';

export { calculateCPP, applyCPPToSeedList };

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
    cppResult.skiersUsed,
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
  const finalisedDate = new Date().toISOString();

  // Upsert every entry in one transaction: the finalised list is either
  // stored completely or not at all, never partially
  const operations = finalisedSeedList.map((entry) => ({
    type: 'insert',
    query: `
      INSERT INTO competition_final_seed_list
      (competition_id, racer_id, raw_seed_points, cpp_applied, final_seed_points, aasl_points, finalised_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(competition_id, racer_id)
      DO UPDATE SET raw_seed_points = excluded.raw_seed_points,
                    cpp_applied = excluded.cpp_applied,
                    final_seed_points = excluded.final_seed_points,
                    aasl_points = excluded.aasl_points,
                    finalised_date = excluded.finalised_date
    `,
    params: [
      competitionId,
      entry.racer_id,
      entry.original_seed_points || entry.seed_points,
      entry.cpp_applied,
      entry.final_seed_points,
      entry.aasl_points || null,
      finalisedDate,
    ],
  }));

  try {
    await window.api.transaction(operations);
    return {
      success: true,
      successCount: finalisedSeedList.length,
      errorCount: 0,
    };
  } catch (error) {
    console.error('Failed to store finalised seed list:', error);
    return {
      success: false,
      successCount: 0,
      errorCount: finalisedSeedList.length,
      error: error.message,
    };
  }
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
      [competitionId],
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
    return await window.api.select(
      `
      SELECT cfs.*, p.first_name, p.last_name
      FROM competition_final_seed_list cfs
      JOIN people p ON cfs.racer_id = p.id
      WHERE cfs.competition_id = ?
      ORDER BY cfs.final_seed_points ASC
    `,
      [competitionId],
    );
  } catch (error) {
    console.error('Failed to get final seed list:', error);
    return [];
  }
};
