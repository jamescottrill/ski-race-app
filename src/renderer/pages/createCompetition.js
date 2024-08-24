import React, { useState } from 'react';
import { Button, TextField, Typography, Container, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid4 } from 'uuid';
import { useBackButton } from '../utils/navigation';

function CreateCompetitionPage() {
  const [competitionName, setCompetitionName] = useState('');
  const [competitionDescription, setCompetitionDescription] = useState('');
  const navigate = useNavigate();
  const handleBack = useBackButton();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const id = uuid4();
    const query = `
      INSERT INTO competitions (id, competition_name, competition_description)
      VALUES (?, ?, ?)
    `;
    const params = [id, competitionName, competitionDescription];

    try {
      const result = await window.api.insert(query, params);
      if (result.success) {
        console.log('Competition created with ID:', result.id);
        navigate('/');
      } else {
        console.error('Failed to create competition:', result.error);
      }
    } catch (error) {
      console.error('Error creating competition:', error);
    }
  };

  return (
    <Container className="create-competition-page flex flex-col items-center justify-center  min-h-screen w-full max-w-full">
      <Box className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <Typography
          variant="h4"
          component="h2"
          className="mb-6 text-gray-800 font-bold"
        >
          Create New Competition
        </Typography>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            id="competitionName"
            label="Competition Name"
            variant="outlined"
            fullWidth
            required
            value={competitionName}
            onChange={(e) => setCompetitionName(e.target.value)}
          />
          <TextField
            id="competitionDescription"
            label="Description"
            variant="outlined"
            fullWidth
            required
            value={competitionDescription}
            onChange={(e) => setCompetitionDescription(e.target.value)}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full my-2"
          >
            Create Competition
          </Button>
        </form>
        <Button
          variant="contained"
          color="secondary"
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full my-2"
          onClick={handleBack}
        >
          Back
        </Button>
      </Box>
    </Container>
  );
}

export default CreateCompetitionPage;
