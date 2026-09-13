import { calculateCPP, applyCPPToSeedList } from '../src/index.js';

// Seed list rows: position, meeting seed points, AASL points (null = none)
const row = (racer_id, position, seed_points, aasl_points) => ({
  racer_id,
  first_name: racer_id,
  last_name: 'R',
  position,
  seed_points,
  aasl_points,
});

describe('calculateCPP', () => {
  it('takes T1 from the whole list and T2/T3 from the top ten', async () => {
    const list = [
      row('a', 1, 0, 40),
      row('b', 2, 5, 60),
      row('c', 3, 8, 30), // lowest AASL of all, finished 3rd
      row('d', 4, 12, 90),
      row('e', 5, 15, 70),
      row('f', 6, 20, null), // no AASL entry: ignored
      row('g', 12, 40, 10), // lowest AASL of all but outside the top ten
      row('h', 15, 50, 20), // second lowest, also outside the top ten
    ];
    const result = await calculateCPP('C', list);
    expect(result.success).toBe(true);
    // T1: five lowest AASL anywhere: g 10, h 20, c 30, a 40, b 60
    expect(result.referenceSkiers.map((s) => s.racer_id)).toEqual([
      'g',
      'h',
      'c',
      'a',
      'b',
    ]);
    expect(result.t1).toBe(160);
    // T2: five lowest AASL among the top ten: c 30, a 40, b 60, e 70, d 90
    expect(result.qualifyingSkiers.map((s) => s.racer_id)).toEqual([
      'c',
      'a',
      'b',
      'e',
      'd',
    ]);
    expect(result.t2).toBe(290);
    // T3: their meeting seed points: 8 + 0 + 5 + 15 + 12
    expect(result.t3).toBe(40);
    expect(result.divisor).toBe(10);
    expect(result.cpp).toBe((160 + 290 - 40) / 10);
  });

  it('uses the same number of skiers for T1 and T2, and twice that as divisor, when fewer than five qualify', async () => {
    const list = [
      row('a', 1, 0, 40),
      row('b', 2, 5, 60),
      row('c', 3, 8, 30),
      row('g', 12, 40, 10),
    ];
    const result = await calculateCPP('C', list);
    expect(result.skiersUsed).toBe(3);
    expect(result.referenceSkiers.map((s) => s.racer_id)).toEqual([
      'g',
      'c',
      'a',
    ]);
    expect(result.t1).toBe(80);
    expect(result.t2).toBe(130);
    expect(result.t3).toBe(13);
    expect(result.divisor).toBe(6);
  });

  it('refuses with fewer than three qualifying skiers', async () => {
    const result = await calculateCPP('C', [
      row('a', 1, 0, 40),
      row('b', 2, 5, 60),
      row('g', 12, 40, 10),
    ]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/found 2, need at least 3/);
  });

  it('adds the CPP to every entry, negative included', () => {
    const adjusted = applyCPPToSeedList(
      [row('a', 1, 10, 40), row('b', 2, 20, null)],
      -2.5,
    );
    expect(adjusted.map((e) => e.final_seed_points)).toEqual([7.5, 17.5]);
    expect(adjusted[0].original_seed_points).toBe(10);
  });
});
