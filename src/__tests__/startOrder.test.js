import {
  buildStartOrder,
  flipTop,
  orderByTrainingGroup,
  hasNoSeedPoints,
} from '../renderer/utils/startOrder';

// Deterministic stand-ins for the shuffle: identity and reverse
const identity = (rows) => [...rows];
const reverse = (rows) => [...rows].reverse();

const seeded = (id, gender = 'M', extra = {}) => ({
  racer_id: id,
  gender,
  arrival_corps_seed: 100,
  ...extra,
});
const unseeded = (id, training_group, gender = 'M') => ({
  racer_id: id,
  gender,
  arrival_corps_seed: null,
  arrival_army_seed: null,
  aasl_points: null,
  training_group,
});
const ids = (rows) => rows.map((r) => r.racer_id);

describe('hasNoSeedPoints', () => {
  it('is true only when there are no points anywhere', () => {
    expect(hasNoSeedPoints(unseeded('a', 1))).toBe(true);
    expect(
      hasNoSeedPoints({ ...unseeded('a', 1), arrival_army_seed: 300 }),
    ).toBe(false);
    expect(hasNoSeedPoints({ ...unseeded('a', 1), aasl_points: 250 })).toBe(
      false,
    );
    expect(hasNoSeedPoints(seeded('a'))).toBe(false);
  });
});

describe('flipTop', () => {
  it('shuffles only the top N and keeps the rest in seed order', () => {
    const rows = ['1', '2', '3', '4', '5'].map((id) => seeded(id));
    expect(ids(flipTop(rows, 3, reverse))).toEqual(['3', '2', '1', '4', '5']);
  });

  it('shuffles everyone when there are fewer than N', () => {
    const rows = ['1', '2'].map((id) => seeded(id));
    expect(ids(flipTop(rows, 3, reverse))).toEqual(['2', '1']);
  });
});

describe('orderByTrainingGroup', () => {
  it('bands by group ascending, no group last, shuffled within each band', () => {
    const rows = [
      unseeded('c', 2),
      unseeded('a', 1),
      unseeded('n', null),
      unseeded('b', 1),
      unseeded('d', 2),
    ];
    expect(ids(orderByTrainingGroup(rows, reverse))).toEqual([
      'b',
      'a',
      'd',
      'c',
      'n',
    ]);
  });
});

describe('buildStartOrder', () => {
  const details = {
    women_separate: false,
    randomise_top: 2,
    randomise_top_women: 1,
  };

  it('puts unseeded competitors behind everyone seeded in the seeding race, by group', () => {
    const list = [
      seeded('s1'),
      unseeded('u2', 2),
      seeded('s2'),
      unseeded('u1', 1),
      seeded('s3'),
      unseeded('u0', null),
    ];
    expect(
      ids(buildStartOrder(list, { ...details, is_seeding: 1 }, identity)),
    ).toEqual(['s1', 's2', 's3', 'u1', 'u2', 'u0']);
  });

  it('ignores training groups outside the seeding race', () => {
    const list = [seeded('s1'), unseeded('u1', 1), seeded('s2')];
    expect(
      ids(buildStartOrder(list, { ...details, is_seeding: 0 }, identity)),
    ).toEqual(['s1', 'u1', 's2']);
  });

  it('keeps women first with their own flip count when women start separately', () => {
    const list = [
      seeded('m1'),
      seeded('w1', 'F'),
      seeded('m2'),
      unseeded('wu', 1, 'F'),
      seeded('w2', 'F'),
      unseeded('mu', 1),
    ];
    const order = buildStartOrder(
      list,
      { ...details, women_separate: true, is_seeding: 1 },
      reverse,
    );
    // women: flip top 1 of [w1, w2] -> w1, w2; then unseeded wu; men: flip top 2 of [m1, m2] -> m2, m1; then mu
    expect(ids(order)).toEqual(['w1', 'w2', 'wu', 'm2', 'm1', 'mu']);
  });
});
