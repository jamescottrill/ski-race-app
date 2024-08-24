import { Route } from 'react-router-dom';
import LandingPage from './pages/landingPage';
import CreateCompetitionPage from './pages/createCompetition';
import CompetitionManagementPage from './pages/competitonManagementPage';
import CompetitorRoutes from './routes/CompetitorRoutes';
import RaceRoutes from './routes/RaceRoutes';
import SeedListRoutes from './routes/SeedListRoutes';
import Layout from './components/Layout';

export default function MyRoutes() {
  return (
    <>
      <Route path="/" element={<LandingPage />} />
      <Route path="/new-competition" element={<CreateCompetitionPage />} />
      <Route
        path="/competition/:competitionId"
        element={
          <Layout>
            <CompetitionManagementPage />
          </Layout>
        }
      />
      {CompetitorRoutes()}
      {RaceRoutes()}
      {SeedListRoutes()}
    </>
  );
}
