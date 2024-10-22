import React, { useState } from 'react';
import {
  Modal,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { v4 as uuid4 } from 'uuid';
import { useParams } from 'react-router-dom';

export default function TeamModal({ open, onClose, onSave, onError }) {
  const initialFormValues = {
    newTeamName: '',
    isCorpsTeam: false,
    isReserveTeam: false,
    isFemaleTeam: false,
    isHCTeam: false,
  };
  const [formData, setFormData] = useState(initialFormValues);
  const { competitionId } = useParams();

  const handleChange = (e) => {
    const { name, checked } = e.target;
    setFormData({
      ...formData,
      [name]: checked,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = uuid4();

    const checkQuery = `
    SELECT COUNT(*) AS teamExists
    FROM competition_team
    WHERE TRUE
      AND competition_id = ?
      AND team_name = ?
    `;
    const checkParams = [competitionId, formData.newTeamName];

    try {
      const result = await window.api.select(checkQuery, checkParams);
      const teamCount = result[0].teamExists;
      if (teamCount > 0) {
        onError({ message: 'A team with this name already exists.' });
        return;
      }
    } catch (error) {
      console.error('Failed to add team:', error);
    }

    const query = `
      INSERT INTO competition_team (competition_id, team_id, team_name, is_corps, is_reserve, is_female, is_hc)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      competitionId,
      id,
      formData.newTeamName,
      formData.isCorpsTeam,
      formData.isReserveTeam,
      formData.isFemaleTeam,
      formData.isHCTeam,
    ];

    try {
      const result = await window.api.insert(query, params);
      onSave(id); // Pass the new team's ID to the parent
      setFormData(initialFormValues);
      onClose(); // Close the modal
    } catch (error) {
      console.error('Failed to add team:', error);
    }
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
          width: 400,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
        }}
      >
        <Typography variant="h6" component="h2" gutterBottom>
          Add a new Team
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Team Name"
              name="newTeamName"
              value={formData.newTeamName}
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
                  name="isReserveTeam"
                  checked={formData.isReserveTeam}
                  onChange={handleChange}
                />
              }
              label="Reserve Team?"
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
          <Grid item xs={12}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Save
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Modal>
  );
}
