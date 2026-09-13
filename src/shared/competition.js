/**
 * Competition vocabulary shared by the main process and the renderer.
 *
 * A competition sits at one level of the championship ladder (AWSA Alpine
 * Rules, Annex B): corps meetings feed the qualifying championships, which
 * feed the Army Championships. The season runs from 1 July to 30 June and is
 * labelled by its two calendar years, e.g. '2025-26'.
 */
const COMPETITION_LEVELS = ['corps', 'qualifying', 'army', 'other'];

const COMPETITION_LEVEL_LABELS = {
  corps: 'Corps meeting',
  qualifying: 'Qualifying Championship',
  army: 'Army Championships',
  other: 'Other meeting',
};

const SEASON_PATTERN = /^\d{4}-\d{2}$/;

/** The season label ('YYYY-YY') a date falls in; seasons start on 1 July. */
function seasonForDate(date = new Date()) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 6 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** True for a well-formed season label whose two years are consecutive. */
function isValidSeason(season) {
  if (typeof season !== 'string' || !SEASON_PATTERN.test(season)) {
    return false;
  }
  const startYear = Number(season.slice(0, 4));
  return Number(season.slice(5)) === (startYear + 1) % 100;
}

module.exports = {
  COMPETITION_LEVELS,
  COMPETITION_LEVEL_LABELS,
  seasonForDate,
  isValidSeason,
};
