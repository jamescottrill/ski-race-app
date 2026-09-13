import {
  calculateAgeCategory,
  calculateCategory,
  resolveAgeCategory,
} from '../src/index.js';

describe('calculateAgeCategory', () => {
  it('classifies by age in the given year', () => {
    expect(calculateAgeCategory('2007', 2026)).toEqual({
      isJunior: true,
      isSenior: false,
      isVeteran: false,
    });
    expect(calculateAgeCategory('2006', 2026)).toEqual({
      isJunior: false,
      isSenior: true,
      isVeteran: false,
    });
    expect(calculateAgeCategory('1992', 2026)).toEqual({
      isJunior: false,
      isSenior: true,
      isVeteran: false,
    });
    expect(calculateAgeCategory('1991', 2026)).toEqual({
      isJunior: false,
      isSenior: false,
      isVeteran: true,
    });
  });
});

describe('resolveAgeCategory', () => {
  it('derives the category from the birth year when present, ignoring stale flags', () => {
    expect(
      resolveAgeCategory({ birthYear: 1990, isJunior: true }, 2026),
    ).toEqual({
      isJunior: false,
      isSenior: false,
      isVeteran: true,
    });
  });

  it('falls back to explicit flags, defaulting to senior', () => {
    expect(resolveAgeCategory({})).toEqual({
      isJunior: false,
      isSenior: true,
      isVeteran: false,
    });
    expect(resolveAgeCategory({ isVeteran: true })).toEqual({
      isJunior: false,
      isSenior: false,
      isVeteran: true,
    });
  });
});

describe('calculateCategory', () => {
  it('builds the category code from gender, age, novice and reserve flags', () => {
    expect(calculateCategory({ gender: 'M' })).toBe('S');
    expect(calculateCategory({ gender: 'F', is_junior: 1 })).toBe('FJ');
    expect(
      calculateCategory({
        gender: 'M',
        is_veteran: 1,
        is_novice: 1,
        is_reserve: 1,
      }),
    ).toBe('VNR');
  });
});
