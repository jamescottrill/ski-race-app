import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../design-system/utils/cn';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { describeSyncStatus } from '../utils/syncPresentation';

const DOT_COLOURS = {
  success: 'bg-success',
  primary: 'bg-primary-500 animate-pulse',
  warning: 'bg-warning',
  danger: 'bg-danger',
  default: 'bg-neutral-400',
};

/**
 * One line in the sidebar showing whether this competition's results are
 * reaching the central service; clicking opens the publishing settings.
 */
function SyncStatusIndicator({ competitionId }) {
  const navigate = useNavigate();
  const status = useSyncStatus(competitionId);
  if (!window.sync) return null;
  const { label, tone } = describeSyncStatus(status);

  return (
    <button
      type="button"
      onClick={() =>
        navigate({
          pathname: `/competition/${competitionId}/settings`,
          search: '?tab=publishing',
        })
      }
      title="Publishing settings"
      className="w-full flex items-center gap-3 px-4 py-2 text-xs text-neutral-600 rounded-md hover:bg-neutral-100 transition-colors"
    >
      <span
        className={cn(
          'inline-block w-2.5 h-2.5 rounded-full flex-shrink-0',
          DOT_COLOURS[tone] || DOT_COLOURS.default,
        )}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default SyncStatusIndicator;
