import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { v4 as uuid4 } from 'uuid';
import PersonModal from './PersonModal'; // Import the PersonModal component

function RaceForm({ editMode, raceId }) {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    raceName: '',
    raceType: '',
    isIndividual: false,
    isTeam: false,
    isTraining: false,
    isSeeding: false,
    womenSeparate: false,
    numberRuns: 1,
    venue: '',
    courseName: '',
    raceDate: '',
    chiefOfRace: '',
    techDelegate: '',
    referee: '',
    asstReferee: '',
    tempStart: '',
    tempFinish: '',
    snow: '',
    weather: '',
    homologation: '',
  });
  const [people, setPeople] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPersonField, setSelectedPersonField] = useState(null);

  const fetchPeople = async () => {
    const query = `SELECT id, first_name, last_name FROM people`;
    try {
      const result = await window.api.select(query);
      setPeople(result);
    } catch (error) {
      console.error('Failed to fetch people:', error);
    }
  };

  useEffect(() => {
    fetchPeople();
    if (editMode && raceId) {
      fetchRaceDetails();
    }
  }, [editMode, raceId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleAutocompleteChange = (event, newValue) => {
    setFormData({
      ...formData,
      [event.target.parentElement.id.split('-')[0]]: newValue
        ? newValue.id
        : '',
    });
  };

  const handleOpenModal = (field) => {
    setSelectedPersonField(field);
    setModalOpen(true);
  };

  const handleSavePerson = async (personId) => {
    await fetchPeople(); // Refresh the list of people after adding a new one
    setFormData({
      ...formData,
      [selectedPersonField]: personId, // Automatically select the new person
    });
    setModalOpen(false); // Close the modal after saving
  };

  const autoCompleteProps = {
    options: people,
    getOptionLabel: (option) => `${option.first_name} ${option.last_name}`,
  };

  const fetchRaceDetails = async () => {
    if (!raceId) {
      console.error('No race ID provided');
      return;
    }

    const query = `
      SELECT race_name, race_type, is_individual, is_team, is_training,
             is_seeding, women_separate, number_runs, venue, course_name,
             race_date, chief_of_race, tech_delegate, referee, asst_referee,
             temp_start, temp_finish, weather, snow, homologation
      FROM races
      WHERE race_id = ? and competition_id = ?
      `;
    const params = [raceId, competitionId];
    try {
      const result = await window.api.select(query, params);
      if (result && result[0]) {
        setFormData({
          raceName: result[0].race_name,
          raceType: result[0].race_type,
          isIndividual: result[0].is_individual || true,
          isTeam: result[0].is_team || false,
          isTraining: result[0].is_training || false,
          isSeeding: result[0].is_seeding || false,
          womenSeparate: result[0].women_separate || false,
          numberRuns: result[0].number_runs || 1,
          venue: result[0].venue || '',
          courseName: result[0].course_name || '',
          raceDate: result[0].race_date || '',
          chiefOfRace: result[0].chief_of_race || '',
          techDelegate: result[0].tech_delegate || '',
          referee: result[0].referree || '',
          asstReferee: result[0].asst_referee || '',
          weather: result[0].weather || '',
          snow: result[0].snow || '',
          homologation: result[0].homologation || '',
          tempStart: result[0].temp_start || '',
          tempFinish: result[0].temp_finish || '',
        });
      } else {
        console.error('Competitor not found');
      }
    } catch (error) {
      console.error('Failed to fetch competitor details:', error);
    }
  };

  const createNewRun = async (thisRaceId, thisCompetitionId, runNumber) => {
    const runId = uuid4();
    const runQuery = `
        INSERT INTO race_run (competition_id, race_id, run_id, run_number)
        VALUES(?, ?, ?, ?)
        `;
    const runParams = [thisCompetitionId, thisRaceId, runId, runNumber];
    return window.api.insert(runQuery, runParams);
  };

  const updateRace = async () => {
    const query1 = `
      UPDATE races
      SET race_name      = ?,
          race_type      = ?,
          is_individual  = ?,
          is_team        = ?,
          is_training    = ?,
          is_seeding     = ?,
          women_separate = ?,
          number_runs    = ?,
          venue          = ?,
          course_name    = ?,
          race_date      = ?,
          chief_of_race  = ?,
          tech_delegate  = ?,
          referee        = ?,
          asst_referee   = ?,
          temp_start     = ?,
          temp_finish    = ?,
          snow           = ?,
          weather        = ?,
          homologation   = ?
      WHERE race_id = ?
        AND competition_id = ?
    `;
    const params1 = [
      formData.raceName,
      formData.raceType,
      formData.isIndividual,
      formData.isTeam,
      formData.isTraining,
      formData.isSeeding,
      formData.womenSeparate,
      formData.numberRuns,
      formData.venue,
      formData.courseName,
      formData.raceDate,
      formData.chiefOfRace,
      formData.techDelegate,
      formData.referee,
      formData.asstReferee,
      formData.tempStart,
      formData.tempFinish,
      formData.snow,
      formData.weather,
      formData.homologation,
      raceId,
      competitionId,
    ];
    try {
      await window.api.insert(query1, params1);
      const promises = [];
      for (let i = 0; i < formData.numberRuns; i++) {
        const existingRunQuery = `
        SELECT run_id
        FROM race_run
        WHERE race_id = ? AND competition_id = ? AND run_number = ?
        `;
        const existingRunParams = [raceId, competitionId, i + 1];
        promises.push(
          window.api
            .select(existingRunQuery, existingRunParams)
            .then((result) => {
              if (result.length === 0) {
                return createNewRun(raceId, competitionId, i + 1);
              }
            }),
        );
      }
      await Promise.all(promises);
      navigate(`/competition/${competitionId}/race/${raceId}`);
    } catch (error) {
      console.error('Failed to update race:', error);
    }
  };

  const newRace = async () => {
    const id = uuid4();
    const query = `
      INSERT INTO races
      (competition_id, race_id, race_name, race_type, is_individual, is_team,
       is_training, is_seeding, women_separate, number_runs, venue, course_name,
       race_date, chief_of_race, tech_delegate, referee, asst_referee, temp_start,
       temp_finish, snow, weather, homologation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      competitionId,
      id,
      formData.raceName,
      formData.raceType,
      formData.isIndividual,
      formData.isTeam,
      formData.isTraining,
      formData.isSeeding,
      formData.womenSeparate,
      formData.numberRuns,
      formData.venue,
      formData.courseName,
      formData.raceDate,
      formData.chiefOfRace,
      formData.techDelegate,
      formData.referee,
      formData.asstReferee,
      formData.tempStart,
      formData.tempFinish,
      formData.snow,
      formData.weather,
      formData.homologation,
    ];
    try {
      await window.api.insert(query, params);
      const promisesToAwait = [];
      for (let i = 0; i < formData.numberRuns; i++) {
        promisesToAwait.push(createNewRun(id, competitionId, i + 1));
      }
      await Promise.all(promisesToAwait);
    } catch (error) {
      console.error('Failed to create race:', error);
    }
    navigate(`/competition/${competitionId}/race`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editMode) {
      updateRace();
    } else {
      newRace();
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              label="Race Name"
              variant="outlined"
              fullWidth
              name="raceName"
              value={formData.raceName}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="raceType-label">Race Type</InputLabel>
              <Select
                labelId="raceType-label"
                id="raceType"
                name="raceType"
                value={formData.raceType}
                onChange={handleChange}
                label="Race Type"
                required
              >
                <MenuItem value="SL">Slalom</MenuItem>
                <MenuItem value="GS">Giant Slalom</MenuItem>
                <MenuItem value="SG">SuperG</MenuItem>
                <MenuItem value="DH">Downhill</MenuItem>
                <MenuItem value="AC">Alpine Combined</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isIndividual}
                  onChange={handleChange}
                  name="isIndividual"
                />
              }
              label="Is this an Individual Race?"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isTeam}
                  onChange={handleChange}
                  name="isTeam"
                />
              }
              label="Is this a Team Race?"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isSeeding}
                  onChange={handleChange}
                  name="isSeeding"
                />
              }
              label="Is this a Seeding Race?"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isTraining}
                  onChange={handleChange}
                  name="isTraining"
                />
              }
              label="Is this a Training Race?"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.womenSeparate}
                  onChange={handleChange}
                  name="womenSeparate"
                />
              }
              label="Do women race separately?"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Venue"
              variant="outlined"
              fullWidth
              name="venue"
              value={formData.venue}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Course Name"
              variant="outlined"
              fullWidth
              name="courseName"
              value={formData.courseName}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Number of Runs"
              variant="outlined"
              fullWidth
              type="number"
              name="numberRuns"
              value={formData.numberRuns}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Race Date"
              variant="outlined"
              fullWidth
              name="raceDate"
              type="date"
              value={formData.raceDate}
              onChange={handleChange}
              InputLabelProps={{
                shrink: true,
              }}
              required
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Start Temperature"
              variant="outlined"
              type="number"
              fullWidth
              name="tempStart"
              value={formData.tempStart}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Finish Temperature"
              variant="outlined"
              type="number"
              fullWidth
              name="tempFinish"
              value={formData.tempFinish}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Weather"
              variant="outlined"
              fullWidth
              name="weather"
              value={formData.weather}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Snow"
              variant="outlined"
              fullWidth
              name="snow"
              value={formData.snow}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Homologation"
              variant="outlined"
              fullWidth
              name="homologation"
              value={formData.homologation}
              onChange={handleChange}
            />
          </Grid>
          {/* Chief of Race */}
          <Grid item xs={11}>
            <Autocomplete
              {...autoCompleteProps}
              id="chiefOfRace"
              name="chiefOfRace"
              onChange={handleAutocompleteChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Chief of Race"
                  inputProps={{
                    ...params.inputProps,
                  }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value}
            />
          </Grid>
          <Grid item xs={1}>
            <IconButton onClick={() => handleOpenModal('chiefOfRace')}>
              <AddIcon />
            </IconButton>
          </Grid>

          {/* Technical Delegate */}
          <Grid item xs={11}>
            <Autocomplete
              {...autoCompleteProps}
              id="techDelegate"
              name="techDelegate"
              onChange={handleAutocompleteChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Technical Delegate"
                  inputProps={{
                    ...params.inputProps,
                  }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value}
            />
          </Grid>
          <Grid item xs={1}>
            <IconButton onClick={() => handleOpenModal('techDelegate')}>
              <AddIcon />
            </IconButton>
          </Grid>

          {/* Referee */}
          <Grid item xs={11}>
            <Autocomplete
              {...autoCompleteProps}
              id="referee"
              name="referee"
              onChange={handleAutocompleteChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Referee"
                  inputProps={{
                    ...params.inputProps,
                  }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value}
            />
          </Grid>
          <Grid item xs={1}>
            <IconButton onClick={() => handleOpenModal('referee')}>
              <AddIcon />
            </IconButton>
          </Grid>

          {/* Assistant Referee */}
          <Grid item xs={11}>
            <Autocomplete
              {...autoCompleteProps}
              id="asstReferee"
              name="asstReferee"
              onChange={handleAutocompleteChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="AssistantReferee"
                  inputProps={{
                    ...params.inputProps,
                  }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value}
            />
          </Grid>
          <Grid item xs={1}>
            <IconButton onClick={() => handleOpenModal('asstReferee')}>
              <AddIcon />
            </IconButton>
          </Grid>

          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full"
            >
              {editMode ? 'Update Race Details' : 'Save Race'}
            </Button>
          </Grid>
        </Grid>
      </form>
      <PersonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSavePerson}
      />
    </>
  );
}

export default RaceForm;
