/**
 * AASL (Army Alpine Seed List) Management Utilities
 */

/**
 * Get AASL points for a person by service number
 * @param {string} serviceNumber - The service number (person id)
 * @param {string} season - Optional season to filter by
 * @returns {Promise<Object|null>} AASL entry or null if not found
 */
export const getAASLPoints = async (serviceNumber, season = null) => {
  const query = season
    ? `SELECT * FROM aasl WHERE service_number = ? AND season = ? ORDER BY import_date DESC LIMIT 1`
    : `SELECT * FROM aasl WHERE service_number = ? ORDER BY season DESC, import_date DESC LIMIT 1`;
  const params = season ? [serviceNumber, season] : [serviceNumber];

  try {
    const result = await window.api.select(query, params);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to get AASL points:', error);
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
    ? `SELECT * FROM aasl WHERE season = ? ORDER BY seed_points ASC`
    : `SELECT * FROM aasl ORDER BY season DESC, seed_points ASC`;
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
 * Validate parsed AASL rows before anything is written.
 * @param {Array} entries - Rows with serviceNumber and seedPoints (raw cell values)
 * @returns {Array} One entry per row with rowNumber, coerced values, problems and isValid
 */
export const validateAASLEntries = (entries) => {
  const firstRowForServiceNumber = new Map();

  return entries.map((entry, index) => {
    // Prefer the caller's spreadsheet row number; otherwise number from 1
    const rowNumber = entry.rowNumber ?? index + 1;
    const serviceNumber = String(entry.serviceNumber ?? '').trim();
    const rawPoints = entry.seedPoints;
    const pointsMissing = rawPoints === '' || rawPoints === null || rawPoints === undefined;
    const seedPoints = pointsMissing ? NaN : Number(rawPoints);
    const problems = [];

    if (!serviceNumber) {
      problems.push('Missing service number');
    }
    if (pointsMissing) {
      problems.push('Missing seed points');
    } else if (Number.isNaN(seedPoints)) {
      problems.push(`Seed points "${rawPoints}" is not a number`);
    } else if (seedPoints < 0) {
      problems.push('Seed points cannot be negative');
    }
    if (serviceNumber) {
      if (firstRowForServiceNumber.has(serviceNumber)) {
        problems.push(
          `Service number already used on row ${firstRowForServiceNumber.get(serviceNumber)}`,
        );
      } else {
        firstRowForServiceNumber.set(serviceNumber, rowNumber);
      }
    }

    return {
      ...entry,
      rowNumber,
      serviceNumber,
      seedPoints,
      rawSeedPoints: rawPoints,
      problems,
      isValid: problems.length === 0,
    };
  });
};

/**
 * Build one upsert per entry for window.api.transaction
 * @param {Array} entries - Validated entries
 * @param {string} season - Season the entries belong to
 * @param {string} importDate - ISO timestamp recorded against each row
 */
export const buildAASLOperations = (entries, season, importDate) =>
  entries.map((entry) => ({
    type: 'insert',
    query: `
      INSERT INTO aasl (service_number, first_name, last_name, gender, category, seed_points, season, import_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(service_number, season) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        gender = excluded.gender,
        category = excluded.category,
        seed_points = excluded.seed_points,
        import_date = excluded.import_date
    `,
    params: [
      entry.serviceNumber,
      entry.firstName ?? null,
      entry.lastName ?? null,
      entry.gender ?? null,
      entry.category ?? null,
      entry.seedPoints,
      season,
      importDate,
    ],
  }));

/**
 * Import AASL entries from parsed data as one transaction: every valid row
 * is written or none is. Rows that fail validation are skipped and returned
 * so the caller can list them.
 * @param {Array} entries - Array of AASL entries to import
 * @param {string} season - Season for these entries
 * @returns {Promise<Object>} Counts of created/updated/skipped rows and the skipped rows
 * @throws When the season is missing, nothing is importable, or the write fails
 */
export const importAASLEntries = async (entries, season) => {
  const seasonKey = String(season ?? '').trim();
  if (!seasonKey) {
    throw new Error('A season is required');
  }

  const rows = validateAASLEntries(entries);
  const valid = rows.filter((row) => row.isValid);
  const skipped = rows.filter((row) => !row.isValid);
  if (valid.length === 0) {
    throw new Error('No rows can be imported');
  }

  const existing = await window.api.select(
    `SELECT service_number FROM aasl WHERE season = ?`,
    [seasonKey],
  );
  const existingServiceNumbers = new Set(existing.map((row) => row.service_number));

  await window.api.transaction(
    buildAASLOperations(valid, seasonKey, new Date().toISOString()),
  );

  const updateCount = valid.filter((row) =>
    existingServiceNumbers.has(row.serviceNumber),
  ).length;

  return {
    success: true,
    successCount: valid.length - updateCount,
    updateCount,
    skippedCount: skipped.length,
    skipped,
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
      COUNT(CASE WHEN gender = 'M' THEN 1 END) as male,
      COUNT(CASE WHEN gender = 'F' THEN 1 END) as female,
      MIN(seed_points) as best_points,
      MAX(seed_points) as worst_points,
      AVG(seed_points) as avg_points
    FROM aasl
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
