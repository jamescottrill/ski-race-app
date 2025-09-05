/* eslint-disable camelcase */
import * as dfd from 'danfojs';
import { round } from './MathFx';
import { RaceDataFetcher } from './seedCalculation/RaceDataFetcher';
import { SeedPointCalculator } from './seedCalculation/SeedPointCalculator';
import { PenaltyCalculator } from './seedCalculation/PenaltyCalculator';

const raceMultipliers = {
  Downhill: 1250,
  Slalom: 730,
  'Giant Slalom': 1010,
  'Super G': 1190,
  'Alpine Combined': 1360,
};

const DEFAULT_SEED_POINTS = 2000;

/**
 * Main seed list fetching and calculation logic
 * Refactored for better maintainability and clarity
 */
class SeedListManager {
  constructor(competitionId) {
    this.competitionId = competitionId;
  }

  /**
   * Fetch and calculate seed list for given races
   * @param {Array} raceIds - Array of race IDs to include
   * @returns {Promise<Array>} Calculated seed list
   */
  async fetchSeedList(raceIds) {
    // Handle empty race list
    if (raceIds.length === 0) {
      return this.getInitialSeedList();
    }

    // Get competitor data
    const peopleDf = await this.getCompetitorDataFrame();
    
    // Get race results and seed points
    const seedData = await this.fetchRaceSeedData(raceIds);
    
    if (seedData.length === 0) {
      return [];
    }

    // Create pivot table of results
    const pivotData = this.createPivotData(seedData);
    
    // Calculate seed points for each competitor
    const calculatedData = await this.calculateAllSeedPoints(pivotData, raceIds);
    
    // Merge with competitor info and sort
    const finalResults = this.mergeAndSortResults(peopleDf, calculatedData);
    
    return dfd.toJSON(finalResults);
  }

  /**
   * Get initial seed list (no races completed)
   */
  async getInitialSeedList() {
    const query = `
      SELECT cc.arrival_corps_seed AS seed_points, 
             cc.racer_id, 
             p.first_name, 
             p.last_name, 
             p.title, 
             p.dob, 
             p.gender 
      FROM competition_competitor cc 
      LEFT JOIN people p ON p.id = cc.racer_id 
      WHERE competition_id = ? 
      ORDER BY seed_points
    `;
    return window.api.select(query, [this.competitionId]);
  }

  /**
   * Get competitor data as DataFrame
   */
  async getCompetitorDataFrame() {
    const competitors = await RaceDataFetcher.getCompetitors(this.competitionId);
    return new dfd.DataFrame(competitors);
  }

  /**
   * Fetch seed data for all races
   */
  async fetchRaceSeedData(raceIds) {
    const raceTypes = await RaceDataFetcher.getRaceTypes(this.competitionId, raceIds);
    const seedPointResults = await RaceDataFetcher.getSeedPoints(raceTypes);
    
    const seedData = [];
    seedPointResults.forEach(raceResults => {
      raceResults.forEach(({ race_id, racer_id, seed_point }) => {
        seedData.push({ race_id, racer_id, seed_point });
      });
    });
    
    return seedData;
  }

  /**
   * Create pivot table from seed data
   */
  createPivotData(seedData) {
    const df = new dfd.DataFrame(seedData);
    const uniqueRacers = [...new Set(df.racer_id.values)];
    const uniqueRaces = [...new Set(df.race_id.values)];

    const pivotData = uniqueRacers.map(racerId => {
      const row = { racer_id: racerId };
      uniqueRaces.forEach(raceId => {
        row[raceId] = null;
      });
      row.seed_points = 0;
      return row;
    });

    df.values.forEach(([race_id, racer_id, seed_point]) => {
      const row = pivotData.find(row => row.racer_id === racer_id);
      if (row) {
        row[race_id] = seed_point;
      }
    });

    return pivotData;
  }

  /**
   * Calculate seed points for all competitors
   */
  async calculateAllSeedPoints(pivotData, raceIds) {
    const numRaces = raceIds.length;
    
    // Get previous seed lists for penalty calculations
    const previousSeedLists = await this.getPreviousSeedLists(raceIds);
    
    const calculatedData = await Promise.all(
      pivotData.map(row => 
        this.calculateRacerSeedPoints(
          row, 
          raceIds, 
          numRaces, 
          previousSeedLists
        )
      )
    );
    
    return calculatedData;
  }

