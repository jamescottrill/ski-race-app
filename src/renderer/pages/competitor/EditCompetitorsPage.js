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
  const { competitionId } = useParams();
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState('');

  const handleBack = useBackButton();

  const fetchCompetitors = async () => {
    const query = `
      SELECT p.id, p.first_name, p.last_name
      FROM people p
      INNER JOIN competition_competitor cc ON p.id = cc.racer_id
      WHERE cc.competition_id = ?
    `;
    const params = [competitionId];

    try {
      const result = await window.api.select(query, params);
      setCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    }
  };

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const handleSelectChange = (event) => {
    setSelectedCompetitorId(event.target.value);
  };

  useEffect(() => {
    if (selectedCompetitorId) {
      console.log(`competitor Id Set to ${selectedCompetitorId}`);
    }
  }, [selectedCompetitorId]);

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

        <FormControl fullWidth variant="outlined" className="mb-4">
          <InputLabel id="select-competitor-label">
            Select Competitor
          </InputLabel>
          <Select
            labelId="select-competitor-label"
            id="select-competitor"
            value={selectedCompetitorId}
            onChange={handleSelectChange}
            label="Select Competitor"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {competitors.map((competitor) => (
              <MenuItem key={competitor.id} value={competitor.id}>
                {competitor.first_name} {competitor.last_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {selectedCompetitorId && (
          <CompetitorForm editMode competitorId={selectedCompetitorId} />
        )}
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
