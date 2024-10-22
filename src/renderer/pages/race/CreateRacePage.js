import React from 'react';
import { Container, Typography, Paper } from '@mui/material';
import RaceForm from '../../components/RaceForm';

export default function CreateRacePage() {
  return (
    <Container className="create-race-page flex flex-col items-center justify-center min-h-screen ">
      <Paper
        elevation={3}
        className="p-8 rounded-lg shadow-lg w-full max-w-lg m-4"
      >
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Create Race
        </Typography>
        <RaceForm editMode={false} />
      </Paper>
    </Container>
  );
}
