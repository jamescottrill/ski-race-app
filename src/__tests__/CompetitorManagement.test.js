import {
  calculateAgeCategory,
  calculateCategory,
  resolveAgeCategory,
  buildCreateCompetitorOperations,
  buildUpdateCompetitorOperations,
} from '../renderer/utils/CompetitorManagement';

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

describe('build*CompetitorOperations', () => {
  // Born in 1950: a veteran in any year this test will run
  const veteran = {
    serviceNumber: '123',
    firstName: 'Ann',
    lastName: 'Able',
    title: 'Maj',
    birthYear: 1950,
    country: 'GBR',
    gender: 'F',
    isFemale: true,
    isNovice: false,
    isReserve: true,
    regiment: '1 RHA',
    arrivalSeed: 150,
  };

  it('creates the person and the competition entry as one batch', () => {
    const ops = buildCreateCompetitorOperations(veteran, 'COMP');
    expect(ops).toHaveLength(2);
    expect(ops[0].query).toMatch(/INSERT INTO people/);
    expect(ops[0].params).toEqual([
      '123',
      'Ann',
      'Able',
      'Maj',
      1950,
      'GBR',
      'F',
    ]);
    expect(ops[1].query).toMatch(/INSERT INTO competition_competitor/);
    // competition_id, racer_id, is_novice, is_junior, is_senior, is_veteran,
    // is_reserve, is_female, title, regiment, arrival_corps_seed
    expect(ops[1].params).toEqual([
      'COMP',
      '123',
      0,
      0,
      0,
      1,
      1,
      1,
      'Maj',
      '1 RHA',
      150,
    ]);
  });

  it('binds flags as integers, never as booleans', () => {
    const params = [
      ...buildCreateCompetitorOperations(veteran, 'COMP'),
      ...buildUpdateCompetitorOperations(veteran, '123', true, 'COMP'),
    ].flatMap((op) => op.params);
    params.forEach((param) => expect(typeof param).not.toBe('boolean'));
  });

  it('keeps the age category on update instead of resetting it', () => {
    const ops = buildUpdateCompetitorOperations(veteran, '123', true, 'COMP');
    expect(ops[0].query).toMatch(/UPDATE people/);
    expect(ops[1].query).toMatch(/UPDATE competition_competitor/);
    // arrival_corps_seed, is_novice, is_junior, is_senior, is_veteran,
    // is_reserve, is_female, title, regiment, competition_id, racer_id
    expect(ops[1].params).toEqual([
      150,
      0,
      0,
      0,
      1,
      1,
      1,
      'Maj',
      '1 RHA',
      'COMP',
      '123',
    ]);
  });

  it('inserts a competition entry for a known person new to this competition', () => {
    const ops = buildUpdateCompetitorOperations(veteran, '123', false, 'COMP');
    expect(ops[0].query).toMatch(/UPDATE people/);
    expect(ops[1].query).toMatch(/INSERT INTO competition_competitor/);
  });

  it('adds team membership only when a team is given', () => {
    expect(buildCreateCompetitorOperations(veteran, 'COMP')).toHaveLength(2);
    expect(
      buildCreateCompetitorOperations({ ...veteran, teamId: 'T1' }, 'COMP'),
    ).toHaveLength(3);
  });
});
