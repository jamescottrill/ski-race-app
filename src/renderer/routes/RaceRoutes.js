import React from 'react';
import { Route } from 'react-router-dom';
import RaceLandingPage from '../pages/race/RaceLandingPage';
import CreateRacePage from '../pages/race/CreateRacePage';
import EditRacePage from  '../pages/race/EditRacePage';
import Layout from '../components/Layout';

function RaceRoutes() {
  return (
    <>
      <Route
        path="competition/:competitionId/race"
        element={
          <Layout>
            <RaceLandingPage />
          </Layout>
        }
      />
      <Route
        path="competition/:competitionId/race/new"
        element={<Layout><CreateRacePage /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId"
        element={<Layout><EditRacePage /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/edit"
        element={<Layout><RaceLandingPage /></Layout>}
      />
    </>
  );
}

export default RaceRoutes;
