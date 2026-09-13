import {
  mapCsvRowToCompetitor,
  validateCompetitorRows,
} from '../renderer/utils/CompetitorImport';

describe('mapCsvRowToCompetitor', () => {
  it('accepts camelCase headers', () => {
    const competitor = mapCsvRowToCompetitor({
      firstName: 'Ann',
      lastName: 'Able',
      gender: 'f',
      serviceNumber: '123',
      novice: 'Y',
      reserve: 'N',
      title: 'Capt',
      regiment: '1 RHA',
      arrivalSeed: '150',
      birthYear: '1995',
    });
    expect(competitor).toMatchObject({
      firstName: 'Ann',
      lastName: 'Able',
      gender: 'F',
      isFemale: true,
      isNovice: true,
      isReserve: false,
      serviceNumber: '123',
      title: 'Capt',
      regiment: '1 RHA',
      arrivalSeed: '150',
      birthYear: '1995',
      country: 'GBR',
    });
  });

  it('accepts Title Case headers with spaces and trims values', () => {
    const competitor = mapCsvRowToCompetitor({
      'First Name': ' Bob ',
      'Last Name': 'Baker',
      Gender: 'M',
      'Service Number': '456',
      Unit: '7 Para',
      Novice: 'yes',
    });
    expect(competitor).toMatchObject({
      firstName: 'Bob',
      lastName: 'Baker',
      gender: 'M',
      isFemale: false,
      serviceNumber: '456',
      regiment: '7 Para',
      isNovice: true,
    });
  });

  it('does not invent a gender when the column is missing', () => {
    expect(
      mapCsvRowToCompetitor({ firstName: 'A', lastName: 'B' }).gender,
    ).toBe('');
  });
});

describe('validateCompetitorRows', () => {
  const good = {
    firstName: 'Ann',
    lastName: 'Able',
    gender: 'F',
    serviceNumber: '123',
    birthYear: '1995',
    arrivalSeed: '150',
  };

  it('passes a complete row and converts the numeric fields', () => {
    const [row] = validateCompetitorRows([good]);
    expect(row.importable).toBe(true);
    expect(row.rowNumber).toBe(2);
    expect(row.competitor.birthYear).toBe(1995);
    expect(row.competitor.arrivalSeed).toBe(150);
  });

  it('defaults the arrival seed when blank', () => {
    const [row] = validateCompetitorRows([{ ...good, arrivalSeed: '' }]);
    expect(row.competitor.arrivalSeed).toBe(2000);
  });

  it('reports every problem on a row', () => {
    const [row] = validateCompetitorRows([
      { firstName: 'Ann', gender: 'X', birthYear: '95', arrivalSeed: 'abc' },
    ]);
    expect(row.importable).toBe(false);
    expect(row.problems).toEqual([
      'Missing first or last name',
      'Missing service number',
      'Gender "X" must be M or F',
      'Birth year "95" must be four digits',
      'Arrival seed "abc" is not a number',
    ]);
  });

  it('requires a gender instead of silently defaulting to male', () => {
    const [row] = validateCompetitorRows([{ ...good, gender: '' }]);
    expect(row.problems).toEqual(['Missing gender (M or F)']);
  });

  it('flags a service number that appears twice in the file', () => {
    const rows = validateCompetitorRows([good, { ...good, firstName: 'Twin' }]);
    expect(rows[0].importable).toBe(true);
    expect(rows[1].problems).toEqual(['Service number already used on row 2']);
  });
});
