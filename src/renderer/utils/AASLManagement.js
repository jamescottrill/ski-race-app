/**
 * AASL (Army Alpine Seed List) Management Utilities
 */

/**
 * Get AASL points for a person by service number
 * @param {string} serviceNumber - The service number (person id)
 * @param {string} season - Optional season to filter by
 * @returns {Promise<Object|null>} AASL entry or null if not found
 */

import { v4 } from 'uuid';
import { hashServiceNumber } from './hashUtils';

export const getAASLPoints = async (serviceNumber, season = null) => {
  // Hash the service number to match the stored hashed id
  const hashedId = await hashServiceNumber(serviceNumber);
  if (!hashedId) return null;

  const query = season
    ? `SELECT * FROM aasl WHERE service_number = ? AND season = ? ORDER BY import_date DESC LIMIT 1`
    : `SELECT * FROM aasl WHERE service_number = ? ORDER BY season DESC, import_date DESC LIMIT 1`;
  const params = season ? [hashedId, season] : [hashedId];

  try {
    const result = await window.api.select(query, params);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to get AASL points:', error);
    return null;
  }
};

/**
 * Get AASL points for a person by name
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} season - Optional season to filter by
 * @returns {Promise<Object|null>} AASL entry or null if not found
 */
export const getAASLPointsByName = async (firstName, lastName, season = null) => {
  const query = season
    ? `SELECT * FROM aasl WHERE UPPER(first_name) = UPPER(?) AND UPPER(last_name) = UPPER(?) AND season = ? ORDER BY import_date DESC LIMIT 1`
    : `SELECT * FROM aasl WHERE UPPER(first_name) = UPPER(?) AND UPPER(last_name) = UPPER(?) ORDER BY season DESC, import_date DESC LIMIT 1`;
  const params = season ? [firstName, lastName, season] : [firstName, lastName];

  try {
    const result = await window.api.select(query, params);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to get AASL points by name:', error);
    return null;
  }
};

/**
 * Get all AASL entries, optionally filtered by season
 * @param {string} season - Optional season to filter by
 * @returns {Promise<Array>} Array of AASL entries
 */
export const getAllAASLEntries = async (season = null) => {
  const query = season
    ? `SELECT a.category, a.seed_points, a.season,
       p.first_name, p.last_name, p.gender, p.title
        FROM aasl a
        LEFT JOIN people p ON a.service_number = p.id
         WHERE season = ? ORDER BY seed_points ASC`
    : `SELECT a.category, a.seed_points, a.season,
       p.first_name, p.last_name, p.gender, p.title
        FROM aasl a
        LEFT JOIN people p ON a.service_number = p.id
         ORDER BY season DESC, seed_points ASC`;
  const params = season ? [season] : [];

  try {
    return await window.api.select(query, params);
  } catch (error) {
    console.error('Failed to get AASL entries:', error);
    return [];
  }
};

/**
 * Get available seasons from AASL data
 * @returns {Promise<Array>} Array of season strings
 */
export const getAASLSeasons = async () => {
  const query = `SELECT DISTINCT season FROM aasl ORDER BY season DESC`;

  try {
    const result = await window.api.select(query, []);
    return result.map(r => r.season);
  } catch (error) {
    console.error('Failed to get AASL seasons:', error);
    return [];
  }
};

/**
 * Import AASL entries from parsed data
 * Supports matching by service number OR by name (first_name + last_name)
 * @param {Array} entries - Array of AASL entries to import
 * @param {string} season - Season for these entries
 * @returns {Promise<Object>} Import result with success/error counts
 */
