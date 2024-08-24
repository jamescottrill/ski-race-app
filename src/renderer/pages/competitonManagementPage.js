import React, { useState, useEffect } from 'react';
import { Button, Typography, Container, Box, Paper } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

function CompetitionManagementPage() {
  const { competitionId } = useParams();
  const [competitionName, setCompetitionName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCompetitionDetails = async () => {
      const query = 'SELECT competition_name FROM competitions WHERE id = ?';
      const params = [competitionId];

      try {
        const result = await window.api.select(query, params);
        if (result && result[0]) {
          setCompetitionName(result[0].competition_name);
        } else {
          console.error('Competition not found');
          navigate('/');
        }
      } catch (error) {
        console.error('Failed to fetch competition details:', error);
        navigate('/');
      }
    };

    fetchCompetitionDetails();
  }, [competitionId]);

  const handleManageCompetitors = () => {
    navigate(`/competition/${competitionId}/competitor/manage`);
  };

  const handleManageRaces = () => {
    navigate(`/competition/${competitionId}/race/manage`);
  };

  const handleViewRaceResults = () => {
    navigate(`/competition/${competitionId}/result`);
  };

  const handleGenerateSeedList = () => {
    navigate(`/competition/${competitionId}/seed-list/generate`);
  };
  const handleChangeCompetition = () => {
    navigate('/');
  };

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
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="contained"
            color="primary"
            onClick={handleManageCompetitors}
            className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded shadow-lg mb-4 w-full"
          >
            Manage Competitors
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={handleManageRaces}
            className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded shadow-lg mb-4 w-full"
          >
            Manage Races
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={handleViewRaceResults}
            className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded shadow-lg mb-4 w-full"
          >
            View Race Results
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={handleGenerateSeedList}
            className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded shadow-lg mb-4 w-full"
          >
            Generate Seed List
          </Button>
        </div>
        <Button
          variant="contained"
          color="primary"
          onClick={handleChangeCompetition}
          className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded shadow-lg mb-4 w-full"
        >
          Change Competition
        </Button>
      </Paper>
    </Container>
  );
}

export default CompetitionManagementPage;
