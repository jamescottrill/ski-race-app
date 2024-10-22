import React, { useEffect, useState } from 'react';
import {
  Button,
  Container,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Autocomplete,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import CompetitorForm from '../../components/CompetitorForm';
import { useBackButton } from '../../utils/navigation';

function RegisterCompetitorPage() {
  const handleBack = useBackButton();
  const { competitionId } = useParams();
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState('');

  const fetchCompetitors = async () => {
    const query = `
      SELECT p.id, p.first_name, p.last_name, p.service_number
      FROM people p
      LEFT JOIN competition_competitor cc ON p.id = cc.racer_id
      WHERE cc.competition_id != ? OR cc.competition_id IS NULL
    `;
    const params = [competitionId];

    try {
      const result = await window.api.select(query, params);
      console.log(result);
      setCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    }
  };

  useEffect(() => {
    fetchCompetitors();
    console.log(competitors);
  }, []);

  const handleAutocompleteChange = (event, newValue) => {
    console.log(newValue);
    setSelectedCompetitorId(newValue ? newValue.id : '');
  };

  const autoCompleteProps = {
    options: competitors,
    getOptionLabel: (option) => `${option.first_name} ${option.last_name}`,
  };

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
        <FormControl fullWidth variant="outlined" className="mb-4">
          <Autocomplete
            {...autoCompleteProps}
            id="existingCompetitor"
            name="existingCompetitor"
            onChange={handleAutocompleteChange}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select an Existing Competitor"
                inputProps={{
                  ...params.inputProps,
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value}
          />
        </FormControl>
        {(selectedCompetitorId && (
          <CompetitorForm
            editMode
            competitorId={selectedCompetitorId}
            existingCompetitor
          />
        )) || <CompetitorForm editMode={false} />}
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
