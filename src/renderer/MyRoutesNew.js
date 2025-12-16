import { Route } from 'react-router-dom';
import LandingPageNew from './pages/landingPageNew';
import CreateCompetitionPageNew from './pages/createCompetitionNew';
import CompetitionManagementPageNew from './pages/competitionManagementPageNew';
import CompetitorRoutesNew from './routes/CompetitorRoutesNew';
import ResultsRoutesNew from './routes/ResultsRoutesNew';
import RaceRoutesNew from './routes/RaceRoutesNew';
import SeedListRoutesNew from './routes/SeedListRoutesNew';
import LayoutNew from './components/LayoutNew';

export default function MyRoutesNew() {
  return (
    <>
      <Route path="/" element={<LandingPageNew />} />
      <Route path="/new-competition" element={<CreateCompetitionPageNew />} />
      <Route
        path="/competition/:competitionId"
        element={
          <LayoutNew>
            <CompetitionManagementPageNew />
          </LayoutNew>
        }
      />
      {CompetitorRoutesNew()}
      {RaceRoutesNew()}
      {SeedListRoutesNew()}
      {ResultsRoutesNew()}
    </>
  );
}
