/**
 * Named database operations.
 *
 * Each operation is a plain function (tx, payload) => result that runs inside
 * one transaction in the main process. The renderer calls it by name over a
 * single IPC channel instead of sending SQL, which gives every write one
 * definition, one place to validate input, and (for results) an event-log
 * entry for the future live-results sync.
 *
 * `tx` exposes run/get/all over either better-sqlite3 (in the app) or
 * node:sqlite (in tests); both share the prepare().run/get/all shape.
 */
const { normaliseParams } = require('../utils/sqlParams');
const results = require('./results');
const startList = require('./startList');
const people = require('./people');

const OPERATIONS = {
  'results.saveFields': results.saveFields,
  'results.saveRunDetails': results.saveRunDetails,
  'results.setRunComplete': results.setRunComplete,
  'results.importBatch': results.importBatch,
  'startList.regenerate': startList.regenerate,
  'startList.saveBibOrder': startList.saveBibOrder,
  'people.merge': people.merge,
};

function createTx(db) {
  return {
    run: (sql, params = []) => db.prepare(sql).run(...normaliseParams(params)),
    get: (sql, params = []) => db.prepare(sql).get(...normaliseParams(params)),
    all: (sql, params = []) => db.prepare(sql).all(...normaliseParams(params)),
  };
}

// better-sqlite3 provides a synchronous transaction wrapper; node:sqlite
// does not, so fall back to explicit BEGIN/COMMIT/ROLLBACK
function runInTransaction(db, fn) {
  if (typeof db.transaction === 'function') {
    return db.transaction(fn)();
  }
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function runOperation(db, name, payload = {}) {
  const operation = OPERATIONS[name];
  if (!operation) {
    throw new Error(`Unknown operation: ${name}`);
  }
  const tx = createTx(db);
  return runInTransaction(db, () => operation(tx, payload || {}));
}

module.exports = { runOperation, createTx, runInTransaction, OPERATIONS };
