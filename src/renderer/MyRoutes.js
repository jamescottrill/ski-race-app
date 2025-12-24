import { Route } from 'react-router-dom';
import LandingPage from './pages/landingPage';
import CreateCompetitionPage from './pages/createCompetition';
import CompetitionManagementPage from './pages/competitonManagementPage';
import CompetitorRoutes from './routes/CompetitorRoutes';
import ResultsRoutes from './routes/ResultsRoutes';
import RaceRoutes from './routes/RaceRoutes';
import SeedListRoutes from './routes/SeedListRoutes';
import Layout from './components/Layout';
import MergePeoplePageNew from './pages/admin/MergePeoplePageNew';

export default function MyRoutes() {
  return (
    <>
      <Route path="/" element={<LandingPage />} />
      <Route path="/new-competition" element={<CreateCompetitionPage />} />
      <Route path="/admin/merge-people" element={<MergePeoplePageNew />} />
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
      {ResultsRoutes()}
    </>
  );
}
