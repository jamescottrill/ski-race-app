import React from 'react';
import { Route } from 'react-router-dom';
import RaceLandingPageNew from '../pages/race/RaceLandingPageNew';
import CreateRacePageNew from '../pages/race/CreateRacePageNew';
import EditRacePageNew from '../pages/race/EditRacePageNew';
import RecordRaceResultsPageNew from '../pages/race/RecordRaceResultsPageNew';
import ImportRaceResultsPageNew from '../pages/race/ImportRaceResultsPageNew';
import RaceResultsPageNew from '../pages/race/RaceResultsPageNew';
import LayoutNew from '../components/LayoutNew';
import RaceDetailsPageNew from '../pages/race/RaceDetailsPageNew';
import GenerateStartListNew from '../pages/race/GenerateStartListNew';
import RaceTeamManagementNew from '../pages/race/RaceTeamManagementNew';

function RaceRoutesNew() {
  return (
    <>
      <Route
        path="competition/:competitionId/race"
        element={
          <LayoutNew>
            <RaceLandingPageNew />
          </LayoutNew>
        }
      />
      <Route
        path="competition/:competitionId/race/new"
        element={<LayoutNew><CreateRacePageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/race/:raceId"
        element={<LayoutNew><RaceDetailsPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/edit"
        element={<LayoutNew><EditRacePageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/results"
        element={<LayoutNew><RaceResultsPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/results/edit"
        element={<LayoutNew><RecordRaceResultsPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/results/import"
        element={<LayoutNew><ImportRaceResultsPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/start-list"
        element={<LayoutNew><GenerateStartListNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/race/:raceId/teams"
        element={<LayoutNew><RaceTeamManagementNew /></LayoutNew>}
      />
    </>
  );
}

export default RaceRoutesNew;
