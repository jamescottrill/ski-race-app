import React from 'react';
import { Route } from 'react-router-dom';
import RaceLandingPage from '../pages/race/RaceLandingPage';
import CreateRacePage from '../pages/race/CreateRacePage';
import EditRacePage from '../pages/race/EditRacePage';
import RaceResultsPage from '../pages/race/RaceResultsPage';
import Layout from '../components/Layout';
import RaceDetailsPage from '../pages/race/RaceDetailsPage';
import GenerateStartList from '../pages/race/GenerateStartList';

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
        element={<Layout><RaceDetailsPage /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/edit"
        element={<Layout><EditRacePage /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/results"
        element={<Layout><RaceResultsPage /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/results/edit"
        element={<Layout><RaceResultsPage /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/start-list"
        element={<Layout><GenerateStartList /></Layout>}
      />
    </>
  );
}

export default RaceRoutes;
