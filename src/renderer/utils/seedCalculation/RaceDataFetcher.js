import { seedPointsOneRun, seedPointsTwoRun } from '../../queries/SeedPoints';
import { seedingPoints } from '../../queries/SeedResults';
import { raceQuery } from '../../components/RaceResultTwoRun';
import { raceQueryOneRun } from '../../components/RaceResult';

/**
 * Handles fetching race-related data from the database
 */
export class RaceDataFetcher {
  /**
   * Get race result for a specific race
   * @param {string} competitionId - Competition identifier
   * @param {string} raceId - Race identifier
   * @returns {Promise<Array>} Race results
   */
  static async getRaceResult(competitionId, raceId) {
    const query = `SELECT number_runs FROM races WHERE race_id = ? AND competition_id = ?`;
    const results = await window.api.select(query, [raceId, competitionId]);
    const numRuns = results[0].number_runs;
    
    let query2;
    let values;
    if (numRuns === 1) {
      query2 = raceQueryOneRun;
      values = [raceId];
    } else {
      query2 = raceQuery;
      values = [raceId, raceId];
    }
    
    return window.api.select(query2, values);
  }

  /**
   * Get the seeding race for a competition
   * @param {string} competitionId - Competition identifier
   * @returns {Promise<string>} Seeding race ID
   */
  static async getSeedingRace(competitionId) {
    const query = `SELECT race_id FROM races WHERE competition_id = ? AND is_seeding = 1`;
    const results = await window.api.select(query, [competitionId]);
    return results[0]?.race_id;
  }

  /**
   * Get race types for multiple races
   * @param {string} competitionId - Competition identifier
   * @param {Array} raceIds - Array of race IDs
   * @returns {Promise<Array>} Race type information
   */
  static async getRaceTypes(competitionId, raceIds) {
    const raceTypePromises = raceIds.map(race => {
      const query = `SELECT race_id AS raceId, is_seeding AS isSeeding, number_runs AS numRuns 
                     FROM races WHERE race_id = ? AND competition_id = ?`;
      return window.api.select(query, [race, competitionId]);
    });
    
    return Promise.all(raceTypePromises);
  }

  /**
   * Get seed points for races
   * @param {Array} raceTypes - Race type information
   * @returns {Promise<Array>} Seed point results
   */
  static async getSeedPoints(raceTypes) {
    const resultsPromise = raceTypes.map(raceType => {
      let query;
      let values;
      
      if (raceType[0].isSeeding) {
        query = seedingPoints;
        values = [raceType[0].raceId, raceType[0].raceId];
      } else if (raceType[0].numRuns === 1) {
        query = seedPointsOneRun;
        values = [raceType[0].raceId];
      } else if (raceType[0].numRuns === 2) {
        query = seedPointsTwoRun;
        values = [raceType[0].raceId, raceType[0].raceId];
      }
      
      return window.api.select(query, values);
    });
    
    return Promise.all(resultsPromise);
  }

  /**
   * Get competitors for a competition
   * @param {string} competitionId - Competition identifier
   * @returns {Promise<Array>} Competitor data
   */
  static async getCompetitors(competitionId) {
    const query = `
      SELECT cc.*,
        p.first_name,
        p.last_name,
        p.dob,
        p.gender,
        cc.regiment AS team_name
      FROM competition_competitor cc
      LEFT JOIN people p ON cc.racer_id = p.id
      WHERE cc.competition_id = ?
    `;
    
    return window.api.select(query, [competitionId]);
  }

  /**
   * Filter finished results (excluding DNF, DNS, DSQ, NS)
   * @param {Array} results - Race results
   * @returns {Array} Filtered results
   */
  static filterFinishedResults(results) {
    return results.filter(x => 
      x.seed_points !== null &&
      !x.is_ns &&
      !x.is_dnf &&
      !x.is_dsq &&
      !x.is_dns
    );
  }
}