export const importAASLEntries = async (entries, season) => {
  let successCount = 0;
  let errorCount = 0;
  let updateCount = 0;
  const errors = [];
  const importDate = new Date().toISOString();

  for (const entry of entries) {
    try {
      let existing = null;
      let hashedServiceNumber = null;

      // First try to match by service number if provided
      if (entry.serviceNumber) {
        hashedServiceNumber = await hashServiceNumber(entry.serviceNumber);
        try {
          const byServiceNumber = await window.api.select(
            `SELECT service_number FROM aasl WHERE service_number = ? AND season = ?`,
            [hashedServiceNumber, season]
          );
          if (byServiceNumber.length > 0) {
            existing = byServiceNumber[0];
          }
        } catch(err) {
          console.log(err);
        }
      }

      if (existing && existing.service_number) {
        // Update existing entry
        const updateQuery = `
          UPDATE aasl
          SET first_name = ?, last_name = ?,
              seed_points = ?, import_date = ?
          WHERE service_number = ? AND season = ?
        `;
        await window.api.insert(updateQuery, [
          entry.firstName,
          entry.lastName,
          entry.seedPoints,
          importDate,
          existing.service_number,
          season
        ]);
        updateCount++;
      } else {
        // Insert new entry - look up existing person by name or create new
        const sn = await window.api.select(
          `SELECT id AS service_number FROM people WHERE UPPER(first_name) = UPPER(?) AND UPPER(last_name) = UPPER(?)`,
          [entry.firstName, entry.lastName]
        );

        let serviceNumberToUse;
        if (sn.length > 0) {
          // Use existing person's hashed id
          serviceNumberToUse = sn[0].service_number;
        } else if (hashedServiceNumber) {
          // Use the hashed service number from the import
          serviceNumberToUse = hashedServiceNumber;
          await window.api.insert(`INSERT INTO PEOPLE(id, first_name, last_name) VALUES(?,?,?)`,
            [
              serviceNumberToUse,
              entry.firstName,
              entry.lastName
            ]);
        } else {
          // Generate a UUID for new person without service number
          serviceNumberToUse = v4();
          await window.api.insert(`INSERT INTO PEOPLE(id, first_name, last_name) VALUES(?,?,?)`,
            [
              serviceNumberToUse,
              entry.firstName,
              entry.lastName
            ]);
        }

        const insertQuery = `
          INSERT INTO aasl (service_number, first_name, last_name, seed_points, season, import_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        await window.api.insert(insertQuery, [
          serviceNumberToUse,
          entry.firstName,
          entry.lastName,
          entry.seedPoints,
          season,
          importDate
        ]);
        successCount++;
      }
    } catch (error) {
      errorCount++;
      errors.push({ entry, error: error.message });
    }
  }

  if (errors.length > 0) {
    console.error('AASL import errors:', errors);
  }

  return {
    success: errorCount === 0,
    successCount,
    updateCount,
    errorCount,
    errors
  };
};

/**
 * Delete AASL entries by season
 * @param {string} season - Season to delete
 * @returns {Promise<Object>} Delete result
 */
export const deleteAASLBySeason = async (season) => {
  const query = `DELETE FROM aasl WHERE season = ?`;

  try {
    const result = await window.api.delete(query, [season]);
    return { success: true, deleted: result.changes };
  } catch (error) {
    console.error('Failed to delete AASL entries:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get AASL statistics for a season
 * @param {string} season - Season to get stats for
 * @returns {Promise<Object>} Statistics object
 */
export const getAASLStats = async (season) => {
  const query = `
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN p.gender = 'M' THEN 1 END) as male,
      COUNT(CASE WHEN p.gender = 'F' THEN 1 END) as female,
      MIN(seed_points) as best_points,
      MAX(seed_points) as worst_points,
      AVG(seed_points) as avg_points
    FROM aasl a
    LEFT JOIN people p ON p.id = a.service_number
    WHERE season = ?
  `;

  try {
    const result = await window.api.select(query, [season]);
    return result[0] || {
      total: 0,
      male: 0,
      female: 0,
      best_points: null,
      worst_points: null,
      avg_points: null
    };
  } catch (error) {
    console.error('Failed to get AASL stats:', error);
    return { total: 0 };
  }
};
