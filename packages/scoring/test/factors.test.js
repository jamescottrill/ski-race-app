import { RACE_FACTORS, factorFor, racePoints } from '../src/index.js';

describe('RACE_FACTORS', () => {
  it('holds the five discipline factors from Rule B15', () => {
    expect(RACE_FACTORS).toEqual([
      { race: 'SL', factor: 730 },
      { race: 'GS', factor: 1010 },
      { race: 'SG', factor: 1190 },
      { race: 'DH', factor: 1250 },
      { race: 'AC', factor: 1360 },
    ]);
  });

  it('looks a factor up by race type', () => {
    expect(factorFor('GS')).toBe(1010);
    expect(factorFor('XX')).toBeNull();
  });
});

describe('racePoints', () => {
  it('scores the winner at zero', () => {
    expect(racePoints(61.2, 61.2, 730)).toBe(0);
  });

  it('matches the SQL formula ROUND((time - best) / best * factor, 2)', () => {
    // (65 - 60) / 60 * 1010 = 84.1666... -> 84.17
    expect(racePoints(65, 60, 1010)).toBe(84.17);
    expect(racePoints(62.34, 61.2, 730)).toBe(13.6);
  });

  it('returns null for a missing time, a missing winner or an unknown factor', () => {
    expect(racePoints(null, 60, 1010)).toBeNull();
    expect(racePoints(65, 0, 1010)).toBeNull();
    expect(racePoints(65, 60, null)).toBeNull();
  });
});
