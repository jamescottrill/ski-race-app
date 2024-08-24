import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Typography,
  Paper,
  Grid,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { v4 as uuid4 } from 'uuid';
import PersonModal from '../../components/PersonModal'; // Import the PersonModal component

export default function EditRacePage() {
  const { competitionId, raceId } = useParams();
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
  }, []);


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const raceId = uuid4();

    const query = `
      INSERT INTO races
      (competition_id, race_id, race_name, race_type, is_individual, is_team, is_training, is_seeding, women_separate, number_runs, venue, course_name, race_date, chief_of_race, tech_delegate, referee, asst_referee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      competitionId,
      raceId,
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
    ];

    try {
      await window.api.insert(query, params);
      navigate(`/competition/${competitionId}/race`);
    } catch (error) {
      console.error('Failed to update race:', error);
    }
  };

  return (
    <Container className="edit-race-page flex flex-col items-center justify-center min-h-screen ">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Create Race
        </Typography>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
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
            <Grid item xs={12}>
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
                  <MenuItem value="Slalom">Slalom</MenuItem>
                  <MenuItem value="Giant Slalom">Giant Slalom</MenuItem>
                  <MenuItem value="SuperG">SuperG</MenuItem>
                  <MenuItem value="Downhill">Downhill</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isSeeding}
                    onChange={handleChange}
                    name="isTraining"
                  />
                }
                label="Is this a Seeding Race?"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12}>
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
            <Grid item xs={12}>
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

            <Grid item xs={12}>
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
            <Grid item xs={12}>
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

            {/* Chief of Race */}
            <Grid item xs={12}>
              <FormControl fillWidth variant="outlined">
                <InputLabel id="chiefOfRace-label">Chief of Race</InputLabel>
                <Select
                  labelId="chiefOfRace-label"
                  id="chiefOfRace"
                  name="chiefOfRace"
                  value={formData.chiefOfRace}
                  onChange={handleChange}
                  label="Chief of Race"
                >
                  {people.map((person) => (
                    <MenuItem key={person.id} value={person.id}>
                      {person.first_name} {person.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton onClick={() => handleOpenModal('chiefOfRace')}>
                <AddIcon />
              </IconButton>
            </Grid>

            {/* Technical Delegate */}
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="techDelegate-label">
                  Technical Delegate
                </InputLabel>
                <Select
                  labelId="techDelegate-label"
                  id="techDelegate"
                  name="techDelegate"
                  value={formData.techDelegate}
                  onChange={handleChange}
                  label="Technical Delegate"
                >
                  {people.map((person) => (
                    <MenuItem key={person.id} value={person.id}>
                      {person.first_name} {person.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton onClick={() => handleOpenModal('techDelegate')}>
                <AddIcon />
              </IconButton>
            </Grid>

            {/* Referee */}
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="referee-label">Referee</InputLabel>
                <Select
                  labelId="referee-label"
                  id="referee"
                  name="referee"
                  value={formData.referee}
                  onChange={handleChange}
                  label="Referee"
                >
                  {people.map((person) => (
                    <MenuItem key={person.id} value={person.id}>
                      {person.first_name} {person.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton onClick={() => handleOpenModal('referee')}>
                <AddIcon />
              </IconButton>
            </Grid>

            {/* Assistant Referee */}
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="asstReferee-label">
                  Assistant Referee
                </InputLabel>
                <Select
                  labelId="asstReferee-label"
                  id="asstReferee"
                  name="asstReferee"
                  value={formData.asstReferee}
                  onChange={handleChange}
                  label="Assistant Referee"
                >
                  {people.map((person) => (
                    <MenuItem key={person.id} value={person.id}>
                      {person.first_name} {person.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
                Create Race
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <PersonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSavePerson}
      />
    </Container>
  );
}
