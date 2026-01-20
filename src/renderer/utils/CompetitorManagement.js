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
    const result1 = await window.api.insert(query1, params1);
    if (!result1.success) {
      throw new Error('Failed to update person: ' + result1.error);
    }

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
      console.log(params2);
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
    const result2 = await window.api.insert(query2, params2);
    if (!result2.success) {
      throw new Error('Failed to update competitor: ' + result2.error);
    }

    if (formData.teamId) {
      const params3 = [competitionId, formData.teamId, competitorId];
      const query3 = `INSERT INTO main.competition_team_members (competition_id, team_id, racer_id)
                      VALUES (?, ?, ?)`;
      const result3 = await window.api.insert(query3, params3);

      if (!result3.success) {
        console.warn('Failed to add to team:', result3.error);
        // Don't fail the entire operation, just warn
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to update competitor:', error);
    return { success: false, error: error.message };
  }
};

const createCompetitor = async (formData, competitionId) => {
  let isJunior = false;
  let isVeteran = false;
  let isSenior = true;
  if (formData.birthYear) {
    ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(formData.birthYear));
  }
  const id = formData.serviceNumber;

  // Check if service number already exists
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

  const operations = [
    {
      type: 'insert',
      query: `
        INSERT INTO people (id, first_name, last_name, title, birth_year, country, gender)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        id,
        formData.firstName,
        formData.lastName,
        formData.title,
        formData.birthYear,
        formData.country,
        formData.gender,
      ],
    },
    {
      type: 'insert',
      query: `
        INSERT INTO competition_competitor
        (competition_id, racer_id, is_novice, is_junior,
         is_senior, is_veteran, is_reserve, is_female, title, regiment, arrival_corps_seed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        competitionId,
        id,
        formData.isNovice ? 1 : 0,
        isJunior ? 1 : 0,
        isSenior ? 1 : 0,
        isVeteran ? 1 : 0,
        formData.isReserve ? 1 : 0,
        formData.isFemale ? 1 : 0,
        formData.title,
        formData.regiment,
        formData.arrivalSeed || 2000,
      ],
    },
  ];

  try {
    const result = await window.api.transaction(operations);
    if (!result.success) {
      throw new Error('Transaction failed');
    }
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
