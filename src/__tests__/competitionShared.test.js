import {
  COMPETITION_LEVELS,
  COMPETITION_LEVEL_LABELS,
  seasonForDate,
  isValidSeason,
} from '../shared/competition';

describe('competition levels', () => {
  it('has a label for every level', () => {
    COMPETITION_LEVELS.forEach((level) =>
      expect(COMPETITION_LEVEL_LABELS[level]).toEqual(expect.any(String)),
    );
  });
});

describe('seasonForDate', () => {
  it('starts a new season on 1 July', () => {
    expect(seasonForDate(new Date(2026, 5, 30))).toBe('2025-26');
    expect(seasonForDate(new Date(2026, 6, 1))).toBe('2026-27');
    expect(seasonForDate(new Date(2026, 0, 15))).toBe('2025-26');
  });

  it('pads the second year across a century boundary', () => {
    expect(seasonForDate(new Date(2099, 8, 1))).toBe('2099-00');
  });
});

describe('isValidSeason', () => {
  it('accepts consecutive years in YYYY-YY form and nothing else', () => {
    expect(isValidSeason('2025-26')).toBe(true);
    expect(isValidSeason('2099-00')).toBe(true);
    expect(isValidSeason('2025-27')).toBe(false);
    expect(isValidSeason('2025')).toBe(false);
    expect(isValidSeason('2025/26')).toBe(false);
    expect(isValidSeason(2025)).toBe(false);
    expect(isValidSeason(null)).toBe(false);
  });
});
