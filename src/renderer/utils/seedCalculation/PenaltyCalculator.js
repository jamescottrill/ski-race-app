/**
 * Handles penalty point calculations for competitors who didn't finish races
 */
export class PenaltyCalculator {
  /**
   * Calculate penalty points for a competitor who didn't finish
   * @param {number} seedPoints - Base seed points
   * @param {boolean} isNonStarter - Whether competitor didn't start
   * @returns {number} Calculated penalty points
   */
  static calculatePenalty(seedPoints, isNonStarter = false) {
    if (isNonStarter) {
      return seedPoints; // No penalty for non-starters
    }

    const penaltyAdd = 10;
    const penaltyMultiply = 1.2;

    if (seedPoints < 50) {
      return seedPoints + penaltyAdd;
    } else {
      return seedPoints * penaltyMultiply;
    }
  }

  /**
   * Get seed points for a competitor based on their ranking
   * @param {Array} finishedResults - Array of finished competitors
   * @param {number} competitorRanking - Competitor's ranking
   * @returns {number} Seed points
   */
  static getSeedPointsForRanking(finishedResults, competitorRanking) {
    if (finishedResults[competitorRanking]) {
      return finishedResults[competitorRanking].seed_points;
    } else {
      // If ranking is beyond finished competitors, use last finisher's points
      return finishedResults[finishedResults.length - 1].seed_points;
    }
  }

  /**
   * Apply penalty to a competitor's row
   * @param {Object} row - Competitor data row
   * @param {string} raceId - Race identifier
   * @param {number} penaltyPoints - Points to apply
   */
  static applyPenaltyToRow(row, raceId, penaltyPoints) {
    row[raceId] = Math.round(penaltyPoints);
    row[`${raceId}-penalty`] = true;
    return row;
  }
}