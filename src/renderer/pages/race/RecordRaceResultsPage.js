import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Typography, Paper, Tab, Tabs, Button } from '@mui/material';
import RaceRun from '../../components/RaceRun';
import RaceResultTwoRun from '../../components/RaceResultTwoRun';
import RaceResult from '../../components/RaceResult';
import RaceResultSeed from '../../components/RaceResultSeed';
import { getRaceDetails } from '../../utils/RaceDetails';
import RaceTeamResultTwoRun from '../../components/RaceTeamResultTwoRun';
import RaceTeamResultOneRun from '../../components/RaceTeamResult';

function RaceRunTabPanel(props) {
  const { value, index, raceId, competitionId, edit, totalRuns, isSeedingRace, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      <RaceRun
        runId={index}
        raceId={raceId}
        competitionId={competitionId}
        edit={edit}
        totalRuns={totalRuns}
        isSeedingRace={isSeedingRace}
      />
    </div>
  );
}

function RaceResultTabPanel(props) {
  const { value, index, raceId, competitionId, runs, isSeed } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
    >
      {runs === 2 && isSeed && (
        <RaceResultSeed raceId={raceId} competitionId={competitionId} />
      )}
      {runs === 2 && !isSeed && (
        <RaceResultTwoRun raceId={raceId} competitionId={competitionId} />
      )}
      {runs === 1 && (
        <RaceResult raceId={raceId} competitionId={competitionId} />
      )}
    </div>
  );
}

function TeamResultTabPanel(props) {
  const { value, index, raceId, competitionId, runs, isTeam } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
    >
  {isTeam && runs === 2 && (
    <RaceTeamResultTwoRun raceId={raceId} competitionId={competitionId} />
  )}
  {isTeam && runs === 1 && (
    <RaceTeamResultOneRun raceId={raceId} competitionId={competitionId} />
  )}
    </div>
  );
}

export default function RecordRaceResultsPage() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const [value, setValue] = React.useState('result');
  const [raceRuns, setRaceRuns] = React.useState([]);
  const [raceDetails, setRaceDetails] = React.useState([]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const getNumberRuns = async () => {
    const numRunQuery = `
    SELECT r.competition_id, r.race_id, run_id, run_number, COALESCE(rr.is_complete, false) AS is_complete
    FROM race_run rr
    INNER JOIN races r
      ON r.race_id = rr.race_id
      AND r.competition_id = rr.competition_id
      AND rr.run_number <= r.number_runs
    WHERE rr.race_id = ? AND rr.competition_id = ?
    ORDER BY rr.run_number
    `;
    const params = [raceId, competitionId];
    try {
      const numRuns = await window.api.select(numRunQuery, params);
      setRaceRuns(numRuns);
      const notCompleted = numRuns.filter((e) => {
        return !e.is_complete;
      });
      if (notCompleted.length === 2) setValue(1);
      if (notCompleted.length === 1 && notCompleted[0].run_number === 2) setValue(2);
      if (notCompleted.length === 1 && notCompleted[0].run_number === 1) setValue(1);
    } catch (error) {
      console.error('Failed to fetch races:', error);
    }
  };

  useEffect(() => {
    getNumberRuns();
    const getDetails = async () => {
      const details = await getRaceDetails(raceId, competitionId)
        setRaceDetails(details);
    };
    getDetails();
  }, [raceId, competitionId]);

  return (
    <Container className="edit-race-page flex flex-col items-center justify-center w-full min-w-full min-h-screen ">
      <Paper
        elevation={3}
        className="p-8 rounded-lg shadow-lg w-full mins-w-lg"
      >
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Results
        </Typography>
        <Tabs onChange={handleChange} value={value}>
          {raceRuns.map((run) => (
            <Tab label={`Run ${run.run_number}`} value={run.run_number} />
          ))}
          <Tab label="Results" value="result" />
          {raceDetails.is_team &&(
            <Tab label="Team Results" value="teamResult" />
          )}
        </Tabs>
        {raceRuns.map((run) => (
          <RaceRunTabPanel
            value={value}
            index={run.run_number}
            raceId={raceId}
            competitionId={run.competition_id}
            edit={!run.is_complete}
            totalRuns={raceRuns.length}
            isSeedingRace={raceDetails.is_seeding}
          />
        ))}
        <RaceResultTabPanel
          value={value}
          index="result"
          raceId={raceId}
          competitionId={competitionId}
          isSeed={raceDetails.is_seeding}
          runs={raceRuns.length}
        />
        {raceDetails.is_team !== 0 && (<TeamResultTabPanel
            value={value}
            index="teamResult"
            raceId={raceId}
            competitionId={competitionId}
            runs={raceRuns.length}
            isTeam={raceDetails.is_team}
          />
        )}
      </Paper>
      <Button
        variant="contained"
        color="secondary"
        onClick={() => navigate(-1)}
        className="text-white py-2 px-4 rounded shadow-lg w-full"
      >
        Back
      </Button>
    </Container>
  );
}
