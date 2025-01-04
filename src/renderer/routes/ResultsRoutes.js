import React from 'react';
import { Route } from 'react-router-dom';
import ResultsPage from '../pages/results/resultsPage';
import IndividualResults from '../pages/results/individual';
import TeamResults from '../pages/results/team';
import Layout from '../components/Layout';

function RaceRoutes() {
  return (
    <>
      <Route
        path="/competition/:competitionId/results"
        element={
          <Layout>
            <ResultsPage />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/results/team"
        element={
          <Layout>
            <ResultsPage />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/results/individual"
        element={
          <Layout>
            <IndividualResults />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/results/races"
        element={
          <Layout>
            <TeamResults />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/results/races/:raceId"
        element={
          <Layout>
            <ResultsPage />
          </Layout>
        }
      />
    </>
  );
}

export default RaceRoutes;
