import {
  validateAASLEntries,
  buildAASLOperations,
} from '../renderer/utils/AASLManagement';

describe('validateAASLEntries', () => {
  it('accepts a complete entry and coerces the points to a number', () => {
    const [row] = validateAASLEntries([
      { rowNumber: 2, serviceNumber: ' 123 ', seedPoints: '45.5' },
    ]);
    expect(row.isValid).toBe(true);
    expect(row.serviceNumber).toBe('123');
    expect(row.seedPoints).toBe(45.5);
    expect(row.rowNumber).toBe(2);
  });

  it('rejects non-numeric points instead of importing them as zero', () => {
    const [row] = validateAASLEntries([
      { serviceNumber: '123', seedPoints: 'n/a' },
    ]);
    expect(row.isValid).toBe(false);
    expect(row.problems).toEqual(['Seed points "n/a" is not a number']);
  });

  it('accepts zero points', () => {
    expect(
      validateAASLEntries([{ serviceNumber: '1', seedPoints: 0 }])[0].isValid,
    ).toBe(true);
  });

  it('reports missing fields and duplicate service numbers', () => {
    const rows = validateAASLEntries([
      { serviceNumber: '', seedPoints: '' },
      { serviceNumber: '9', seedPoints: 1 },
      { serviceNumber: '9', seedPoints: 2 },
    ]);
    expect(rows[0].problems).toEqual([
      'Missing service number',
      'Missing seed points',
    ]);
    expect(rows[1].isValid).toBe(true);
    expect(rows[2].problems).toEqual(['Service number already used on row 2']);
  });
});

describe('buildAASLOperations', () => {
  it('builds one upsert per entry keyed on service number and season', () => {
    const ops = buildAASLOperations(
      [
        {
          serviceNumber: '1',
          firstName: 'A',
          lastName: 'B',
          gender: 'M',
          category: 'S',
          seedPoints: 10,
        },
      ],
      '2026',
      'T',
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('insert');
    expect(ops[0].query).toMatch(/ON CONFLICT\(service_number, season\)/);
    expect(ops[0].params).toEqual(['1', 'A', 'B', 'M', 'S', 10, '2026', 'T']);
  });
});
