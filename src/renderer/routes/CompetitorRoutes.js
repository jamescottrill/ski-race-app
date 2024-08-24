import React from 'react';
import { Route } from 'react-router-dom';
import ManageCompetitorsPage from '../pages/competitor/ManageCompetitorsPage';
import EditCompetitorsPage from '../pages/competitor/EditCompetitorsPage';
import EditCompetitorPage from '../pages/competitor/EditCompetitorPage';
import RegisterCompetitorPage from '../pages/competitor/RegisterCompetitorPage';
import ViewCompetitorsPage from '../pages/competitor/ViewCompetitorsPage';
import Layout from '../components/Layout';

function CompetitorRoutes() {
  return (
    <>
      <Route
        path="competition/:competitionId/competitor/manage"
        element={
        <Layout>
          <ManageCompetitorsPage />
        </Layout>}
      />
      <Route
        path="competition/:competitionId/competitor/edit"
        element={<Layout><EditCompetitorsPage /></Layout>}
      />
      <Route
        path="competition/:competitionId/competitor/:competitorId/edit"
        element={<Layout><EditCompetitorPage /></Layout>}
      />
      <Route
        path="competition/:competitionId/competitor/new"
        element={<Layout><RegisterCompetitorPage /></Layout>}
      />
      <Route
        path="competition/:competitionId/competitor/list"
        element={<Layout><ViewCompetitorsPage /></Layout>}
      />
    </>
  );
}

export default CompetitorRoutes;
