/**
 * Competitor persistence helpers shared by the single-competitor and bulk
 * import paths.
 *
 * The build*Operations functions return statement lists for
 * window.api.transaction, so a caller can compose many competitors into one
 * atomic write. createCompetitor/updateCompetitor run one competitor's list
 * on its own.
 */

import {
  calculateAgeCategory,
  resolveAgeCategory,
  calculateCategory,
} from '@awsa/scoring';

// SQLite binds integers, not JS booleans
const toFlag = (value) => (value ? 1 : 0);

const competitorExists = async (serviceNumber, competitionId) => {
  const query = `SELECT cc.racer_id AS id FROM competition_competitor cc
          WHERE cc.racer_id = ? AND cc.competition_id = ?`;
  const params = [serviceNumber, competitionId];
  try {
    const result = await window.api.select(query, params);
    if (result.length > 0) return [true, result[0].id];
    return [false, null];
  } catch (error) {
    console.error('Failed to check if competitor exists:', error);
    throw new Error('Database error checking competitor existence');
  }
};

const personExists = async (serviceNumber) => {
  const query = `SELECT id FROM people WHERE id = ?`;
  const params = [serviceNumber];
  try {
    const result = await window.api.select(query, params);
    if (result.length > 0) return [true, result[0].id];
    return [false, null];
  } catch (error) {
    console.error('Failed to check if person exists:', error);
    throw new Error('Database error checking person existence');
  }
};

const CHUNK_SIZE = 500;

const chunk = (items) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
};

// Which of the given service numbers already exist as people. Queried in
// chunks to stay well inside SQLite's bound-parameter limit.
const findExistingPeople = async (serviceNumbers) => {
  const results = await Promise.all(
    chunk(serviceNumbers).map((ids) =>
      window.api.select(
        `SELECT id FROM people WHERE id IN (${ids.map(() => '?').join(', ')})`,
        ids,
      ),
    ),
  );
  return new Set(results.flat().map((row) => row.id));
};

// Which of the given service numbers are already entered in the competition
const findExistingCompetitionEntries = async (
  competitionId,
  serviceNumbers,
) => {
  const results = await Promise.all(
    chunk(serviceNumbers).map((ids) =>
      window.api.select(
        `SELECT racer_id FROM competition_competitor
         WHERE competition_id = ? AND racer_id IN (${ids.map(() => '?').join(', ')})`,
        [competitionId, ...ids],
      ),
    ),
  );
  return new Set(results.flat().map((row) => row.racer_id));
};

const personInsert = (formData) => ({
  type: 'insert',
  query: `
      INSERT INTO people (id, first_name, last_name, title, birth_year, country, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  params: [
    formData.serviceNumber,
    formData.firstName,
    formData.lastName,
    formData.title,
    formData.birthYear || null,
    formData.country,
    formData.gender,
  ],
});

// A person's name and identity are shared across competitions, so an update
// only refreshes the details that legitimately change between them
const personUpdate = (formData, competitorId) => ({
  type: 'update',
  query: `
      UPDATE people
      SET title = ?, country = ?
      WHERE id = ?
    `,
  params: [formData.title, formData.country, competitorId],
});

const competitionEntryInsert = (formData, competitorId, competitionId) => {
  const { isJunior, isSenior, isVeteran } = resolveAgeCategory(formData);
  return {
    type: 'insert',
    query: `
        INSERT INTO competition_competitor
        (competition_id, racer_id, is_novice, is_junior,
         is_senior, is_veteran, is_reserve, is_female, title, regiment, arrival_corps_seed,
         training_group)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    params: [
      competitionId,
      competitorId,
      toFlag(formData.isNovice),
      toFlag(isJunior),
      toFlag(isSenior),
      toFlag(isVeteran),
      toFlag(formData.isReserve),
      toFlag(formData.isFemale),
      formData.title,
      formData.regiment,
      formData.arrivalSeed ?? null,
      formData.trainingGroup ?? null,
    ],
  };
};

