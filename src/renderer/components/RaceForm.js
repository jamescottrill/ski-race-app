import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Grid,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuid4 } from 'uuid';
import { useBackButton } from '../utils/navigation';

function CompetitorForm({ editMode, raceId }) {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    title: '',
    dob: '',
    country: '',
    serviceNumber: '',
    gender: '',
    team: '',
    arrivalArmySeed: '',
    arrivalCorpsSeed: '',
    isNovice: false,
    isJunior: false,
    isSenior: false,
    isVeteran: false,
    isReserve: false,
    isFemale: false,
    isHC: false,
  });

  const handleBack = useBackButton();

  const fetchRaceDetails = async () => {
    if (!raceID) {
      console.error('No race ID provided');
      return;
    }

    // Fetch competitor details using the competitorId
    const query = `
      SELECT p.*, cc.team, cc.arrival_army_seed, cc.arrival_corps_seed, cc.is_junior,
             cc.is_senior, cc.is_veteran, cc.is_reserve, cc.is_female, cc.is_hc
      FROM people p
             LEFT JOIN competition_competitor cc ON p.id = cc.racer_id
      WHERE p.id = ? AND cc.competition_id = ?
    `;
    const params = [competitorId, competitionId];

    try {
      const result = await window.api.select(query, params);
      if (result && result[0]) {
        setFormData({
          firstName: result[0].first_name,
          lastName: result[0].last_name,
          title: result[0].title,
          dob: result[0].dob,
          country: result[0].country,
          serviceNumber: result[0].service_number,
          gender: result[0].gender,
          team: result[0].team,
          arrivalArmySeed: result[0].arrival_army_seed,
          arrivalCorpsSeed: result[0].arrival_corps_seed,
          isJunior: result[0].is_junior || false,
          isSenior: result[0].is_senior || false,
          isVeteran: result[0].is_veteran || false,
          isReserve: result[0].is_reserve || false,
          isFemale: result[0].gender === 'F',
          isHC: result[0].is_hc || false,
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
    const { isJunior, isVeteran } = false;
    const isSenior = true;
    if (formData.dob) {
      const { isJunior, isSenior, isVeteran } = calculateAgeCategory(
        formData.dob,
      );
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
      const result = await window.api.insert(query1, params1);

      const query2 = `
        INSERT INTO competition_competitor
        (competition_id, racer_id, team, arrival_army_seed, arrival_corps_seed, is_novice, is_junior,
         is_senior, is_veteran, is_reserve, is_female, is_hc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params2 = [
        competitionId,
        id,
        formData.team,
        formData.arrivalArmySeed,
        formData.arrivalCorpsSeed,
        formData.isNovice,
        isJunior,
        isSenior,
        isVeteran,
        formData.isReserve,
        formData.isFemale,
        formData.isHC,
      ];

      await window.api.insert(query2, params2);
      navigate(`/competition/${competitionId}/competitor/manage`);
    } catch (error) {
      console.error('Failed to create competitor:', error);
    }
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

      const query2 = `
        UPDATE competition_competitor
        SET team = ?, arrival_army_seed = ?, arrival_corps_seed = ?, is_novice = ?, is_junior = ?, is_senior = ?,
            is_veteran = ?, is_reserve = ?, is_female = ?, is_hc = ?
        WHERE competition_id = ? AND racer_id = ?
      `;
      const params2 = [
        formData.team,
        formData.arrivalArmySeed,
        formData.arrivalCorpsSeed,
        formData.isNovice || false,
        formData.isJunior || false,
        formData.isSenior || false,
        formData.isVeteran || false,
        formData.isReserve || false,
        formData.isFemale || false,
        formData.isHC || false,
        competitionId,
        competitorId,
      ];

      await window.api.insert(query2, params2);

      navigate(-1);
    } catch (error) {
      console.error('Failed to update competitor:', error);
    }
  };

  useEffect(() => {
    if (editMode && competitorId) {
      fetchCompetitorDetails();
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
            >
              <MenuItem value="M">Male</MenuItem>
              <MenuItem value="F">Female</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Team"
            variant="outlined"
            fullWidth
            name="team"
            value={formData.team}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Arrival Army Seed Points"
            variant="outlined"
            fullWidth
            name="arrivalArmySeed"
            value={formData.arrivalArmySeed}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Arrival Corps Seed Points"
            variant="outlined"
            fullWidth
            name="arrivalCorpsSeed"
            value={formData.arrivalCorpsSeed}
            onChange={handleChange}
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
          <FormControlLabel
            control={
              <Checkbox
                name="isHC"
                checked={formData.isHC}
                onChange={handleChange}
              />
            }
            label="Hors-Concours Team?"
          />
        </Grid>

        <Grid item xs={12}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full my-2"
          >
            {editMode ? 'Update Competitor' : 'Register Competitor'}
          </Button>
        </Grid>
      </Grid>
    </form>
  );
}

export default CompetitorForm;
