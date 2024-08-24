import React, { useState, useEffect } from 'react';
import {
  Button,
  Typography,
  Container,
  Box,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  Paper,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    try {
      const query = 'SELECT id, competition_name FROM competitions';
      const result = await window.api.select(query);
      setCompetitions(result);
    } catch (error) {
      console.error('Failed to fetch competitions', error);
    }
  };

  const handleCreateCompetition = () => {
    navigate('/new-competition');
  };

  const handleSelectCompetition = (event) => {
    setSelectedCompetition(event.target.value);
    navigate(`/competition/${event.target.value}`);
  };

  return (
    <Container className="landing-page bg-image flex flex-col items-center justify-center min-h-screen w-full max-w-full">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h3"
          component="h1"
          className="my-6 font-bold text-gray-800 text-center"
        >
          AWSA Alpine Race scoring
        </Typography>
        <div className="flex m-auto max-w-lg pt-4">
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateCompetition}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg mb-4 mx-2 w-full"
          >
            Create New Competition
          </Button>

          <FormControl variant="outlined" fullWidth className="mx-2">
            <InputLabel id="select-competition-label">
              Select Competition
            </InputLabel>
            <Select
              labelId="select-competition-label"
              id="select-competition"
              value={selectedCompetition}
              onChange={handleSelectCompetition}
              label="Select Competition"
              className="bg-white mx-2"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {competitions.map((competition) => (
                <MenuItem key={competition.id} value={competition.id}>
                  {competition.competition_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </Paper>
    </Container>
  );
}

export default LandingPage;
