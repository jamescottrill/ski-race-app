import React, { useMemo } from 'react';
import { useRaceResults } from '../../hooks/useRaceResults';
import { seedResults } from '../../queries/SeedResults';
import {
  mapSeedResult,
  partitionResults,
  finishedAnyRun,
} from '../../utils/raceResults';
import { resultsSeedPdf } from '../../utils/ResultsSeedPdf';
import { seedResultColumns } from './columns';
import { ResultsSection, StatusTables, NoResults, PdfButton } from './sections';

/** Results for the seeding race: two runs scored separately, best kept. */
export default function SeedRaceResults({ raceId, competitionId }) {
  const { rows, raceDetails } = useRaceResults({
    raceId,
    competitionId,
    query: seedResults,
    params: [raceId, raceId],
  });

  // A competitor is placed if they completed either run
  const partition = useMemo(
    () =>
      partitionResults(rows.map(mapSeedResult), {
        runs: 2,
        isFinished: finishedAnyRun,
      }),
    [rows],
  );

  const generatePdf = () => {
    const { finished } = partition;
    const run1 = partition.runs[1];
    const run2 = partition.runs[2];
    resultsSeedPdf(
      raceDetails,
      finished,
      run1.dns,
      run1.dnf,
      run1.dsq,
      run2.dns,
      run2.dnf,
      run2.dsq,
    );
  };

  return (
    <div className="space-y-6">
      {partition.finished.length > 0 ? (
        <ResultsSection
          columns={seedResultColumns}
          rows={partition.finished}
          pageSize={25}
          paginate
        />
      ) : (
        <NoResults />
      )}
      <StatusTables partition={partition} />
      <PdfButton onClick={generatePdf} disabled={!raceDetails} />
    </div>
  );
}
