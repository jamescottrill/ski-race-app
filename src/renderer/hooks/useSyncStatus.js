import { useEffect, useState } from 'react';
import { getSyncStatus, onSyncStatus } from '../api/sync';

/**
 * The sync status pushed by the main process, fetched once on mount and
 * updated on every push. With a competition id, that competition's status
 * (or null); without, the whole map.
 */
export function useSyncStatus(competitionId) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!window.sync) return undefined;
    let active = true;
    getSyncStatus()
      .then((current) => {
        if (active) setStatus(current);
        return current;
      })
      .catch(() => {});
    const unsubscribe = onSyncStatus((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (competitionId) {
    return status && status[competitionId] ? status[competitionId] : null;
  }
  return status;
}

export default useSyncStatus;
