import { readFileSync } from 'node:fs';

// supabase/tests/005_scoring_fixture.test.sql embeds this fixture so the
// service's SQL scoring is held to the same expectations as the app's query.
const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/race-scoring.json', import.meta.url),
    'utf8',
  ),
);
const pgtap = readFileSync(
  new URL(
    '../../../supabase/tests/005_scoring_fixture.test.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('the golden scoring fixture', () => {
  it('is embedded verbatim in the pgTAP scoring test', () => {
    const start = pgtap.indexOf('$json$') + '$json$'.length;
    const end = pgtap.indexOf('$json$', start);
    expect(JSON.parse(pgtap.slice(start, end))).toEqual(fixture);
  });

  it('expects every finisher to have a position and points', () => {
    fixture.races.forEach((race) => {
      race.expected.forEach((row) => {
        expect(row.points === null).toBe(row.position === null);
      });
    });
  });
});
