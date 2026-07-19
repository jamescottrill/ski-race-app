const calculateAgeCategory = (birthYear) => {
  const currentYear = new Date().getFullYear();
  const age = currentYear - parseInt(birthYear);

  return {
    isJunior: age < 20,
    isSenior: age >= 20 && age < 35,
    isVeteran: age >= 35,
  };
};

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
    console.error('Failed to check if competitor exists:', error);
    throw new Error('Database error checking competitor existence');
  }
};

const updateCompetitor = async (
  formData,
  competitorId,
  existingCompetitor,
  competitionId,
) => {
  const query1 = `
      UPDATE people
      SET title = ?,  country = ?
      WHERE id = ?
    `;
  const params1 = [formData.title, formData.country, competitorId];

  try {
    let query2;
    let params2;
    if (!existingCompetitor) {
      let isJunior = false;
      let isVeteran = false;
      let isSenior = true;
      if (formData.birthYear) {
        ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(
          formData.birthYear,
        ));
      }
      query2 = `
        INSERT INTO competition_competitor
        (competition_id, racer_id, is_novice, is_junior,
          is_senior, is_veteran, is_reserve, is_female, title, arrival_corps_seed,
         regiment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
      params2 = [
        competitionId,
        competitorId,
        formData.isNovice,
        isJunior,
        isSenior,
        isVeteran,
        formData.isReserve,
        formData.isFemale,
        formData.title,
        formData.arrivalSeed || 2000,
        formData.regiment,
      ];
    } else {
      query2 = `
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
              regiment     = ?
          WHERE competition_id = ?
            AND racer_id = ?
        `;
      params2 = [
        formData.arrivalSeed || 2000,
        formData.isNovice || false,
        formData.isJunior || false,
        formData.isSenior || false,
        formData.isVeteran || false,
        formData.isReserve || false,
        formData.isFemale || false,
        formData.title,
        formData.regiment,
        competitionId,
        competitorId,
      ];
    }
    // Person, competition entry, and team membership are written as one
    // transaction so a failure can't leave a partially-updated competitor
    const operations = [
      { type: 'update', query: query1, params: params1 },
      { type: 'run', query: query2, params: params2 },
    ];

    if (formData.teamId) {
      operations.push({
        type: 'insert',
        query: `INSERT OR IGNORE INTO competition_team_members (competition_id, team_id, racer_id)
                VALUES (?, ?, ?)`,
        params: [competitionId, formData.teamId, competitorId],
      });
    }

    await window.api.transaction(operations);

    return { success: true };
  } catch (error) {
    console.error('Failed to update competitor:', error);
    return { success: false, error: error.message };
  }
};

const createCompetitor = async (formData, competitionId) => {
  let { isJunior, isVeteran } = false;
  let isSenior = true;
  if (formData.birthYear) {
    ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(formData.birthYear));
  }
  const id = formData.serviceNumber;

  // Check if service number already exists
  const existingPerson = await window.api.select(
    'SELECT id, first_name, last_name FROM people WHERE id = ?',
    [id]
  );
  if (existingPerson.length > 0) {
    const person = existingPerson[0];
    return {
      success: false,
      error: `A person with service number ${id} already exists: ${person.first_name} ${person.last_name}`,
    };
  }

  const query1 = `
      INSERT INTO people (id, first_name, last_name, title, birth_year, country, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
  const params1 = [
    id,
    formData.firstName,
    formData.lastName,
    formData.title,
    formData.birthYear,
    formData.country,
    formData.gender,
  ];

  try {
    const query2 = `
        INSERT INTO competition_competitor
        (competition_id, racer_id, is_novice, is_junior,
         is_senior, is_veteran, is_reserve, is_female, title, regiment, arrival_corps_seed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    const params2 = [
      competitionId,
      id,
      formData.isNovice,
      isJunior,
      isSenior,
      isVeteran,
      formData.isReserve,
      formData.isFemale,
      formData.title,
      formData.regiment,
      formData.arrivalSeed || 2000,
    ];

    // Person and competition entry are created atomically: a failure can't
    // leave a person on record with no competition entry, which previously
    // blocked re-importing them
    await window.api.transaction([
      { type: 'insert', query: query1, params: params1 },
      { type: 'insert', query: query2, params: params2 },
    ]);

    return { success: true, id };
  } catch (error) {
    console.error('Failed to create competitor:', error);
    return { success: false, error: error.message };
  }
};

const calculateCategory = (competitor) => {
  let category = '';
  // Gender prefix
  if (competitor.gender === 'F') {
    category += 'F';
  }

  // Age category
  if (competitor.is_junior) {
    category += 'J';
  } else if (competitor.is_veteran) {
    category += 'V';
  } else {
    category += 'S';
  }

  // Novice status
  if (competitor.is_novice) {
    category += 'N';
  }

  // Reserve status
  if (competitor.is_reserve) {
    category += 'R';
  }
  return category;
};

export {
  updateCompetitor,
  calculateAgeCategory,
  createCompetitor,
  competitorExists,
  calculateCategory,
  personExists
};
