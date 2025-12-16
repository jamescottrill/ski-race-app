import React from 'react';
import { Route } from 'react-router-dom';
import GenerateSeedListNew from '../pages/seedList/GenerateSeedListNew';
import RaceLandingPageNew from '../pages/race/RaceLandingPageNew';
import Layout from '../components/Layout';

function RaceRoutes() {
  return (
    <>
      <Route
        path="/competition/:competitionId/seed-list"
        element={
          <Layout>
            <RaceLandingPageNew />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/seed-list/generate"
        element={
          <Layout>
            <GenerateSeedListNew />
          </Layout>
        }
      />
      <Route
        path="/competition/:competitionId/race/:raceId/edit"
        element={
          <Layout>
            <RaceLandingPageNew />
          </Layout>
        }
      />
    </>
  );
}

export default RaceRoutes;