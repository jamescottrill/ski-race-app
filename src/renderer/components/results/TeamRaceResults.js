import React, { useMemo } from 'react';
import { mapIndividualResult, buildTeamResults } from '@awsa/scoring';
import { Card, CardContent } from '../../design-system';
import { useRaceResults } from '../../hooks/useRaceResults';
import {
  teamResultsOneRunQuery,
  teamResultsTwoRunQuery,
} from '../../queries/RaceResults';
import { resultsTeamPdf } from '../../utils/ResultsTeamPdf';
import { teamResultColumns } from './columns';
import { ResultsSection, NoResults, PdfButton } from './sections';

/** Team results for a race: each team's best three finishers, summed. */
export default function TeamRaceResults({ raceId, competitionId, runs }) {
  const query = runs === 2 ? teamResultsTwoRunQuery : teamResultsOneRunQuery;
  const params = runs === 2 ? [raceId, raceId] : [raceId];
  const secondsField = runs === 2 ? 'totalTimeSecs' : 'run1TimeSecs';
  const displayField = runs === 2 ? 'totalTime' : 'run1Time';
  const { rows, raceDetails } = useRaceResults({
    raceId,
    competitionId,
    query,
    params,
  });

  const { teams, incomplete } = useMemo(
    () =>
      buildTeamResults(
        rows.map((row) => mapIndividualResult(row, runs)),
        { timeField: secondsField },
      ),
    [rows, runs, secondsField],
  );
  const columns = useMemo(
    () => teamResultColumns(displayField),
    [displayField],
  );

  return (
    <div className="space-y-6">
      {teams.length > 0 ? (
        <ResultsSection columns={columns} rows={teams} paginate />
      ) : (
        <NoResults />
      )}
      {incomplete.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">
              Disqualified Teams
            </h2>
            <div className="space-y-2">
              {incomplete.map(({ teamName }) => (
                <div
                  key={teamName}
                  className="text-center py-2 border-b last:border-b-0"
                >
                  {teamName}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <PdfButton
        onClick={() => resultsTeamPdf(raceDetails, teams, incomplete)}
        disabled={!raceDetails}
      />
    </div>
  );
}
