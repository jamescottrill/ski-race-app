import React, { useState, useEffect } from 'react';
import {
  Modal,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  Checkbox,
  FormControlLabel,
  Autocomplete,
} from '@mui/material';
import { useParams } from 'react-router-dom';

export default function EditTeamModal({ open, onClose, onError, teamId }) {
  const initialFormValues = {
    teamName: '',
    isCorpsTeam: false,
    isFemaleTeam: false,
    isHCTeam: false,
    selectedCompetitors: [],
  };

  const [formData, setFormData] = useState(initialFormValues);
  const [availableCompetitors, setAvailableCompetitors] = useState([]);
  const { competitionId } = useParams();

  const fetchAvailableCompetitors = async () => {
    try {
      const result = await window.api.select(
        `
        SELECT
          DISTINCT
          p.id, p.first_name, p.last_name
        FROM people p
        LEFT OUTER JOIN competition_team_members ctm ON p.id = ctm.racer_id
        LEFT OUTER JOIN competition_team ct ON ctm.team_id = ct.team_id
        WHERE ct.team_id != ? OR Ct.team_id IS NULL
        ORDER BY first_name
      `,
        [teamId],
      );

      setAvailableCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch available competitors:', error);
    }
  };

  const fetchTeamCompetitors = async () => {
    try {
      const result = await window.api.select(
        `
        SELECT p.id, p.first_name, p.last_name
        FROM people p
       JOIN competition_team_members ctm ON p.id = ctm.racer_id
        WHERE ctm.competition_id = ? AND ctm.team_id = ?
      `,
        [competitionId, teamId],
      );
      setFormData((prev) => ({
        ...prev,
        selectedCompetitors: result,
      }));
    } catch (error) {
      console.error('Failed to fetch team competitors:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const getTeam = async () => {
    const query = `
    SELECT
    team_id,
    team_name,
    is_corps,
    is_female,
    is_hc,
    is_reserve
    FROM competition_team
    WHERE competition_id = ? AND team_id = ?
    `;
    const variables = [competitionId, teamId];
    const result = await window.api.select(query, variables);
    const team = result[0];
    setFormData({
      teamName: team.team_name || '',
      isCorpsTeam: team.is_corps || false,
      isFemaleTeam: team.is_female || false,
      isHCTeam: team.is_hc || false,
      isReserveTeam: team.is_reserve || false,
      selectedCompetitors: [], // Fetch these later
    });
  };

  useEffect(() => {
    if (teamId) {
      getTeam();
      fetchAvailableCompetitors();
      fetchTeamCompetitors();
    }
  }, [competitionId, teamId]);

  const handleCompetitorChange = (event, newValues) => {
    setFormData({
      ...formData,
      selectedCompetitors: newValues,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // First, check if there is a team with that name already. We don't want
    // two teams with the same name in the competition.
    const checkQuery = `
    SELECT COUNT(*) AS teamExists
    FROM competition_team
    WHERE competition_id = ?
      AND team_id != ?
      AND team_name = ?
    `;
    const checkParams = [competitionId, teamId, formData.teamName];

    try {
      const result = await window.api.select(checkQuery, checkParams);
      if (result[0].teamExists > 0) {
        onError('A team with this name already exists.');
        return;
      }
    } catch (error) {
      console.error('Failed to update team:', error);
      return;
    }

    // Save team changes
    const query = `
      UPDATE competition_team
      SET team_name = ?, is_corps = ?, is_female = ?, is_hc = ?, is_reserve = ?
      WHERE competition_id = ? AND team_id = ?
    `;
    const params = [
      formData.teamName,
      formData.isCorpsTeam,
      formData.isFemaleTeam,
      formData.isHCTeam,
      formData.isReserveTeam,
      competitionId,
      teamId,
    ];

    try {
      await window.api.insert(query, params);
    } catch (error) {
      console.error('Failed to update team:', error);
    }
    await window.api.insert(
      `DELETE FROM competition_team_members WHERE competition_id = ? AND team_id = ?`,
      [competitionId, teamId],
    );
    const updates = [];
    for (const competitor of formData.selectedCompetitors) {
      let query = `
      INSERT INTO competition_team_members (competition_id, team_id, racer_id)
      VALUES (?, ?, ?)
    `;
      let params = [competitionId, teamId, competitor.id];
      updates.push(window.api.insert(query, params));
    }
    await Promise.all(updates);

    onClose({ message: `${formData.teamName} was updated successfully` }); // Close the modal
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
        }}
      >
        <Typography variant="h6" component="h2" gutterBottom>
          Edit Team
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Team Name"
              name="teamName"
              value={formData.teamName}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  name="isCorpsTeam"
                  checked={formData.isCorpsTeam}
                  onChange={handleChange}
                />
              }
              label="Corps Team?"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  name="isFemaleTeam"
                  checked={formData.isFemaleTeam}
                  onChange={handleChange}
                />
              }
              label="Female Team?"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  name="isHCTeam"
                  checked={formData.isHCTeam}
                  onChange={handleChange}
                />
              }
              label="HC Team?"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  name="isReserveTeam"
                  checked={formData.isReserveTeam}
                  onChange={handleChange}
                />
              }
              label="Reserve Team?"
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              multiple
              id="competitors"
              options={availableCompetitors}
              getOptionLabel={(option) =>
                `${option.first_name} ${option.last_name}`
              }
              value={formData.selectedCompetitors}
              onChange={handleCompetitorChange}
              disablePortal
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Competitors"
                  placeholder="Add or remove competitors"
                  fullWidth
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Save Changes
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Modal>
  );
}
