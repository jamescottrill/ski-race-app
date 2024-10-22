import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
} from '@mui/material';
import RaceForm from '../../components/RaceForm';

export default function EditRacePage() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();

  return (
    <Container className="edit-race-page flex flex-col items-center justify-center min-h-screen ">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Edit Race
        </Typography>
        <RaceForm editMode={true} raceId={raceId} />
      </Paper>
    </Container>
  );
}
