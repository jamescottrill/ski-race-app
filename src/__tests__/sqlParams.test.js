const { normaliseParams } = require('../main/utils/sqlParams');

describe('normaliseParams', () => {
  it('converts booleans to integers and leaves every other value alone', () => {
    expect(normaliseParams([true, false, 1, 'x', null, undefined, 2.5])).toEqual([
      1,
      0,
      1,
      'x',
      null,
      undefined,
      2.5,
    ]);
  });

  it('passes non-array values through untouched', () => {
    expect(normaliseParams(undefined)).toBeUndefined();
  });
});
