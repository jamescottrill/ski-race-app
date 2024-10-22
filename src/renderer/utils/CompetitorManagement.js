import { v4 as uuid4 } from 'uuid';

const calculateAgeCategory = (dob) => {
  const currentYear = new Date().getFullYear();
  const birthYear = new Date(dob).getFullYear();
  const age = currentYear - birthYear;

  return {
    isJunior: age < 20,
    isSenior: age >= 20 && age < 35,
    isVeteran: age >= 35,
  };
};

const competitorExists = async (serviceNumber) => {
  const query = `SELECT COUNT(*) AS count FROM people WHERE service_number = ?`
  const params = [serviceNumber];
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
  const params1 = [
    formData.title,
    formData.country,
    competitorId,
  ];

  try {
    await window.api.insert(query1, params1);
    let query2;
    let params2;
    if (!existingCompetitor) {
      let isJunior = false;
      let isVeteran = false;
      let isSenior = true;
      if (formData.dob) {
        ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(
          formData.dob,
        ));
      }
      query2 = `
        INSERT INTO competition_competitor
        (competition_id, racer_id, team, arrival_seed, is_novice, is_junior,
          is_senior, is_veteran, is_reserve, is_female, title)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
      params2 = [
        competitionId,
        competitorId,
        formData.formData,
        formData.arrivalSeed,
        formData.isNovice,
        isJunior,
        isSenior,
        isVeteran,
        formData.isReserve,
        formData.isFemale,
        formData.title,
      ];
    } else {
      query2 = `
          UPDATE competition_competitor
          SET team         = ?,
              arrival_seed = ?,
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
        formData.formData,
        formData.arrivalSeed,
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
    return true;
  } catch (error) {
    console.error('Failed to update competitor:', error);
  }
};

const createCompetitor = async (formData, competitionId) => {
  let { isJunior, isVeteran } = false;
  let isSenior = true;
  if (formData.dob) {
    ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(formData.dob));
  }
  const id = uuid4();
  const query1 = `
      INSERT INTO people (id, first_name, last_name, title, dob, country, service_number, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
  const params1 = [
    id,
    formData.firstName,
    formData.lastName,
    formData.title,
    formData.dob,
    formData.country,
    formData.serviceNumber,
    formData.gender,
  ];

  try {
    await window.api.insert(query1, params1);

    const query2 = `
        INSERT INTO competition_competitor
        (competition_id, racer_id, team, arrival_seed, is_novice, is_junior,
         is_senior, is_veteran, is_reserve, is_female, title)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    const params2 = [
      competitionId,
      id,
      formData.formData,
      formData.arrivalSeed,
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
};


export {updateCompetitor, calculateAgeCategory, createCompetitor, competitorExists};
