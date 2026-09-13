/**
 * Competitor classification: age category from the birth year and the class
 * code (e.g. FJN) shown on start lists and results.
 */

const calculateAgeCategory = (
  birthYear,
  currentYear = new Date().getFullYear(),
) => {
  const age = currentYear - parseInt(birthYear, 10);

  return {
    isJunior: age < 20,
    isSenior: age >= 20 && age < 35,
    isVeteran: age >= 35,
  };
};

// Age category comes from the birth year when we have one; otherwise fall
// back to explicit flags, defaulting to senior. The update path previously
// ignored the birth year and reset every age flag on re-import.
const resolveAgeCategory = (
  formData,
  currentYear = new Date().getFullYear(),
) => {
  if (formData.birthYear) {
    return calculateAgeCategory(formData.birthYear, currentYear);
  }
  const isJunior = Boolean(formData.isJunior);
  const isVeteran = Boolean(formData.isVeteran);
  const isSenior =
    formData.isSenior === undefined
      ? !isJunior && !isVeteran
      : Boolean(formData.isSenior);
  return { isJunior, isSenior, isVeteran };
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

export { calculateAgeCategory, resolveAgeCategory, calculateCategory };