const competitionEntryUpdate = (formData, competitorId, competitionId) => {
  const { isJunior, isSenior, isVeteran } = resolveAgeCategory(formData);
  return {
    type: 'update',
    query: `
          UPDATE competition_competitor
          SET
              arrival_corps_seed = ?,
              is_novice    = ?,
              is_junior    = ?,
              is_senior    = ?,
              is_veteran   = ?,
              is_reserve   = ?,
              is_female    = ?,
              title        = ?,
              regiment     = ?,
              training_group = ?
          WHERE competition_id = ?
            AND racer_id = ?
        `,
    params: [
      formData.arrivalSeed ?? null,
      toFlag(formData.isNovice),
      toFlag(isJunior),
      toFlag(isSenior),
      toFlag(isVeteran),
      toFlag(formData.isReserve),
      toFlag(formData.isFemale),
      formData.title,
      formData.regiment,
      formData.trainingGroup ?? null,
      competitionId,
      competitorId,
    ],
  };
};

const teamMembershipInsert = (formData, competitorId, competitionId) => ({
  type: 'insert',
  query: `INSERT OR IGNORE INTO competition_team_members (competition_id, team_id, racer_id)
          VALUES (?, ?, ?)`,
  params: [competitionId, formData.teamId, competitorId],
});

// Statements that create a brand-new person and enter them in the competition
const buildCreateCompetitorOperations = (formData, competitionId) => {
  const id = formData.serviceNumber;
  const operations = [
    personInsert(formData),
    competitionEntryInsert(formData, id, competitionId),
  ];
  if (formData.teamId) {
    operations.push(teamMembershipInsert(formData, id, competitionId));
  }
  return operations;
};

// Statements that refresh an existing person and either update their
// competition entry or create it if they are new to this competition
const buildUpdateCompetitorOperations = (
  formData,
  competitorId,
  hasCompetitionEntry,
  competitionId,
) => {
  const operations = [
    personUpdate(formData, competitorId),
    hasCompetitionEntry
      ? competitionEntryUpdate(formData, competitorId, competitionId)
      : competitionEntryInsert(formData, competitorId, competitionId),
  ];
  if (formData.teamId) {
    operations.push(
      teamMembershipInsert(formData, competitorId, competitionId),
    );
  }
  return operations;
};

const updateCompetitor = async (
  formData,
  competitorId,
  existingCompetitor,
  competitionId,
) => {
  try {
    // Person, competition entry, and team membership are written as one
    // transaction so a failure can't leave a partially-updated competitor
    await window.api.transaction(
      buildUpdateCompetitorOperations(
        formData,
        competitorId,
        existingCompetitor,
        competitionId,
      ),
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to update competitor:', error);
    return { success: false, error: error.message };
  }
};

const createCompetitor = async (formData, competitionId) => {
  const id = formData.serviceNumber;

  const existingPerson = await window.api.select(
    'SELECT id, first_name, last_name FROM people WHERE id = ?',
    [id],
  );
  if (existingPerson.length > 0) {
    const person = existingPerson[0];
    return {
      success: false,
      error: `A person with service number ${id} already exists: ${person.first_name} ${person.last_name}`,
    };
  }

  try {
    // Person and competition entry are created atomically: a failure can't
    // leave a person on record with no competition entry, which previously
    // blocked re-importing them
    await window.api.transaction(
      buildCreateCompetitorOperations(formData, competitionId),
    );
    return { success: true, id };
  } catch (error) {
    console.error('Failed to create competitor:', error);
    return { success: false, error: error.message };
  }
};

export {
  updateCompetitor,
  calculateAgeCategory,
  resolveAgeCategory,
  createCompetitor,
  competitorExists,
  calculateCategory,
  personExists,
  buildCreateCompetitorOperations,
  buildUpdateCompetitorOperations,
  findExistingPeople,
  findExistingCompetitionEntries,
};
