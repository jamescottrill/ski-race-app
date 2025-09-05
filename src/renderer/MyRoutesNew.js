import { Route } from 'react-router-dom';
import LandingPageNew from './pages/landingPageNew';
import CreateCompetitionPage from './pages/createCompetition';
import CompetitionManagementPageNew from './pages/competitionManagementPageNew';
import CompetitorRoutes from './routes/CompetitorRoutes';
import ResultsRoutes from './routes/ResultsRoutes';
import RaceRoutes from './routes/RaceRoutes';
import SeedListRoutes from './routes/SeedListRoutes';
import LayoutNew from './components/LayoutNew';

export default function MyRoutesNew() {
  return (
    <>
      <Route path="/" element={<LandingPageNew />} />
      <Route path="/new-competition" element={<CreateCompetitionPage />} />
      <Route
        path="/competition/:competitionId"
        element={
          <LayoutNew>
            <CompetitionManagementPageNew />
          </LayoutNew>
        }
      />
      {/* Temporarily keeping old routes but wrapped in new layout */}
      {CompetitorRoutes()}
      {RaceRoutes()}
      {SeedListRoutes()}
      {ResultsRoutes()}
    </>
  );
}