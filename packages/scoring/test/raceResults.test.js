import {
  runStatus,
  runDisplay,
  mapIndividualResult,
  mapSeedResult,
  partitionResults,
  finishedAnyRun,
  categoryPodiums,
  buildTeamResults,
} from '../src/index.js';

const base = {
  racer_id: 'A',
  race_id: 'R',
  first_name: 'Ann',
  last_name: 'Able',
  title: 'Capt',
  team: '1 RHA',
  bib_number: 7,
  position: 1,
  seed_points: 12.34,
  gender: 'F',
  is_junior: 0,
  is_novice: 1,
  is_veteran: 0,
};

describe('mapIndividualResult', () => {
  it('maps a finished one-run row', () => {
    const row = mapIndividualResult({ ...base, run_1_time: 65.5 }, 1);
    expect(row).toMatchObject({
      id: 'A/results',
      lastName: 'Able',
      bibNumber: 7,
      run1TimeSecs: 65.5,
      run1Time: '01:05.50',
      run1Dnf: false,
      completed: true,
    });
    expect(row.runStatus).toEqual({ 1: null });
    expect(row.runCompleted).toEqual({ 1: true });
  });

  it('flags a non-finish and normalises 0/1 flags to booleans', () => {
    const row = mapIndividualResult(
      { ...base, run_1_time: null, run_1_dnf: 1 },
      1,
    );
    expect(row.run1Dnf).toBe(true);
    expect(row.run1Time).toBe('');
    expect(row.completed).toBe(false);
    expect(row.runStatus).toEqual({ 1: 'DNF' });
  });

  it('only reports a total once both runs are in', () => {
    const oneRunOnly = mapIndividualResult(
      { ...base, run_1_time: 60, run_2_time: null },
      2,
    );
    expect(oneRunOnly.totalTime).toBe('');
    expect(oneRunOnly.totalTimeSecs).toBeNull();
    expect(oneRunOnly.completed).toBe(true);

    const both = mapIndividualResult(
      { ...base, run_1_time: 60, run_2_time: 61.25 },
      2,
    );
    expect(both.totalTimeSecs).toBe(121.25);
    expect(both.totalTime).toBe('02:01.25');
  });
});

describe('runStatus and runDisplay', () => {
  it('treats NS (no start, valid reason) as DNS', () => {
    const row = mapIndividualResult(
      { ...base, run_1_time: null, run_1_ns: 1 },
      1,
    );
    expect(runStatus(row, 1)).toBe('DNS');
  });

  it('prefers the status over the time in a display cell', () => {
    const dsq = mapIndividualResult(
      { ...base, run_1_time: null, run_1_dsq: 1 },
      1,
    );
    const finished = mapIndividualResult({ ...base, run_1_time: 45 }, 1);
    const empty = mapIndividualResult({ ...base, run_1_time: null }, 1);
    expect(runDisplay(dsq, 1)).toBe('DSQ');
    expect(runDisplay(finished, 1)).toBe('00:45.00');
    expect(runDisplay(empty, 1)).toBe('');
  });
});

describe('mapSeedResult', () => {
  it('carries per-run points and shows statuses in the time cells', () => {
    const row = mapSeedResult({
      ...base,
      run_1_time: 50,
      run_2_time: null,
      run_2_dnf: 1,
      seed_1: 10.5,
      seed_2: null,
      overall_seed: 10.5,
    });
    expect(row).toMatchObject({
      points1: 10.5,
      points2: null,
      finalSeed: 10.5,
      run1Time: '00:50.00',
      run2Time: 'DNF',
      totalTime: '',
    });
    expect(finishedAnyRun(row)).toBe(true);
  });
});

