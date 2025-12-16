import React from 'react';
import { Route } from 'react-router-dom';
import GenerateSeedListNew from '../pages/seedList/GenerateSeedListNew';
import RaceLandingPageNew from '../pages/race/RaceLandingPageNew';
import LayoutNew from '../components/LayoutNew';

function SeedListRoutesNew() {
  return (
    <>
      <Route
        path="/competition/:competitionId/seed-list"
        element={
          <LayoutNew>
            <RaceLandingPageNew />
          </LayoutNew>
        }
      />
      <Route
        path="/competition/:competitionId/seed-list/generate"
        element={
          <LayoutNew>
            <GenerateSeedListNew />
          </LayoutNew>
        }
      />
    </>
  );
}

export default SeedListRoutesNew;