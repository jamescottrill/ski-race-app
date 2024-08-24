import React from 'react';
import { Button, Typography, Container, Box, Paper, Grid } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useBackButton } from '../../utils/navigation';

function ManageCompetitorsPage() {
  const navigate = useNavigate();
  const { competitionId } = useParams();

  const handleRegisterCompetitor = () => {
    navigate(`/competition/${competitionId}/competitor/new`);
  };

  const handleEditCompetitor = () => {
    navigate(`/competition/${competitionId}/competitor/edit`);
  };

  const handleViewCompetitors = () => {
    navigate(`/competition/${competitionId}/competitor/list`);
  };

  const handleManageTeams = () => {
    navigate(`/competition/${competitionId}/team/edit`);
  };

  const handleViewTeams = () => {
    navigate(`/competition/${competitionId}/team/list`);
  };
  const handleBack = useBackButton();

  return (
    <Container className="competitor-management-page flex flex-col items-center justify-center min-h-screen  w-full max-w-full">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h4"
          component="h2"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Competitor Management
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleRegisterCompetitor}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full"
            >
              Register Competitor
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleEditCompetitor}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full"
            >
              Edit Competitor
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleViewCompetitors}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full"
            >
              View Competitors
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleManageTeams}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full"
            >
              Manage Teams
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleViewTeams}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full"
            >
              View Teams
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleBack}
              className="text-white py-2 px-4 rounded shadow-lg w-full"
            >
              Back
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}

export default ManageCompetitorsPage;
