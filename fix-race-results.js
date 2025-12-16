#!/usr/bin/env node

const fs = require('fs');

// First, let's fix the RaceResultsPageNew to properly use the existing components
const raceResultsPageNew = `import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import RaceResultSeedNew from '../../components/RaceResultSeedNew';
import RaceResultTwoRunNew from '../../components/RaceResultTwoRunNew';
import RaceResultOneRunNew from '../../components/RaceResultOneRunNew';
import RaceTeamResultTwoRunNew from '../../components/RaceTeamResultTwoRunNew';
import RaceTeamResultOneRunNew from '../../components/RaceTeamResultOneRunNew';
import { getRaceDetails } from '../../utils/RaceDetails';

export default function RaceResultsPageNew() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [activeTab, setActiveTab] = useState('result');
  const [raceRuns, setRaceRuns] = useState([]);
  const [raceDetails, setRaceDetails] = useState({});
  const [loading, setLoading] = useState(true);

  const getNumberRuns = async () => {
    const numRunQuery = \`
    SELECT r.competition_id, r.race_id, run_id, run_number, COALESCE(rr.is_complete, false) AS is_complete
    FROM race_run rr
    INNER JOIN races r
      ON r.race_id = rr.race_id
      AND r.competition_id = rr.competition_id
      AND rr.run_number <= r.number_runs
    WHERE rr.race_id = ? AND rr.competition_id = ?
    ORDER BY rr.run_number
    \`;
    const params = [raceId, competitionId];
    try {
      const numRuns = await window.api.select(numRunQuery, params);
      setRaceRuns(numRuns);
      const notCompleted = numRuns.filter((e) => !e.is_complete);
      if (notCompleted.length === 2) setActiveTab('result');
      if (notCompleted.length === 1 && notCompleted[0].run_number === 2) setActiveTab('result');
      if (notCompleted.length === 1 && notCompleted[0].run_number === 1) setActiveTab('result');
    } catch (error) {
      console.error('Failed to fetch races:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      await getNumberRuns();
      const details = await getRaceDetails(raceId, competitionId);
      setRaceDetails(details);
      setLoading(false);
    };
    init();
  }, [raceId, competitionId]);

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Loading..." />
      </PageContainer>
    );
  }

  const renderResultContent = () => {
    if (raceRuns.length === 2 && raceDetails.is_seeding) {
      return <RaceResultSeedNew raceId={raceId} competitionId={competitionId} />;
    }
    if (raceRuns.length === 2 && !raceDetails.is_seeding) {
      return <RaceResultTwoRunNew raceId={raceId} competitionId={competitionId} />;
    }
    if (raceRuns.length === 1) {
      return <RaceResultOneRunNew raceId={raceId} competitionId={competitionId} />;
    }
    return null;
  };

  const renderTeamContent = () => {
    if (raceDetails.is_team && raceRuns.length === 2) {
      return <RaceTeamResultTwoRunNew raceId={raceId} competitionId={competitionId} />;
    }
    if (raceDetails.is_team && raceRuns.length === 1) {
      return <RaceTeamResultOneRunNew raceId={raceId} competitionId={competitionId} />;
    }
    return null;
  };

  return (
    <PageContainer>
      <PageHeader
        title="Results"
        subtitle={\`\${raceDetails.race_name || ''} • \${raceDetails.venue || ''}\`}
        actions={
          <Button
            variant="outline"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        }
      />

      {raceDetails.is_team ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="result">Results</TabsTrigger>
            <TabsTrigger value="teamResult">Team Results</TabsTrigger>
          </TabsList>
          <TabsContent value="result">
            {renderResultContent()}
          </TabsContent>
          <TabsContent value="teamResult">
            {renderTeamContent()}
          </TabsContent>
        </Tabs>
      ) : (
        renderResultContent()
      )}
    </PageContainer>
  );
}`;

// Write the fixed file
fs.writeFileSync('src/renderer/pages/race/RaceResultsPageNew.js', raceResultsPageNew);
console.log('Fixed RaceResultsPageNew.js to use existing component structure');