  /**
   * Calculate seed points for a single racer
   */
  async calculateRacerSeedPoints(row, raceIds, numRaces, previousSeedLists) {
    const racePoints = SeedPointCalculator.extractRacePoints(row, raceIds);
    const nonNullRaces = racePoints.filter(x => x !== null && !Number.isNaN(x));
    
    // Handle missing races with penalties
    if (this.needsPenaltyCalculation(numRaces, nonNullRaces.length)) {
      await this.applyPenalties(row, raceIds, numRaces, nonNullRaces, previousSeedLists);
    }
    
    // Calculate final seed points
    const finalPoints = SeedPointCalculator.calculateFinalSeedPoints(
      SeedPointCalculator.extractRacePoints(row, raceIds), 
      numRaces
    );
    
    row.seed_points = round(finalPoints);
    return row;
  }

  /**
   * Check if penalty calculation is needed
   */
  needsPenaltyCalculation(numRaces, completedRaces) {
    const requiredRaces = Math.max(2, numRaces - 2);
    return completedRaces < requiredRaces;
  }

  /**
   * Apply penalties for missing races
   */
  async applyPenalties(row, raceIds, numRaces, nonNullRaces, previousSeedLists) {
    const mostRecentIncompleteRace = this.findMostRecentIncompleteRace(row, raceIds);
    
    if (!mostRecentIncompleteRace) {
      return;
    }
    
    const { prevSeedList } = previousSeedLists;
    const competitorRanking = prevSeedList.findIndex(x => x.racer_id === row.racer_id);
    
    // Get race results and calculate penalty
    const results = await RaceDataFetcher.getRaceResult(
      this.competitionId, 
      mostRecentIncompleteRace
    );
    
    const finishedResults = RaceDataFetcher.filterFinishedResults(results);
    const competitorResult = results.find(x => x.racer_id === row.racer_id);
    
    const baseSeedPoints = PenaltyCalculator.getSeedPointsForRanking(
      finishedResults, 
      competitorRanking
    );
    
    const penaltyPoints = PenaltyCalculator.calculatePenalty(
      baseSeedPoints,
      competitorResult?.is_ns
    );
    
    PenaltyCalculator.applyPenaltyToRow(row, mostRecentIncompleteRace, penaltyPoints);
    nonNullRaces.push(round(penaltyPoints));
  }

  /**
   * Find the most recent race where competitor didn't finish
   */
  findMostRecentIncompleteRace(row, raceIds) {
    for (let i = raceIds.length - 1; i >= 0; i--) {
      if (row[raceIds[i]] === null || Number.isNaN(row[raceIds[i]])) {
        return raceIds[i];
      }
    }
    return null;
  }

  /**
   * Get previous seed lists for penalty calculations
   */
  async getPreviousSeedLists(raceIds) {
    if (raceIds.length <= 1) {
      return { prevSeedList: [], prevSeedList2: [] };
    }
    
    const prevRaces = raceIds.slice(0, raceIds.length - 1);
    const prevSeedList = await this.fetchSeedList(prevRaces);
    
    let prevSeedList2 = [];
    if (raceIds.length > 2) {
      const prevRaces2 = raceIds.slice(0, raceIds.length - 2);
      prevSeedList2 = await this.fetchSeedList(prevRaces2);
    }
    
    return { prevSeedList, prevSeedList2 };
  }

  /**
   * Merge results with competitor info and sort
   */
  mergeAndSortResults(peopleDf, calculatedData) {
    const totalSeedDf = new dfd.DataFrame(calculatedData);
    
    const finalResults = dfd.merge({
      left: peopleDf,
      right: totalSeedDf,
      on: ['racer_id'],
      how: 'left',
    });
    
    finalResults.sortValues('last_name', { inplace: true, ascending: true });
    finalResults.sortValues('seed_points', { inplace: true, ascending: true });
    
    return SeedPointCalculator.addPositionRanks(finalResults);
  }
}

/**
 * Main export function for backward compatibility
 */
export const fetchSeedList = async (competitionId, raceIds) => {
  const manager = new SeedListManager(competitionId);
  return manager.fetchSeedList(raceIds);
};

export { raceMultipliers, DEFAULT_SEED_POINTS, SeedListManager };