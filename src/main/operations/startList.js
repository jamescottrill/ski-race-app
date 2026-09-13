const { requireFields, requireList } = require('./validate');
const { emitEntity } = require('./events');

const publishStartList = (tx, competitionId, raceId, operation) =>
  emitEntity(tx, {
    competitionId,
    entityType: 'start_list',
    key: { race_id: raceId },
    operation,
  });

/**
 * Replace a race's start list.
 * payload: { competitionId, raceId, entries: [{ racerId, bibNumber, seedPoints }] }
 */
function regenerate(tx, payload) {
  const name = 'startList.regenerate';
  requireFields(name, payload, ['competitionId', 'raceId']);
  const entries = requireList(name, payload, 'entries');
  const { competitionId, raceId } = payload;

  tx.run(
    `DELETE FROM race_competitor WHERE competition_id = ? AND race_id = ?`,
    [competitionId, raceId],
  );
  entries.forEach(({ racerId, bibNumber, seedPoints }) => {
    if (!racerId || !bibNumber)
      throw new Error(`${name}: each entry needs racerId and bibNumber`);
    tx.run(
      `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number, seed_points) VALUES (?, ?, ?, ?, ?)`,
      [competitionId, raceId, racerId, bibNumber, seedPoints ?? 0],
    );
  });
  publishStartList(tx, competitionId, raceId, name);
  return { success: true, entries: entries.length };
}

/**
 * Renumber bibs on an existing start list. Every bib must be a positive
 * whole number and no two competitors may share one.
 * payload: { competitionId, raceId, bibs: [{ racerId, bibNumber }] }
 */
function saveBibOrder(tx, payload) {
  const name = 'startList.saveBibOrder';
  requireFields(name, payload, ['competitionId', 'raceId']);
  const bibs = requireList(name, payload, 'bibs');
  const { competitionId, raceId } = payload;

  const seen = new Map();
  bibs.forEach(({ racerId, bibNumber }) => {
    if (!racerId) throw new Error(`${name}: each entry needs a racerId`);
    if (!Number.isInteger(bibNumber) || bibNumber < 1) {
      throw new Error(
        `${name}: bib "${bibNumber}" for ${racerId} is not a positive whole number`,
      );
    }
    if (seen.has(bibNumber)) {
      throw new Error(
        `${name}: bib ${bibNumber} is assigned to both ${seen.get(bibNumber)} and ${racerId}`,
      );
    }
    seen.set(bibNumber, racerId);
  });

  let updated = 0;
  bibs.forEach(({ racerId, bibNumber }) => {
    updated += tx.run(
      `UPDATE race_competitor SET bib_number = ? WHERE competition_id = ? AND race_id = ? AND racer_id = ?`,
      [bibNumber, competitionId, raceId, racerId],
    ).changes;
  });
  publishStartList(tx, competitionId, raceId, name);
  return { success: true, updated };
}

module.exports = { regenerate, saveBibOrder };
