import React from 'react';
import { Route } from 'react-router-dom';
import RaceLandingPageNew from '../pages/race/RaceLandingPageNew';
import CreateRacePageNew from '../pages/race/CreateRacePageNew';
import EditRacePageNew from '../pages/race/EditRacePageNew';
import RecordRaceResultsPageNew from '../pages/race/RecordRaceResultsPageNew';
import RaceResultsPageNew from '../pages/race/RaceResultsPageNew';
import Layout from '../components/Layout';
import RaceDetailsPageNew from '../pages/race/RaceDetailsPageNew';
import GenerateStartListNew from '../pages/race/GenerateStartListNew';
import RaceTeamManagementNew from '../pages/race/RaceTeamManagementNew';

function RaceRoutes() {
  return (
    <>
      <Route
        path="competition/:competitionId/race"
        element={
          <Layout>
            <RaceLandingPageNew />
          </Layout>
        }
      />
      <Route
        path="competition/:competitionId/race/new"
        element={<Layout><CreateRacePageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId"
        element={<Layout><RaceDetailsPageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/edit"
        element={<Layout><EditRacePageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/results"
        element={<Layout><RaceResultsPageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/results/edit"
        element={<Layout><RecordRaceResultsPageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/start-list"
        element={<Layout><GenerateStartListNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/teams"
        element={<Layout><RaceTeamManagementNew /></Layout>}
      />
    </>
  );
}

export default RaceRoutes;
