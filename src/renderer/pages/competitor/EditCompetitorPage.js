import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Container,
  Paper,
  Typography,
  Button,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import CompetitorForm from '../../components/CompetitorForm';
import { useBackButton } from '../../utils/navigation';

function EditCompetitorPage() {
  const { competitionId, competitorId } = useParams();

  const handleBack = useBackButton();


  return (
    <Container className="edit-competitor-page flex flex-col items-center justify-center min-h-screen  w-full max-w-full">
      <Paper
        elevation={3}
        className="p-8 rounded-lg shadow-lg w-full max-w-lg mb-4"
      >
        <Typography
          variant="h4"
          component="h2"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Edit Competitor
        </Typography>

        <CompetitorForm editMode competitorId={competitorId} />
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

export default EditCompetitorPage;
