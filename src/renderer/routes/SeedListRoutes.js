import React from 'react';
import { Route } from 'react-router-dom';
import SeedListPage from '../pages/seedList/GenerateSeedList';
import RaceLandingPage from '../pages/race/RaceLandingPage';
import Layout from '../components/Layout';

function RaceRoutes() {
  return (
    <>
      <Route
        path="/competition/:competitionId/seed-list"
        element={
          <Layout>
            <RaceLandingPage />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/seed-list/generate"
        element={
          <Layout>
            <SeedListPage />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/race/:raceId/edit"
        element={
          <Layout>
            <RaceLandingPage />
          </Layout>
        }
      />
    </>
  );
}

export default RaceRoutes;
