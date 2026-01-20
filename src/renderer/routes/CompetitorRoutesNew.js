import React from 'react';
import { Route } from 'react-router-dom';
import ManageCompetitorsPageNew from '../pages/competitor/ManageCompetitorsPageNew';
import EditCompetitorsPageNew from '../pages/competitor/EditCompetitorsPageNew';
import EditCompetitorPageNew from '../pages/competitor/EditCompetitorPageNew';
import RegisterCompetitorPageNew from '../pages/competitor/RegisterCompetitorPageNew';
import ViewCompetitorsPageNew from '../pages/competitor/ViewCompetitorsPageNew';
import UploadCompetitorsPageNew from '../pages/competitor/UploadCompetitorsPageNew';
import ImportCompetitorsFromCompetitionPage from '../pages/competitor/ImportCompetitorsFromCompetitionPage';
import CompetitorProfilePage from '../pages/competitor/CompetitorProfilePage';
import TeamListPageNew from '../pages/team/TeamListPageNew';
import CreateTeamPageNew from '../pages/team/CreateTeamPageNew';
import EditTeamPageNew from '../pages/team/EditTeamPageNew';
import TeamMembersPageNew from '../pages/team/TeamMembersPageNew';
import LayoutNew from '../components/LayoutNew';

function CompetitorRoutesNew() {
  return (
    <>
      <Route
        path="competition/:competitionId/competitor/manage"
        element={
        <LayoutNew>
          <ManageCompetitorsPageNew />
        </LayoutNew>}
      />
      <Route
        path="competition/:competitionId/competitor/edit"
        element={<LayoutNew><EditCompetitorsPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/competitor/:competitorId/edit"
        element={<LayoutNew><EditCompetitorPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/competitor/new"
        element={<LayoutNew><RegisterCompetitorPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/competitor/list"
        element={<LayoutNew><ViewCompetitorsPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/competitor/bulk"
        element={<LayoutNew><UploadCompetitorsPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/competitor/import-from-competition"
        element={<LayoutNew><ImportCompetitorsFromCompetitionPage /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/competitor/:competitorId/profile"
        element={<LayoutNew><CompetitorProfilePage /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/team/list"
        element={<LayoutNew><TeamListPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/team/new"
        element={<LayoutNew><CreateTeamPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/team/:teamId/edit"
        element={<LayoutNew><EditTeamPageNew /></LayoutNew>}
      />
      <Route
        path="competition/:competitionId/team/:teamId/members"
        element={<LayoutNew><TeamMembersPageNew /></LayoutNew>}
      />
    </>
  );
}

export default CompetitorRoutesNew;
