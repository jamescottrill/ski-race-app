import { round } from '../MathFx';

/**
 * Calculates seed points for competitors based on race results
 */
export class SeedPointCalculator {
  /**
   * Calculate final seed points based on number of races
   * @param {Array} racePoints - Array of race points
   * @param {number} numRaces - Total number of races
   * @returns {number} Final seed points
   */
  static calculateFinalSeedPoints(racePoints, numRaces) {
    const nonNullRaces = racePoints.filter(x => x !== null && !Number.isNaN(x));
    
    switch (numRaces) {
      case 1:
        return this.calculateSingleRace(nonNullRaces);
      case 2:
        return this.calculateTwoRaces(nonNullRaces);
      case 3:
        return this.calculateThreeRaces(nonNullRaces);
      case 4:
        return this.calculateFourRaces(nonNullRaces);
      default:
        return this.calculateMultipleRaces(nonNullRaces, numRaces);
    }
  }

  static calculateSingleRace(nonNullRaces) {
    return nonNullRaces[0] || 2000;
  }

  static calculateTwoRaces(nonNullRaces) {
    // Better of initial points and first race
    return Math.min.apply(Math, nonNullRaces);
  }

  static calculateThreeRaces(nonNullRaces) {
    // Sum of best two divided by 2
    if (nonNullRaces.length < 2) {
      return nonNullRaces[0] || 2000;
    }
    const bestTwo = nonNullRaces.sort((a, b) => a - b).slice(0, 2);
    return (bestTwo[0] + bestTwo[1]) / 2;
  }

  static calculateFourRaces(nonNullRaces) {
    // Sum of best three divided by 3
    if (nonNullRaces.length < 3) {
      return this.calculateThreeRaces(nonNullRaces);
    }
    const bestThree = nonNullRaces
      .sort((a, b) => a - b || Number.isNaN(a) - Number.isNaN(b))
      .slice(0, 3);
    return (bestThree[0] + bestThree[1] + bestThree[2]) / 3;
  }

  static calculateMultipleRaces(nonNullRaces, numRaces) {
    // Sum of best (n - 2) divided by (n - 2)
    const numMinusTwo = numRaces - 2;
    if (nonNullRaces.length < numMinusTwo) {
      return nonNullRaces.reduce((acc, val) => acc + val, 0) / nonNullRaces.length || 2000;
    }
    const bestNMinusTwo = nonNullRaces
      .sort((a, b) => a - b || Number.isNaN(a) - Number.isNaN(b))
      .slice(0, numMinusTwo);
    return bestNMinusTwo.reduce((acc, val) => acc + val, 0) / bestNMinusTwo.length;
  }

  /**
   * Extract race points from a competitor row
   * @param {Object} row - Competitor data row
   * @param {Array} raceIds - Array of race IDs
   * @returns {Array} Array of race points
   */
  static extractRacePoints(row, raceIds) {
    return Object.keys(row)
      .filter(key => 
        key !== 'racer_id' && 
        key !== 'seed_points' && 
        !key.endsWith('-penalty')
      )
      .map(key => row[key]);
  }

  /**
   * Add position rankings to results
   * @param {Object} dataFrame - Results dataframe
   * @returns {Object} Dataframe with positions
   */
  static addPositionRanks(dataFrame) {
    const ranks = [];
    let rank = 1;
    let previousValue = 0;

    dataFrame.seed_points.values.forEach((value, index) => {
      if (value !== previousValue) {
        rank = index + 1;
      }
      ranks.push(rank);
      previousValue = value;
    });

    return dataFrame.addColumn('position', ranks);
  }
}