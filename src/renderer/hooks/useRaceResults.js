import { useCallback, useEffect, useState } from 'react';
import { getRaceDetails } from '../utils/RaceDetails';
import { handleDatabaseError } from '../utils/ErrorHandler';

/**
 * Loads a race's details and runs one results query for it. Re-runs only
 * when the race, query or parameters change, never on unrelated re-renders.
 */
export function useRaceResults({ raceId, competitionId, query, params }) {
  const [rows, setRows] = useState([]);
  const [raceDetails, setRaceDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  // Stable identity for the params array so the effect doesn't re-run on
  // every render
  const paramsKey = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [details, results] = await Promise.all([
        getRaceDetails(raceId, competitionId),
        window.api.select(query, JSON.parse(paramsKey)),
      ]);
      setRaceDetails(details);
      setRows(results);
    } catch (error) {
      handleDatabaseError('load race results', error);
    } finally {
      setLoading(false);
    }
  }, [raceId, competitionId, query, paramsKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, raceDetails, loading, reload: load };
}
