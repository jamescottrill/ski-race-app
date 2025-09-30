import { v4 as uuid4 } from 'uuid';

const calculateAgeCategory = (birthYear) => {
  const currentYear = new Date().getFullYear();
  const age = currentYear - parseInt(birthYear);

  return {
    isJunior: age < 20,
    isSenior: age >= 20 && age < 35,
    isVeteran: age >= 35,
  };
};

const competitorExists = async (serviceNumber, firstName, LastName) => {
  const query = `SELECT COUNT(*) AS count FROM people WHERE service_number = ? AND first_name = ? AND last_name = ? `;
  const params = [serviceNumber, firstName, LastName];
  try {
    const result = await window.api.select(query, params);
    return result[0].count > 0;
  } catch (error) {
    console.error('Failed to check if competitor exists:', error);
  }
  return false;
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
    await window.api.insert(query1, params1);
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
          is_senior, is_veteran, is_reserve, is_female, title, arrival_corps_seed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              title        = ?
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
        competitionId,
        competitorId,
        formData.title,
      ];
    }
    await window.api.insert(query2, params2);
    if (formData.teamId) {
      const params3 = [competitionId, formData.teamId, competitorId];
      const query3 = `INSERT INTO main.competition_team_members (competition_id, team_id, racer_id)
                      VALUES (?, ?, ?)`;
      await window.api.insert(query3, params3);
    }
    return true;
  } catch (error) {
    console.error('Failed to update competitor:', error);
  }
};

const createCompetitor = async (formData, competitionId) => {
  let { isJunior, isVeteran } = false;
  let isSenior = true;
  if (formData.birthYear) {
    ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(formData.birthYear));
  }
  const id = uuid4();
  const query1 = `
      INSERT INTO people (id, first_name, last_name, title, birth_year, country, service_number, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
  const params1 = [
    id,
    formData.firstName,
    formData.lastName,
    formData.title,
    formData.birthYear,
    formData.country,
    formData.serviceNumber,
    formData.gender,
  ];

  try {
    await window.api.insert(query1, params1);

    const query2 = `
        INSERT INTO competition_competitor
        (competition_id, racer_id, is_novice, is_junior,
         is_senior, is_veteran, is_reserve, is_female, title)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ];

    await window.api.insert(query2, params2);
    return true;
  } catch (error) {
    console.error('Failed to create competitor:', error);
  }
  return false;
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
};
