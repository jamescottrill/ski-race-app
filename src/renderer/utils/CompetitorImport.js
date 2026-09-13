/**
 * Pure helpers for the competitor CSV importer: mapping a parsed CSV row to
 * the competitor shape CompetitorManagement expects, and validating a whole
 * file before anything is written.
 */

// First non-empty value among the accepted spellings of a column, trimmed
const pick = (row, ...columns) => {
  for (const column of columns) {
    const value = row[column];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const isYes = (value) =>
  ['Y', 'YES', 'TRUE', '1'].includes(String(value).trim().toUpperCase());

export function mapCsvRowToCompetitor(row) {
  const gender = pick(row, 'gender', 'Gender').toUpperCase();
  return {
    firstName: pick(row, 'firstName', 'First Name'),
    lastName: pick(row, 'lastName', 'Last Name'),
    title: pick(row, 'title', 'Title'),
    birthYear: pick(row, 'birthYear', 'Birth Year', 'yearOfBirth'),
    country: pick(row, 'country', 'Country') || 'GBR',
    serviceNumber: pick(row, 'serviceNumber', 'Service Number'),
    gender,
    regiment: pick(row, 'regiment', 'Regiment', 'unit', 'Unit'),
    arrivalSeed: pick(row, 'arrivalSeed', 'Arrival Seed'),
    trainingGroup: pick(
      row,
      'trainingGroup',
      'Training Group',
      'group',
      'Group',
    ),
    isNovice: isYes(pick(row, 'novice', 'Novice')),
    isReserve: isYes(pick(row, 'reserve', 'Reserve')),
    isFemale: gender === 'F',
  };
}

/**
 * Validate every CSV row up front. Returns one entry per row with the mapped
 * competitor, the spreadsheet row number, the problems found, and whether
 * the row can be imported.
 */
export function validateCompetitorRows(csvRows) {
  const firstRowForServiceNumber = new Map();

  return csvRows.map((row, index) => {
    const rowNumber = index + 2; // 1-based, after the header line
    const competitor = mapCsvRowToCompetitor(row);
    const problems = [];

    if (!competitor.firstName || !competitor.lastName) {
      problems.push('Missing first or last name');
    }
    if (!competitor.serviceNumber) {
      problems.push('Missing service number');
    }
    if (!['M', 'F'].includes(competitor.gender)) {
      problems.push(
        competitor.gender
          ? `Gender "${competitor.gender}" must be M or F`
          : 'Missing gender (M or F)',
      );
    }
    if (competitor.birthYear && !/^\d{4}$/.test(competitor.birthYear)) {
      problems.push(`Birth year "${competitor.birthYear}" must be four digits`);
    }
    if (
      competitor.arrivalSeed &&
      !/^\d+(\.\d+)?$/.test(competitor.arrivalSeed)
    ) {
      problems.push(`Arrival seed "${competitor.arrivalSeed}" is not a number`);
    }
    if (competitor.trainingGroup && !/^\d+$/.test(competitor.trainingGroup)) {
      problems.push(
        `Training group "${competitor.trainingGroup}" must be a whole number`,
      );
    }
    if (competitor.serviceNumber) {
      if (firstRowForServiceNumber.has(competitor.serviceNumber)) {
        problems.push(
          `Service number already used on row ${firstRowForServiceNumber.get(competitor.serviceNumber)}`,
        );
      } else {
        firstRowForServiceNumber.set(competitor.serviceNumber, rowNumber);
      }
    }

    return {
      rowNumber,
      competitor: {
        ...competitor,
        birthYear: competitor.birthYear ? Number(competitor.birthYear) : null,
        // No arrival seed means unseeded; the seeding race start list orders
        // such competitors by training group instead
        arrivalSeed: competitor.arrivalSeed
          ? Number(competitor.arrivalSeed)
          : null,
        trainingGroup: competitor.trainingGroup
          ? Number(competitor.trainingGroup)
          : null,
      },
      problems,
      importable: problems.length === 0,
    };
  });
}
