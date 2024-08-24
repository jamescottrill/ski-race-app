import React from 'react';
import { Button, Container, Typography, Paper } from '@mui/material';
import CompetitorForm from '../../components/CompetitorForm';
import { useBackButton } from '../../utils/navigation';

function RegisterCompetitorPage() {
  const handleBack = useBackButton();


  return (
    <Container className="register-competitor-page flex flex-col items-center justify-center min-h-screen  w-full max-w-full">
      <Paper
        elevation={3}
        className="p-8 rounded-lg shadow-lg w-full max-w-lg m-4 "
      >
        <Typography
          variant="h4"
          component="h2"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          New Competitor
        </Typography>
        <CompetitorForm editMode={false} />
        <Button
          variant="contained"
          color="secondary"
          onClick={handleBack}
          className="text-white py-2 px-4 rounded shadow-lg w-full"
        >
          Back
        </Button>
      </Paper>
    </Container>
  );
}

export default RegisterCompetitorPage;
