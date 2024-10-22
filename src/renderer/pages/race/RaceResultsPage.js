import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Typography, Paper, Tab, Tabs, Button } from '@mui/material';
import RaceRun from '../../components/RaceRun';

function CustomTabPanel(props) {
  const { value, index, raceId, competitionId, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      <RaceRun runId="1" raceId={raceId} competitionId={competitionId} />
    </div>
  );
}

export default function RaceResultsPage() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const [value, setValue] = React.useState(1);
  const [raceRuns, setRaceRuns] = React.useState([]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const getNumberRuns = async () => {
    const numRunQuery = `
    SELECT r.competition_id, r.race_id, run_id, run_number
    FROM race_run rr
    INNER JOIN races r
      ON r.race_id = rr.race_id
      AND r.competition_id = rr.competition_id
      AND rr.run_number <= r.number_runs
    WHERE rr.race_id = ? AND rr.competition_id = ?
    `;
    const params = [raceId, competitionId];
    try {
      const raceResults = await window.api.select(numRunQuery, params);
      setRaceRuns(raceResults);
    } catch (error) {
      console.error('Failed to fetch races:', error);
    }
  };

  useEffect(() => {
    getNumberRuns();
  }, []);

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
        <Tabs
          onChange={handleChange}
          value={value}
        >
          {raceRuns.map((run) => (
            <Tab label={`Run ${run.run_number}`} value={run.run_number} />
          ))}
        </Tabs>
        {raceRuns.map((run) => (
          <CustomTabPanel
            value={value}
            index={run.run_number}
            raceId={raceId}
            competitionId={run.competitionId}
          />
        ))}
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
