import React, { useState, useEffect } from 'react';
import { Button, Typography, Container, Paper } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackButton } from '../../utils/navigation';

function ResultsPage() {
  const { competitionId } = useParams();
  const [competitionName, setCompetitionName] = useState('');
  const navigate = useNavigate();

  const individualNav = () => {
    navigate(`/competition/${competitionId}/results/individual`);
  };

  const teamNav = () => {
    navigate(`/competition/${competitionId}/results/team`);
  };

  const racesNav = () => {
    navigate(`/competition/${competitionId}/results/races`);
  };

  const handleBack = useBackButton();

  useEffect(() => {
    const fetchCompetitionDetails = async () => {
      const query = 'SELECT competition_name FROM competitions WHERE id = ?';
      const params = [competitionId];

      try {
        const result = await window.api.select(query, params);
        setCompetitionName(result[0].competition_name);
        } catch (error) {
        console.error('Failed to fetch competition details:', error);
      }
    };

    fetchCompetitionDetails();

  }, [competitionId]);



  return (
    <Container className="competition-management-page flex flex-col items-center justify-center min-h-screen w-full max-w-full">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg">
        <Typography
          variant="h4"
          component="h2"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          {competitionName}
        </Typography>
        <div className="grid grid-cols-1 gap-4">
          <Button
            variant="contained"
            color="primary"
            onClick={individualNav}
            className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded shadow-lg mb-4 w-full"
          >
            Individual
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={teamNav}
            className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded shadow-lg mb-4 w-full"
          >
            Team
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={racesNav}
            className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded shadow-lg mb-4 w-full"
          >
            Races
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleBack}
            className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded shadow-lg mb-4 w-full"
          >
            Back
          </Button>
        </div>
      </Paper>
    </Container>
  );
}

export default ResultsPage;
