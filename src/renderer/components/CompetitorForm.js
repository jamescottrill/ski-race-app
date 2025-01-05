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

function CompetitorForm({
  editMode= true,
  competitorId,
  existingCompetitor,
  competitionId,
}) {
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
    arrivalSeed: 2000,
    isNovice: false,
    isJunior: false,
    isSenior: false,
    isVeteran: false,
    isReserve: false,
    isFemale: false,
    regiment: '',
  };
  const [formData, setFormData] = useState(initialData);
  const [modalOpen, setModalOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeamField, setSelectedTeamField] = useState(null);

  const fetchTeam = async () => {
    const query = `SELECT team_id, team_name FROM competition_team WHERE competition_id = ?`;
    try {
      const result = await window.api.select(query, [competitionId]);
      setTeams(result);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const handleDeleteCompetitor = async () => {
    const query = `DELETE FROM competition_competitor WHERE racer_id = ? AND competition_id = ?`;
    const params = [competitorId, competitionId];
    try {
      await window.api.delete(query, params);
    } catch (error) {
      console.error('Failed to delete competitor:', error);
    }
    const query2 = `DELETE FROM competition_team_members WHERE racer_id = ? AND competition_id = ?`;
    const params2 = [competitorId, competitionId];
    try {
      await window.api.delete(query2, params2);
      navigate(-1);
    } catch (error) {
      console.error('Failed to remove competitor from team.', error);
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
    if (!existingCompetitor) {
      // If this is an existing person
      query = `
        SELECT p.*,
               0 AS arrival_corps_seed,
               FALSE AS is_junior,
               FALSE AS is_senior,
               FALSE AS is_veteran,
               FALSE AS is_reserve,
               FALSE AS is_female,
               NULL  AS team
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
               cc.title,
               ct.team_id AS team,
               cc.is_junior,
               cc.is_senior,
               cc.is_veteran,
               cc.is_reserve,
               cc.is_female,
               cc.arrival_corps_seed,
               cc.regiment
        FROM people p
         LEFT JOIN competition_competitor cc ON p.id = cc.racer_id
         LEFT JOIN competition_team_members ctm ON ctm.racer_id = p.id AND  ctm.competition_id = cc.competition_id
         LEFT JOIN competition_team ct ON ct.team_id = ctm.team_id
        WHERE p.id = ? AND cc.competition_id = ?
        AND NOT COALESCE(ct.is_female, FALSE) AND NOT COALESCE(ct.is_corps, FALSE) AND NOT COALESCE(ct.is_hc, FALSE)
      `;
      console.log(query);
      console.log(competitorId);
      console.log(competitionId);
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
          arrivalSeed: result[0].arrival_corps_seed || 2000,
          isJunior: result[0].is_junior || false,
          isSenior: result[0].is_senior || false,
          isVeteran: result[0].is_veteran || false,
          isReserve: result[0].is_reserve || false,
          isFemale: result[0].gender === 'F',
          regiment: result[0].regiment || '',
        });
        console.log(result[0]);
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
        (competition_id, racer_id, arrival_corps_seed, is_novice, is_junior,
         is_senior, is_veteran, is_reserve, is_female, title, regiment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params2 = [
        competitionId,
        id,
        formData.arrivalSeed,
        formData.isNovice,
        isJunior,
        isSenior,
        isVeteran,
        formData.isReserve,
        formData.isFemale,
        formData.title,
        formData.regiment,
      ];

      await window.api.insert(query2, params2);

      const query3 = `
      INSERT INTO competition_team_members (competition_id, team_id, racer_id) VALUES (?, ?, ?)
      `;
      const params3 = [competitionId, formData.team, id];
      await window.api.insert(query3, params3);
      await insertNewCompetitorExistingRaces(competitorId);
      navigate(`/competition/${competitionId}/competitor/manage`);
    } catch (error) {
      console.error('Failed to create competitor:', error);
    }
  };

  const insertNewCompetitorExistingRaces = async () => {
    //   This is used to add a competitor into races retrospectively.
    //   The competitor will be recorded as DNS, with bib 999.
    const races = await window.api.select(`
    SELECT
      DISTINCT
      rc.race_id
      , r.number_runs
    FROM race_competitor rc
      LEFT JOIN races r ON r.race_id = rc.race_id
      LEFT JOIN race_run rr ON rr.race_id = rc.race_id AND rr.run_number = 1
    WHERE rc.competition_id = ? AND rr.is_complete`, [competitionId]);
    if (races.length === 0) {
      return;
    }
    const promises = [];
    races.forEach((race) => {
      const query = `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number, seed_points) VALUES (?, ?, ?, ?, ?)`;
      const params = [competitionId, race.race_id, competitorId, 999, null];
      promises.push(window.api.insert(query, params));
      const query2 = `INSERT INTO race_results (competition_id, race_id, run_number, racer_id, is_dns) VALUES (?, ?, ?, ?, ?)`;
      const params2 = [competitionId, race.race_id, 1, competitorId, true];
      promises.push(window.api.insert(query2, params2));
      if (race.numberRuns === 2) {
        const params3 = [competitionId, race.race_id, 2, competitorId, true];
        promises.push(window.api.insert(query2, params3));
      }
    });
    Promise.all(promises).catch((error) => {
      console.error('Failed to insert new competitor into races:', error);
    });
  };

  const registerNewCompetitor = async () => {
    let { isJunior, isVeteran } = false;
    let isSenior = true;
    if (formData.dob) {
      ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(formData.dob));
    }
    try {
      const query2 = `
        INSERT INTO competition_competitor
        (competition_id, racer_id, arrival_corps_seed, is_novice, is_junior,
         is_senior, is_veteran, is_reserve, is_female, title, regiment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params2 = [
        competitionId,
        competitorId,
        formData.arrivalSeed,
        formData.isNovice,
        isJunior,
        isSenior,
        isVeteran,
        formData.isReserve,
        formData.isFemale,
        formData.title,
        formData.regiment,
      ];

      await window.api.insert(query2, params2);

      const query3 = `
      INSERT INTO competition_team_members (competition_id, team_id, racer_id) VALUES (?, ?, ?)
      `;
      const params3 = [competitionId, formData.team, competitorId];
      await window.api.insert(query3, params3);
      await insertNewCompetitorExistingRaces(competitorId);


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
      let isJunior = false;
      let isVeteran = false;
      let isSenior = true;
      if (formData.dob) {
        ({ isJunior, isSenior, isVeteran } = calculateAgeCategory(
          formData.dob,
        ));
      }
      const query2 = `
          UPDATE competition_competitor
          SET arrival_corps_seed = ?,
              is_novice    = ?,
              is_junior    = ?,
              is_senior    = ?,
              is_veteran   = ?,
              is_reserve   = ?,
              is_female    = ?,
              title        = ?,
              regiment     = ?
          WHERE competition_id = ?
            AND racer_id = ?
        `;
      const params2 = [
        formData.arrivalSeed,
        formData.isNovice || false,
        isJunior || false,
        isSenior || false,
        isVeteran || false,
        formData.isReserve || false,
        formData.isFemale || false,
        formData.title,
        formData.regiment || '',
        competitionId,
        competitorId,
      ];
      await window.api.insert(query2, params2);
      const primaryTeam = await window.api.select(
        `
      SELECT ctm.team_id
      FROM competition_team_members ctm
      LEFT JOIN competition_team ct USING(team_id, competition_id)
      WHERE racer_id = ?
        AND competition_id = ?
        AND NOT COALESCE(ct.is_hc, FALSE)
        AND NOT COALESCE(ct.is_corps, FALSE)
        AND NOT COALESCE(ct.is_female, FALSE)
      `,
        [competitorId, competitionId],
      );
      let query3;
      if (primaryTeam && primaryTeam.length > 0) {
        query3 = `
        UPDATE competition_team_members
        SET team_id = ?
        WHERE competition_id = ?
          AND racer_id = ?
      `;
      } else {
        query3 = `INSERT INTO main.competition_team_members (team_id, competition_id, racer_id) VALUES (?,?,?)`;
      }
      const params3 = [formData.team, competitionId, competitorId];
      await window.api.insert(query3, params3);
      await insertNewCompetitorExistingRaces(competitorId);
      navigate(-1);
    } catch (error) {
      console.error('Failed to update competitor:', error);
    }
  };

  useEffect(() => {
    fetchTeam();
    if (competitorId) {
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
      if (competitorId) {
        await registerNewCompetitor();
      } else {
        await createCompetitor();
      }
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
              // required
              // disabled={existingCompetitor}
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
              label="Regiment"
              variant="outlined"
              fullWidth
              name="regiment"
              value={formData.regiment}
              onChange={handleChange}
            />
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
                ? 'Update Competitor'
                : 'Register Competitor'}
            </Button>
            {editMode && (
            <Button
            variant="contained"
            color="secondary"
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full my-2"
            onClick={handleDeleteCompetitor}
          >
            Delete Competitor
          </Button>
            )}
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
