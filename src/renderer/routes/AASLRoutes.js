import React from 'react';
import { Route } from 'react-router-dom';
import AASLManagementPage from '../pages/aasl/AASLManagementPage';
import ImportAASLPage from '../pages/aasl/ImportAASLPage';
import ViewAASLPage from '../pages/aasl/ViewAASLPage';
import LayoutNew from '../components/LayoutNew';

function AASLRoutes() {
  return (
    <>
      <Route
        path="/aasl"
        element={
          <LayoutNew>
            <AASLManagementPage />
          </LayoutNew>
        }
      />
      <Route
        path="/aasl/import"
        element={
          <LayoutNew>
            <ImportAASLPage />
          </LayoutNew>
        }
      />
      <Route
        path="/aasl/view"
        element={
          <LayoutNew>
            <ViewAASLPage />
          </LayoutNew>
        }
      />
    </>
  );
}

export default AASLRoutes;
