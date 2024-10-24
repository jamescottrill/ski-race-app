import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  Grid,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuid4 } from 'uuid';
import AddIcon from '@mui/icons-material/Add';
import TeamModal from './TeamModal';

function CompetitorForm({ editMode, competitorId, existingCompetitor }) {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const initialData = {
    firstName: '',
    lastName: '',
    title: '',
    dob: '',
    country: 'GBR',
    serviceNumber: '',
    gender: 'M',
    team: '',
    arrivalSeed: '',
    isNovice: false,
    isJunior: false,
    isSenior: false,
    isVeteran: false,
    isReserve: false,
    isFemale: false,
  };
  const [formData, setFormData] = useState(initialData);
  const [modalOpen, setModalOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeamField, setSelectedTeamField] = useState(null);

  const fetchTeam = async () => {
    const query = `SELECT team_id, team_name FROM competition_team`;
    try {
      const result = await window.api.select(query);
      setTeams(result);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const handleSaveTeam = async (teamId) => {
    await fetchTeam(); // Refresh the list of people after adding a new one
    setFormData({
      ...formData,
      [selectedTeamField]: teamId, // Automatically select the new team
    });
    setModalOpen(false); // Close the modal after saving
  };

  const calculateAgeCategory = (dob) => {
    const currentYear = new Date().getFullYear();
    const birthYear = new Date(dob).getFullYear();
    const age = currentYear - birthYear;

    return {
      isJunior: age < 20,
      isSenior: age >= 20 && age < 35,
      isVeteran: age >= 35,
    };
  };

  const fetchCompetitorDetails = async () => {
    if (!competitorId) {
      console.error('No competitor ID provided');
      return;
    }

    // Fetch competitor details using the competitorId
    let query;
    let params;
    if (existingCompetitor) {
      query = `
        SELECT p.*,
               NULL AS team,
               NULL AS arrival_seed,
               NULL AS is_junior,
               NULL AS is_senior,
               NULL AS is_veteran,
               NULL AS is_reserve,
               NULL AS is_female
        FROM people p
        WHERE p.id = ?`;
      params = [competitorId];
    } else {
      query = `
        SELECT p.first_name,
               p.last_name,
               p.dob,
               p.id,
               p.country,
               p.service_number,
               p.gender,
               COALESCE(cc.title, p.title) AS title,
               cc.team,
               cc.arrival_seed,
               cc.is_junior,
               cc.is_senior,
               cc.is_veteran,
               cc.is_reserve,
               cc.is_female
        FROM people p
         LEFT JOIN competition_competitor cc ON p.id = cc.racer_id
        WHERE p.id = ? AND cc.competition_id = ?
      `;
      params = [competitorId, competitionId];
    }
    try {
      const result = await window.api.select(query, params);
      if (result && result[0]) {
        setFormData({
          firstName: result[0].first_name,
          lastName: result[0].last_name,
          title: result[0].title || '',
          dob: result[0].dob,
          country: result[0].country || 'GBR',
          serviceNumber: result[0].service_number || '',
          gender: result[0].gender || 'M',
          team: result[0].team || '',
          arrivalSeed: result[0].arrival_seed || '',
          isJunior: result[0].is_junior || false,
          isSenior: result[0].is_senior || false,
          isVeteran: result[0].is_veteran || false,
          isReserve: result[0].is_reserve || false,
          isFemale: result[0].gender === 'F',
        });
      } else {
        console.error('Competitor not found');
      }
    } catch (error) {
      console.error('Failed to fetch competitor details:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Update formData based on user input
    const updatedFormData = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    };

    // If the date of birth changes, recalculate novice and veteran status
    if (name === 'dob') {
      const { isJunior, isSenior, isVeteran } = calculateAgeCategory(value);
      updatedFormData.isJunior = isJunior;
      updatedFormData.isSenior = isSenior;
      updatedFormData.isVeteran = isVeteran;
    }

    setFormData(updatedFormData);
  };

  const createCompetitor = async () => {
    let { isJunior, isVeteran } = false;
    let isSenior = true;
    if (formData.dob) {
      ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(formData.dob));
    }
    const id = uuid4();

    const query1 = `
      INSERT INTO people (id, first_name, last_name, title, dob, country, service_number, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params1 = [
      id,
      formData.firstName,
      formData.lastName,
      formData.title,
      formData.dob,
      formData.country,
      formData.serviceNumber,
      formData.gender,
    ];

    try {
      await window.api.insert(query1, params1);

      const query2 = `
        INSERT INTO competition_competitor
        (competition_id, racer_id, team, arrival_seed, is_novice, is_junior,
         is_senior, is_veteran, is_reserve, is_female, title)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params2 = [
        competitionId,
        id,
        formData.team,
        formData.arrivalSeed,
        formData.isNovice,
        isJunior,
        isSenior,
        isVeteran,
        formData.isReserve,
        formData.isFemale,
        formData.title
      ];

      await window.api.insert(query2, params2);
      navigate(`/competition/${competitionId}/competitor/manage`);
    } catch (error) {
      console.error('Failed to create competitor:', error);
    }
  };

  const handleOpenModal = (field) => {
    setSelectedTeamField(field);
    setModalOpen(true);
  };

  const updateCompetitor = async () => {
    const query1 = `
      UPDATE people
      SET first_name = ?, last_name = ?, title = ?, dob = ?, country = ?, service_number = ?, gender = ?
      WHERE id = ?
    `;
    const params1 = [
      formData.firstName,
      formData.lastName,
      formData.title,
      formData.dob,
      formData.country,
      formData.serviceNumber,
      formData.gender,
      competitorId,
    ];

    try {
      await window.api.insert(query1, params1);
      let query2;
      let params2;
      if (existingCompetitor) {
        let isJunior = false;
        let isVeteran = false;
        let isSenior = true;
        if (formData.dob) {
          ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(
            formData.dob,
          ));
        }
        query2 = `
        INSERT INTO competition_competitor
        (competition_id, racer_id, team, arrival_seed, is_novice, is_junior,
          is_senior, is_veteran, is_reserve, is_female, title)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
        params2 = [
          competitionId,
          competitorId,
          formData.team,
          formData.arrivalSeed,
          formData.isNovice,
          isJunior,
          isSenior,
          isVeteran,
          formData.isReserve,
          formData.isFemale,
          formData.title,
        ];
      } else {
        query2 = `
          UPDATE competition_competitor
          SET team         = ?,
              arrival_seed = ?,
              is_novice    = ?,
              is_junior    = ?,
              is_senior    = ?,
              is_veteran   = ?,
              is_reserve   = ?,
              is_female    = ?,
              title        = ?
          WHERE competition_id = ?
            AND racer_id = ?
        `;
        params2 = [
          formData.team,
          formData.arrivalSeed,
          formData.isNovice || false,
          formData.isJunior || false,
          formData.isSenior || false,
          formData.isVeteran || false,
          formData.isReserve || false,
          formData.isFemale || false,
          competitionId,
          competitorId,
          formData.title,
        ];
      }
      await window.api.insert(query2, params2);
      navigate(-1);
    } catch (error) {
      console.error('Failed to update competitor:', error);
    }
  };

  useEffect(() => {
    fetchTeam();
    if (editMode && competitorId) {
      fetchCompetitorDetails();
    } else {
      setFormData(initialData);
    }
  }, [editMode, competitorId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editMode) {
      await updateCompetitor();
    } else {
      await createCompetitor();
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="First Name"
              variant="outlined"
              fullWidth
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              disabled={existingCompetitor}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Last Name"
              variant="outlined"
              fullWidth
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              disabled={existingCompetitor}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Title/Rank"
              variant="outlined"
              fullWidth
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Date of Birth"
              variant="outlined"
              fullWidth
              name="dob"
              type="date"
              value={formData.dob}
              onChange={handleChange}
              InputLabelProps={{
                shrink: true,
              }}
              required
              disabled={existingCompetitor}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Country"
              variant="outlined"
              fullWidth
              name="country"
              value={formData.country || 'GBR'}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Service Number"
              variant="outlined"
              fullWidth
              name="serviceNumber"
              value={formData.serviceNumber}
              onChange={handleChange}
              required
              disabled={existingCompetitor}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl variant="outlined" fullWidth>
              <InputLabel id="gender-label">Gender</InputLabel>
              <Select
                labelId="gender-label"
                id="gender"
                name="gender"
                value={formData.gender || 'M'}
                onChange={handleChange}
                label="Gender"
                required
                aria-required
                disabled={existingCompetitor}
              >
                <MenuItem value="M">Male</MenuItem>
                <MenuItem value="F">Female</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={11}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="team-label">Team</InputLabel>
              <Select
                labelId="team-label"
                id="team"
                name="team"
                value={formData.team}
                onChange={handleChange}
                label="Team"
                required
              >
                {teams.map((team) => (
                  <MenuItem key={team.team_id} value={team.team_id}>
                    {team.team_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={1}>
            <IconButton onClick={() => handleOpenModal('team')}>
              <AddIcon />
            </IconButton>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Starting Seed Points"
              variant="outlined"
              fullWidth
              name="arrivalSeed"
              value={formData.arrivalSeed}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  name="isNovice"
                  checked={formData.isNovice}
                  onChange={handleChange}
                />
              }
              label="Novice?"
            />
            <FormControlLabel
              control={
                <Checkbox
                  name="isReserve"
                  checked={formData.isReserve}
                  onChange={handleChange}
                />
              }
              label="Reservist?"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full my-2"
            >
              {editMode
                ? existingCompetitor
                  ? 'Register Competitor'
                  : 'Update Competitor'
                : 'Register Competitor'}
            </Button>
          </Grid>
        </Grid>
      </form>
      <TeamModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTeam}
        onError={(e) => window.alert(e.message)}
      />
    </>
  );
}

export default CompetitorForm;