describe('partitionResults', () => {
  const rows = [
    mapIndividualResult(
      { ...base, racer_id: 'A', bib_number: 3, position: 2, run_1_time: 62 },
      1,
    ),
    mapIndividualResult(
      { ...base, racer_id: 'B', bib_number: 1, position: 1, run_1_time: 61 },
      1,
    ),
    mapIndividualResult(
      { ...base, racer_id: 'C', bib_number: 9, run_1_time: null, run_1_dnf: 1 },
      1,
    ),
    mapIndividualResult(
      { ...base, racer_id: 'D', bib_number: 4, run_1_time: null, run_1_dnf: 1 },
      1,
    ),
    mapIndividualResult(
      { ...base, racer_id: 'E', bib_number: 2, run_1_time: null, run_1_ns: 1 },
      1,
    ),
    mapIndividualResult(
      { ...base, racer_id: 'F', bib_number: 5, run_1_time: null, run_1_dsq: 1 },
      1,
    ),
  ];

  it('sorts finishers by position and the status lists by bib', () => {
    const partition = partitionResults(rows, { runs: 1 });
    expect(partition.finished.map((r) => r.racerId)).toEqual(['B', 'A']);
    expect(partition.runs[1].dnf.map((r) => r.bibNumber)).toEqual([4, 9]);
    expect(partition.runs[1].dns.map((r) => r.racerId)).toEqual(['E']);
    expect(partition.runs[1].dsq.map((r) => r.racerId)).toEqual(['F']);
  });

  it('accepts a different definition of finished', () => {
    const twoRun = [
      mapIndividualResult(
        {
          ...base,
          racer_id: 'A',
          position: 1,
          run_1_time: 60,
          run_2_time: null,
          run_2_dnf: 1,
        },
        2,
      ),
    ];
    expect(partitionResults(twoRun, { runs: 2 }).finished).toHaveLength(0);
    expect(
      partitionResults(twoRun, { runs: 2, isFinished: finishedAnyRun })
        .finished,
    ).toHaveLength(1);
    expect(partitionResults(twoRun, { runs: 2 }).runs[2].dnf).toHaveLength(1);
  });
});

describe('categoryPodiums', () => {
  it('takes the top three per category in finishing order', () => {
    const finished = [1, 2, 3, 4].map((n) =>
      mapIndividualResult(
        {
          ...base,
          racer_id: `J${n}`,
          position: n,
          run_1_time: 60 + n,
          is_junior: 1,
          gender: n % 2 ? 'F' : 'M',
        },
        1,
      ),
    );
    const podiums = Object.fromEntries(
      categoryPodiums(finished).map((p) => [
        p.key,
        p.rows.map((r) => r.racerId),
      ]),
    );
    expect(podiums.junior).toEqual(['J1', 'J2', 'J3']);
    expect(podiums.female).toEqual(['J1', 'J3']);
    expect(podiums.novice).toEqual(['J1', 'J2', 'J3']);
    expect(podiums.veteran).toEqual([]);
    expect(podiums.open).toEqual(['J1', 'J2', 'J3']);
  });
});

describe('buildTeamResults', () => {
  const racer = (id, teamName, seedPoints, time, extra = {}) =>
    mapIndividualResult(
      {
        ...base,
        racer_id: id,
        team_name: teamName,
        seed_points: seedPoints,
        run_1_time: time,
        ...extra,
      },
      1,
    );

  it('scores each team on its best three by race points and ranks teams', () => {
    const rows = [
      racer('a1', 'Alpha', 30, 70),
      racer('a2', 'Alpha', 10, 60),
      racer('a3', 'Alpha', 20, 65),
      racer('a4', 'Alpha', 5, 55),
      racer('b1', 'Bravo', 1, 50),
      racer('b2', 'Bravo', 2, 51),
      racer('b3', 'Bravo', 3, 52),
    ];
    const { teams, incomplete } = buildTeamResults(rows, {
      timeField: 'run1TimeSecs',
    });
    expect(incomplete).toEqual([]);
    expect(
      teams.map((t) => [t.teamName, t.position, t.points, t.time]),
    ).toEqual([
      ['Bravo', 1, 6, '02:33.00'],
      ['Alpha', 2, 35, '03:00.00'],
    ]);
    expect(teams[1].racers.map((r) => r.racerId)).toEqual(['a4', 'a2', 'a3']);
  });

  it('lists a team with fewer than three finishers as incomplete', () => {
    const rows = [
      racer('c1', 'Charlie', 1, 50),
      racer('c2', 'Charlie', 2, 51),
      racer('c3', 'Charlie', null, null, { run_1_dnf: 1 }),
      racer('n1', null, 1, 50),
    ];
    const { teams, incomplete } = buildTeamResults(rows, {
      timeField: 'run1TimeSecs',
    });
    expect(teams).toEqual([]);
    expect(incomplete).toEqual([{ teamName: 'Charlie' }]);
  });

  it('rounds summed points to two decimals', () => {
    const rows = [
      racer('x1', 'X', 0.1, 1),
      racer('x2', 'X', 0.2, 1),
      racer('x3', 'X', 0.3, 1),
    ];
    expect(
      buildTeamResults(rows, { timeField: 'run1TimeSecs' }).teams[0].points,
    ).toBe(0.6);
  });
});
