/**
 * Discipline factors and the race-points formula (AWSA Alpine Rules B14, B15).
 * The app's SQL queries carry the same formula in racePointsExpression; this
 * is the JavaScript mirror used where rows are scored outside the database.
 */
import { round } from './math.js';

// Discipline factors that turn a time gap on the winner into race points
export const RACE_FACTORS = [
  { race: 'SL', factor: 730 },
  { race: 'GS', factor: 1010 },
  { race: 'SG', factor: 1190 },
  { race: 'DH', factor: 1250 },
  { race: 'AC', factor: 1360 },
];

/** The factor for a race type ('SL', 'GS', ...), or null when unknown. */
export const factorFor = (raceType) =>
  RACE_FACTORS.find(({ race }) => race === raceType)?.factor ?? null;

const isPositiveNumber = (value) => Number.isFinite(value) && value > 0;

/**
 * Race points for a time relative to the winning time, to two decimals:
 * (time - best) / best * factor. Null when any input is unusable.
 */
export const racePoints = (time, best, factor) => {
  if (
    !isPositiveNumber(time) ||
    !isPositiveNumber(best) ||
    !Number.isFinite(factor)
  ) {
    return null;
  }
  return round(((time - best) / best) * factor);
};
