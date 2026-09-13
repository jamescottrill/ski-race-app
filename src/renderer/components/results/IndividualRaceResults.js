import React, { useMemo } from 'react';
import { useRaceResults } from '../../hooks/useRaceResults';
import {
  raceResultsOneRunQuery,
  raceResultsTwoRunQuery,
} from '../../queries/RaceResults';
import { mapIndividualResult, partitionResults } from '../../utils/raceResults';
import { resultsPdf } from '../../utils/ResultsPdf';
import { resultsTwoPdf } from '../../utils/ResultsTwoPdf';
import { individualResultColumns } from './columns';
import {
  ResultsSection,
  StatusTables,
  CategoryPodiums,
  NoResults,
  PdfButton,
} from './sections';

/** Results for an individual race with one or two runs. */
export default function IndividualRaceResults({ raceId, competitionId, runs }) {
  const query = runs === 2 ? raceResultsTwoRunQuery : raceResultsOneRunQuery;
  const params = runs === 2 ? [raceId, raceId] : [raceId];
  const { rows, raceDetails } = useRaceResults({
    raceId,
    competitionId,
    query,
    params,
  });

  const partition = useMemo(
    () =>
      partitionResults(
        rows.map((row) => mapIndividualResult(row, runs)),
        { runs },
      ),
    [rows, runs],
  );
  const columns = useMemo(() => individualResultColumns(runs), [runs]);

  const generatePdf = () => {
    const { finished } = partition;
    const run1 = partition.runs[1];
    if (runs === 2) {
      const run2 = partition.runs[2];
      resultsTwoPdf(
        raceDetails,
        finished,
        run1.dns,
        run1.dnf,
        run1.dsq,
        run2.dns,
        run2.dnf,
        run2.dsq,
      );
    } else {
      resultsPdf(raceDetails, finished, run1.dns, run1.dnf, run1.dsq);
    }
  };

  return (
    <div className="space-y-6">
      {partition.finished.length > 0 ? (
        <ResultsSection columns={columns} rows={partition.finished} paginate />
      ) : (
        <NoResults />
      )}
      <StatusTables partition={partition} />
      <CategoryPodiums finished={partition.finished} />
      <PdfButton onClick={generatePdf} disabled={!raceDetails} />
    </div>
  );
}
