import { BaseRepository } from './BaseRepository';

/**
 * Repository for competitor-related database operations
 */
export class CompetitorRepository extends BaseRepository {
  constructor() {
    super('competition_competitor');
  }

  /**
   * Get all competitors for a competition
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Array>} Competitors with personal details
   */
  async getCompetitionCompetitors(competitionId) {
    const query = `
      SELECT 
        cc.*,
        p.first_name,
        p.last_name,
        p.title,
        p.dob,
        p.country,
        p.service_number,
        p.gender
      FROM competition_competitor cc
      LEFT JOIN people p ON cc.racer_id = p.id
      WHERE cc.competition_id = ?
      ORDER BY p.last_name, p.first_name
    `;
    
    return this.select(query, [competitionId]);
  }

  /**
   * Get competitors with team information
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Array>} Competitors with team details
   */
  async getCompetitorsWithTeams(competitionId) {
    const query = `
      SELECT 
        cc.*,
        p.first_name,
        p.last_name,
        p.dob,
        p.gender,
        ct.team_name,
        ct.is_corps,
        ct.is_female as team_female,
        ct.is_reserve as team_reserve
      FROM competition_competitor cc
      LEFT JOIN people p ON cc.racer_id = p.id
      LEFT JOIN competition_team_members ctm ON 
        cc.racer_id = ctm.racer_id AND 
        cc.competition_id = ctm.competition_id
      LEFT JOIN competition_team ct ON 
        ctm.team_id = ct.team_id AND 
        ctm.competition_id = ct.competition_id
      WHERE cc.competition_id = ?
      ORDER BY cc.arrival_corps_seed
    `;
    
    return this.select(query, [competitionId]);
  }

  /**
   * Register a new competitor for a competition
   * @param {Object} competitorData - Competitor registration data
   * @returns {Promise<Object>} Registration result
   */
  async registerCompetitor(competitorData) {
    const {
      competition_id,
      racer_id,
      arrival_army_seed,
      arrival_corps_seed,
      title,
      is_novice,
      is_junior,
      is_senior,
      is_veteran,
      is_reserve,
      is_female,
      is_hc,
      regiment
    } = competitorData;

    const query = `
      INSERT INTO competition_competitor (
        competition_id, racer_id, arrival_army_seed, arrival_corps_seed,
        title, is_novice, is_junior, is_senior, is_veteran,
        is_reserve, is_female, is_hc, regiment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      competition_id, racer_id, arrival_army_seed, arrival_corps_seed,
      title, is_novice, is_junior, is_senior, is_veteran,
      is_reserve, is_female, is_hc, regiment
    ];

    return this.insert(query, params);
  }

  /**
   * Update competitor details
   * @param {string} competitionId - Competition ID
   * @param {string} racerId - Racer ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Update result
   */
  async updateCompetitor(competitionId, racerId, updateData) {
    const keys = Object.keys(updateData);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const values = [...keys.map(key => updateData[key]), competitionId, racerId];
    
    const query = `
      UPDATE competition_competitor 
      SET ${setClause} 
      WHERE competition_id = ? AND racer_id = ?
    `;
    
    return this.select(query, values);
  }

  /**
   * Get competitor seed points
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Array>} Competitors with seed points
   */
  async getCompetitorSeedPoints(competitionId) {
    const query = `
      SELECT 
        cc.racer_id,
        cc.arrival_corps_seed AS seed_points,
        p.first_name,
        p.last_name,
        p.title,
        p.dob,
        p.gender,
        cc.regiment
      FROM competition_competitor cc
      LEFT JOIN people p ON cc.racer_id = p.id
      WHERE cc.competition_id = ?
      ORDER BY cc.arrival_corps_seed ASC
    `;
    
    return this.select(query, [competitionId]);
  }

  /**
   * Check if competitor is registered for competition
   * @param {string} competitionId - Competition ID
   * @param {string} racerId - Racer ID
   * @returns {Promise<boolean>} True if registered
   */
  async isRegistered(competitionId, racerId) {
    const count = await this.count({
      competition_id: competitionId,
      racer_id: racerId
    });
    
    return count > 0;
  }

  /**
   * Get competitors by category
   * @param {string} competitionId - Competition ID
   * @param {string} category - Category (novice, junior, senior, veteran)
   * @returns {Promise<Array>} Competitors in category
   */
  async getCompetitorsByCategory(competitionId, category) {
    const categoryColumn = `is_${category}`;
    const query = `
      SELECT 
        cc.*,
        p.first_name,
        p.last_name,
        p.dob,
        p.gender
      FROM competition_competitor cc
      LEFT JOIN people p ON cc.racer_id = p.id
      WHERE cc.competition_id = ? AND cc.${categoryColumn} = 1
      ORDER BY cc.arrival_corps_seed
    `;
    
    return this.select(query, [competitionId]);
  }

  /**
   * Bulk insert competitors
   * @param {Array} competitors - Array of competitor data
   * @returns {Promise<Object>} Insert results
   */
  async bulkInsertCompetitors(competitors) {
    const results = [];
    
    for (const competitor of competitors) {
      try {
        const result = await this.registerCompetitor(competitor);
        results.push({ success: true, data: competitor, result });
      } catch (error) {
        results.push({ success: false, data: competitor, error: error.message });
      }
    }
    
    return results;
  }
}