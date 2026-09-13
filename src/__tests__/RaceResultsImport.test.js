import {
  parseTime,
  buildImportRows,
  buildImportPayload,
} from '../renderer/utils/RaceResultsImport';

describe('parseTime', () => {
  it('returns null for an empty cell', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('   ')).toBeNull();
    expect(parseTime(null)).toBeNull();
    expect(parseTime(undefined)).toBeNull();
  });

  it('parses seconds', () => {
    expect(parseTime('83.45')).toEqual({ status: null, time: 83.45 });
    expect(parseTime(83.4)).toEqual({ status: null, time: 83.4 });
  });

  it('parses minutes and seconds', () => {
    expect(parseTime('1:23.45')).toEqual({ status: null, time: 83.45 });
    expect(parseTime('01:05')).toEqual({ status: null, time: 65 });
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parseTime('1:23,45')).toEqual({ status: null, time: 83.45 });
  });

  it('recognises status codes regardless of case and padding', () => {
    expect(parseTime('dnf')).toEqual({ status: 'DNF', time: null });
    expect(parseTime(' DSQ ')).toEqual({ status: 'DSQ', time: null });
    expect(parseTime('ns')).toEqual({ status: 'NS', time: null });
  });

  it('reports values it cannot interpret instead of guessing', () => {
    expect(parseTime('1:23:45').error).toMatch(/not a time/);
    expect(parseTime('abc').error).toMatch(/not a time/);
    expect(parseTime('ab:12').error).toMatch(/not a time/);
    expect(parseTime('-5').error).toMatch(/not a time/);
    expect(parseTime('0').error).toMatch(/positive/);
  });
});

describe('buildImportRows', () => {
  const competitors = [
    {
      competitor_id: 'A1',
      first_name: 'Ann',
      last_name: 'Able',
      bib_number: 1,
    },
    {
      competitor_id: 'B2',
      first_name: 'Bob',
      last_name: 'Baker',
      bib_number: '2',
    },
  ];
  const columnMapping = {
    bib: 'Bib',
    time: 'Time',
    time1: 'Run1',
    time2: 'Run2',
    status: 'Status',
  };
  const single = (csvData, selectedRun = '1') =>
    buildImportRows({
      csvData,
      columnMapping,
      importMode: 'single',
      selectedRun,
      competitors,
    });
  const both = (csvData) =>
    buildImportRows({
      csvData,
      columnMapping,
      importMode: 'both',
      selectedRun: '1',
      competitors,
    });

  it('matches bibs to competitors, tolerating string bib numbers', () => {
    const [row] = single([{ Bib: '2', Time: '80.00' }]);
    expect(row.importable).toBe(true);
    expect(row.competitorName).toBe('Baker, Bob');
    expect(row.runs).toEqual({ 1: { time: 80, status: null } });
  });

  it('numbers rows from 2 so they match the spreadsheet (row 1 is the header)', () => {
    expect(single([{ Bib: '1', Time: '80' }])[0].rowNumber).toBe(2);
  });

  it('flags unknown and malformed bibs', () => {
    const rows = single([
      { Bib: '9', Time: '80' },
      { Bib: 'x', Time: '80' },
    ]);
    expect(rows[0].importable).toBe(false);
    expect(rows[0].problems).toEqual(['No competitor with bib 9 in this race']);
    expect(rows[1].problems).toEqual(['Bib "x" is not a number']);
  });

  it('flags a bib that appears twice in the file', () => {
    const rows = single([
      { Bib: '1', Time: '80' },
      { Bib: '1', Time: '81' },
    ]);
    expect(rows[0].importable).toBe(true);
    expect(rows[1].problems).toEqual(['Bib 1 already appears on row 2']);
  });

  it('writes to the selected run in single mode', () => {
    const [row] = single([{ Bib: '1', Time: '80' }], '2');
    expect(row.runs).toEqual({ 2: { time: 80, status: null } });
  });

  it('reads both run columns in both mode', () => {
    const [row] = both([{ Bib: '1', Run1: '80', Run2: 'DNF' }]);
    expect(row.runs).toEqual({
      1: { time: 80, status: null },
      2: { time: null, status: 'DNF' },
    });
  });

  it('lets a status column override the time, and clears the time', () => {
    const [row] = single([{ Bib: '1', Time: '45.10', Status: 'dsq' }]);
    expect(row.runs).toEqual({ 1: { time: null, status: 'DSQ' } });
  });

  it('flags an unrecognised status or time rather than skipping silently', () => {
    const rows = single([
      { Bib: '1', Time: '80', Status: 'LATE' },
      { Bib: '2', Time: '1:2:3' },
    ]);
    expect(rows[0].importable).toBe(false);
    expect(rows[0].problems[0]).toMatch(/Status "LATE"/);
    expect(rows[1].problems[0]).toMatch(/^Run 1: /);
  });

  it('flags rows with nothing to import', () => {
    const [row] = single([{ Bib: '1', Time: '' }]);
    expect(row.importable).toBe(false);
    expect(row.problems).toEqual(['No time or status to import']);
  });
});

describe('buildImportPayload', () => {
  it('flattens rows into one entry per competitor and run', () => {
    const rows = [
      {
        competitor: { competitor_id: 'A1' },
        runs: {
          1: { time: 80, status: null },
          2: { time: null, status: 'DNF' },
        },
      },
      {
        competitor: { competitor_id: 'B2' },
        runs: { 1: { time: 81.5, status: null } },
      },
    ];
    expect(buildImportPayload(rows)).toEqual([
      { racerId: 'A1', runNumber: 1, time: 80, status: null },
      { racerId: 'A1', runNumber: 2, time: null, status: 'DNF' },
      { racerId: 'B2', runNumber: 1, time: 81.5, status: null },
    ]);
  });
});
