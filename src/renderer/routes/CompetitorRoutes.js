import React from 'react';
import { Route } from 'react-router-dom';
import ManageCompetitorsPageNew from '../pages/competitor/ManageCompetitorsPageNew';
import EditCompetitorsPageNew from '../pages/competitor/EditCompetitorsPageNew';
import EditCompetitorPageNew from '../pages/competitor/EditCompetitorPageNew';
import RegisterCompetitorPageNew from '../pages/competitor/RegisterCompetitorPageNew';
import ViewCompetitorsPageNew from '../pages/competitor/ViewCompetitorsPageNew';
import UploadCompetitorsPageNew from '../pages/competitor/UploadCompetitorsPageNew';
import TeamListPageNew from '../pages/team/TeamListPageNew';
import Layout from '../components/Layout';

function CompetitorRoutes() {
  return (
    <>
      <Route
        path="competition/:competitionId/competitor/manage"
        element={
        <Layout>
          <ManageCompetitorsPageNew />
        </Layout>}
      />
      <Route
        path="competition/:competitionId/competitor/edit"
        element={<Layout><EditCompetitorsPageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/competitor/:competitorId/edit"
        element={<Layout><EditCompetitorPageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/competitor/new"
        element={<Layout><RegisterCompetitorPageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/competitor/list"
        element={<Layout><ViewCompetitorsPageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/competitor/bulk"
        element={<Layout><UploadCompetitorsPageNew /></Layout>}
      />
      <Route
        path="competition/:competitionId/team/list"
        element={<Layout><TeamListPageNew /></Layout>}
      />
    </>
  );
}

export default CompetitorRoutes;
