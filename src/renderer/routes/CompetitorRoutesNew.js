import React from 'react';
import { Route } from 'react-router-dom';
import ManageCompetitorsPageNew from '../pages/competitor/ManageCompetitorsPageNew';
import EditCompetitorsPageNew from '../pages/competitor/EditCompetitorsPageNew';
import EditCompetitorPageNew from '../pages/competitor/EditCompetitorPageNew';
import RegisterCompetitorPageNew from '../pages/competitor/RegisterCompetitorPageNew';
import ViewCompetitorsPageNew from '../pages/competitor/ViewCompetitorsPageNew';
import UploadCompetitorsPageNew from '../pages/competitor/UploadCompetitorsPageNew';
import TeamListPageNew from '../pages/team/TeamListPageNew';
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
        path="competition/:competitionId/team/list"
        element={<LayoutNew><TeamListPageNew /></LayoutNew>}
      />
    </>
  );
}

export default CompetitorRoutesNew;
