/**
 * Normalises bound parameters before they reach better-sqlite3, which binds
 * numbers, strings, bigints, buffers and null but throws a TypeError on
 * booleans. The renderer builds parameters from checkbox state and CSV
 * flags, so booleans are common; SQLite stores them as 0/1 in any case.
 */
function normaliseParams(params) {
  if (!Array.isArray(params)) return params;
  return params.map((value) => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

module.exports = { normaliseParams };
