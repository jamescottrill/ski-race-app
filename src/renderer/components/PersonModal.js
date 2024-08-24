import React, { useState } from 'react';
import {
  Modal,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  InputLabel,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import { v4 as uuid4 } from 'uuid';

export default function PersonModal({ open, onClose, onSave }) {
  const initialFormValues = {
    firstName: '',
    lastName: '',
    title: '',
    dob: '',
    country: 'GBR',
    serviceNumber: '',
    gender: 'M',
  };
  const [formData, setFormData] = useState(initialFormValues);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = uuid4();

    const query = `
      INSERT INTO people (id, first_name, last_name, title, dob, country, service_number, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
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
      const result = await window.api.insert(query, params);
      onSave(id); // Pass the new person's ID to the parent
      setFormData(initialFormValues);
      onClose(); // Close the modal
    } catch (error) {
      console.error('Failed to add person:', error);
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
          Add New Person
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Date of Birth"
              name="dob"
              type="date"
              value={formData.dob}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Service Number"
              name="serviceNumber"
              value={formData.serviceNumber}
              onChange={handleChange}
              fullWidth
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
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Save
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Modal>
  );
}
