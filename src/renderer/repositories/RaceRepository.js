import { BaseRepository } from './BaseRepository';

/**
 * Repository for race-related database operations
 */
export class RaceRepository extends BaseRepository {
  constructor() {
    super('races');
  }

  /**
   * Get all races for a competition
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Array>} Races in the competition
   */
  async getCompetitionRaces(competitionId) {
    const query = `
      SELECT * FROM races 
      WHERE competition_id = ? 
      ORDER BY race_date, race_name
    `;
    
    return this.select(query, [competitionId]);
  }

  /**
   * Get race details with officials
   * @param {string} raceId - Race ID
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Object>} Race details
   */
  async getRaceDetails(raceId, competitionId) {
    const query = `
      SELECT 
        r.*,
        c.competition_name,
        td.first_name || ' ' || td.last_name AS tech_delegate_name,
        ref.first_name || ' ' || ref.last_name AS referee_name,
        aref.first_name || ' ' || aref.last_name AS asst_referee_name,
        cor.first_name || ' ' || cor.last_name AS chief_of_race_name
      FROM races r
      LEFT JOIN competitions c ON r.competition_id = c.id
      LEFT JOIN people td ON r.tech_delegate = td.id
      LEFT JOIN people ref ON r.referee = ref.id
      LEFT JOIN people aref ON r.asst_referee = aref.id
      LEFT JOIN people cor ON r.chief_of_race = cor.id
      WHERE r.race_id = ? AND r.competition_id = ?
    `;
    
    const results = await this.select(query, [raceId, competitionId]);
    return results[0];
  }

  /**
   * Create a new race
   * @param {Object} raceData - Race data
   * @returns {Promise<Object>} Insert result
   */
  async createRace(raceData) {
    return this.create(raceData);
  }

  /**
   * Update race details
   * @param {string} raceId - Race ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Update result
   */
  async updateRace(raceId, updateData) {
    return this.update(raceId, updateData, 'race_id');
  }

  /**
   * Get seeding race for competition
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Object>} Seeding race or null
   */
  async getSeedingRace(competitionId) {
    const query = `
      SELECT * FROM races 
      WHERE competition_id = ? AND is_seeding = 1 
      LIMIT 1
    `;
    
    const results = await this.select(query, [competitionId]);
    return results[0] || null;
  }

  /**
   * Get races with results
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Array>} Races that have results recorded
   */
  async getRacesWithResults(competitionId) {
    const query = `
      SELECT DISTINCT r.* 
      FROM races r
      INNER JOIN race_competitor rc ON r.race_id = rc.race_id
      WHERE r.competition_id = ? 
        AND (rc.run1_time IS NOT NULL OR rc.run2_time IS NOT NULL)
      ORDER BY r.race_date
    `;
    
    return this.select(query, [competitionId]);
  }

  /**
   * Get race run details
   * @param {string} raceId - Race ID
   * @param {number} runNumber - Run number (1 or 2)
   * @returns {Promise<Object>} Run details
   */
  async getRunDetails(raceId, runNumber) {
    const prefix = runNumber === 1 ? 'run1' : 'run2';
    const query = `
      SELECT 
        ${prefix}_course_setter AS course_setter,
        ${prefix}_number_gates AS number_gates,
        ${prefix}_turning_gates AS turning_gates,
        ${prefix}_start_time AS start_time,
        ${prefix}_forerunner_1 AS forerunner_1,
        ${prefix}_forerunner_2 AS forerunner_2,
        ${prefix}_forerunner_3 AS forerunner_3,
        ${prefix}_forerunner_4 AS forerunner_4
      FROM races
      WHERE race_id = ?
    `;
    
    const results = await this.select(query, [raceId]);
    return results[0];
  }

  /**
   * Update run details
   * @param {string} raceId - Race ID
   * @param {number} runNumber - Run number (1 or 2)
   * @param {Object} runData - Run data to update
   * @returns {Promise<Object>} Update result
   */
  async updateRunDetails(raceId, runNumber, runData) {
    const prefix = runNumber === 1 ? 'run1' : 'run2';
    const updateData = {};
    
    Object.keys(runData).forEach(key => {
      updateData[`${prefix}_${key}`] = runData[key];
    });
    
    return this.updateRace(raceId, updateData);
  }

  /**
   * Get race types and counts
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Array>} Race type statistics
   */
  async getRaceTypeStats(competitionId) {
    const query = `
      SELECT 
        race_type,
        COUNT(*) as count,
        SUM(CASE WHEN is_team = 1 THEN 1 ELSE 0 END) as team_races,
        SUM(CASE WHEN is_individual = 1 THEN 1 ELSE 0 END) as individual_races
      FROM races
      WHERE competition_id = ?
      GROUP BY race_type
    `;
    
    return this.select(query, [competitionId]);
  }

  /**
   * Check if race has results
   * @param {string} raceId - Race ID
   * @returns {Promise<boolean>} True if race has results
   */
  async hasResults(raceId) {
    const query = `
      SELECT COUNT(*) as count
      FROM race_competitor
      WHERE race_id = ? 
        AND (run1_time IS NOT NULL OR run2_time IS NOT NULL)
    `;
    
    const result = await this.select(query, [raceId]);
    return result[0].count > 0;
  }

  /**
   * Delete race and all related data
   * @param {string} raceId - Race ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteRaceComplete(raceId) {
    // Delete race results first
    await this.delete('DELETE FROM race_competitor WHERE race_id = ?', [raceId]);
    await this.delete('DELETE FROM race_team WHERE race_id = ?', [raceId]);
    
    // Then delete the race
    return this.deleteById(raceId, 'race_id');
  }
}