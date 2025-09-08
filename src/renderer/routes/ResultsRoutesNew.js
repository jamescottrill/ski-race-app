import React from 'react';
import { Route } from 'react-router-dom';
import ResultsPageNew from '../pages/results/resultsPageNew';
import IndividualResultsNew from '../pages/results/individualNew';
import TeamResultsNew from '../pages/results/teamNew';
import LayoutNew from '../components/LayoutNew';

function ResultsRoutesNew() {
  return (
    <>
      <Route
        path="/competition/:competitionId/results"
        element={
          <LayoutNew>
            <ResultsPageNew />
          </LayoutNew>
        }
      />
      <Route
        path="/competition/:competitionId/results/team"
        element={
          <LayoutNew>
            <ResultsPageNew />
          </LayoutNew>
        }
      />
      <Route
        path="/competition/:competitionId/results/individual"
        element={
          <LayoutNew>
            <IndividualResultsNew />
          </LayoutNew>
        }
      />
      <Route
        path="/competition/:competitionId/results/races"
        element={
          <LayoutNew>
            <TeamResultsNew />
          </LayoutNew>
        }
      />
      <Route
        path="/competition/:competitionId/results/races/:raceId"
        element={
          <LayoutNew>
            <ResultsPageNew />
          </LayoutNew>
        }
      />
    </>
  );
}

export default ResultsRoutesNew;
