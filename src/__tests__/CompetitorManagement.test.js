import {
  buildCreateCompetitorOperations,
  buildUpdateCompetitorOperations,
} from '../renderer/utils/CompetitorManagement';

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
    // is_reserve, is_female, title, regiment, arrival_corps_seed, training_group
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
      null,
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
    // is_reserve, is_female, title, regiment, training_group, competition_id, racer_id
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
      null,
      'COMP',
      '123',
    ]);
  });

  it('inserts a competition entry for a known person new to this competition', () => {
    const ops = buildUpdateCompetitorOperations(veteran, '123', false, 'COMP');
    expect(ops[0].query).toMatch(/UPDATE people/);
    expect(ops[1].query).toMatch(/INSERT INTO competition_competitor/);
  });

  it('stores an absent arrival seed as null rather than a default', () => {
    const ops = buildCreateCompetitorOperations(
      { ...veteran, arrivalSeed: null, trainingGroup: 2 },
      'COMP',
    );
    expect(ops[1].params.slice(-2)).toEqual([null, 2]);
  });

  it('adds team membership only when a team is given', () => {
    expect(buildCreateCompetitorOperations(veteran, 'COMP')).toHaveLength(2);
    expect(
      buildCreateCompetitorOperations({ ...veteran, teamId: 'T1' }, 'COMP'),
    ).toHaveLength(3);
  });
});
