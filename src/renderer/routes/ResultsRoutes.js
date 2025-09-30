import React from 'react';
import { Route } from 'react-router-dom';
import ResultsPageNew from '../pages/results/resultsPageNew';
import IndividualResultsNew from '../pages/results/individualNew';
import TeamResultsNew from '../pages/results/teamNew';
import RacesListNew from '../pages/results/RacesListNew';
import Layout from '../components/Layout';

function RaceRoutes() {
  return (
    <>
      <Route
        path="/competition/:competitionId/results"
        element={
          <Layout>
            <ResultsPageNew />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/results/team"
        element={
          <Layout>
            <TeamResultsNew />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/results/individual"
        element={
          <Layout>
            <IndividualResultsNew />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/results/races"
        element={
          <Layout>
            <RacesListNew />
          </Layout>
        }
      />
    </>
  );
}

export default RaceRoutes;