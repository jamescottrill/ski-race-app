import { readFileSync } from 'node:fs';

// The pgTAP ingest test embeds the reference batch verbatim; this keeps the
// two copies identical so the server is always tested against the same
// batch the app tests serialise.
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/batch.v1.json', import.meta.url), 'utf8'),
);
const pgtap = readFileSync(
  new URL('../../../supabase/tests/002_ingest.test.sql', import.meta.url),
  'utf8',
);

describe('the pgTAP ingest test', () => {
  it('embeds the reference batch exactly', () => {
    const start = pgtap.indexOf('$json$') + '$json$'.length;
    const end = pgtap.indexOf('$json$', start);
    expect(start).toBeGreaterThan('$json$'.length);
    expect(end).toBeGreaterThan(start);
    const embedded = JSON.parse(pgtap.slice(start, end));
    expect(embedded).toEqual(fixture);
  });
});
