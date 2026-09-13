/**
 * Named write operations executed atomically in the main process
 * (src/main/operations). Pages call these instead of sending SQL, so every
 * write has one definition, one validation point and, for results, an
 * event-log entry for the future live-results sync.
 */
const run = (name, payload) => window.api.operation(name, payload);

export const saveResultFields = ({
  competitionId,
  raceId,
  runNumber,
  racerId,
  fields,
}) =>
  run('results.saveFields', {
    competitionId,
    raceId,
    runNumber,
    racerId,
    fields,
  });

export const saveRunDetails = ({ competitionId, raceId, runNumber, details }) =>
  run('results.saveRunDetails', { competitionId, raceId, runNumber, details });

export const setRunComplete = ({
  competitionId,
  raceId,
  runNumber,
  isComplete,
}) =>
  run('results.setRunComplete', {
    competitionId,
    raceId,
    runNumber,
    isComplete,
  });

export const importResults = ({ competitionId, raceId, results }) =>
  run('results.importBatch', { competitionId, raceId, results });

export const regenerateStartList = ({ competitionId, raceId, entries }) =>
  run('startList.regenerate', { competitionId, raceId, entries });

export const saveBibOrder = ({ competitionId, raceId, bibs }) =>
  run('startList.saveBibOrder', { competitionId, raceId, bibs });

export const mergePeople = ({ sourceId, targetId }) =>
  run('people.merge', { sourceId, targetId });
