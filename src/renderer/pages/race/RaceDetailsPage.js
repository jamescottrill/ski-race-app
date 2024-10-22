import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Paper, Typography, Button, List, ListItem, ListItemText, Grid } from '@mui/material';

export default function RaceDetailsPage() {
  const { competitionId, raceId } = useParams();
  const [raceDetails, setRaceDetails] = useState(null);

  useEffect(() => {
    fetchRaceDetails();
  }, []);

  const fetchRaceDetails = async () => {
    try {
      const query = `
        SELECT race_name, race_type, race_date, venue, number_runs, is_team, women_separate
        FROM races
        WHERE race_id = ? AND competition_id = ?
      `;
      const params = [raceId, competitionId];
      const result = await window.api.select(query, params);

      if (result && result[0]) {
        setRaceDetails(result[0]);
      } else {
        console.error('Race details not found');
      }
    } catch (error) {
      console.error('Failed to fetch race details:', error);
    }
  };

  return (
    <Container className="race-details-page flex flex-col items-center justify-center min-h-screen">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-xl">
        {raceDetails ? (
          <>
            <Typography variant="h4" component="h1" className="mb-6 text-gray-800 font-bold text-center">
              {raceDetails.race_name}
            </Typography>
            <List>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <ListItem>
                  <ListItemText primary="Discipline" secondary={raceDetails.race_type} />
                </ListItem>
              </Grid>
              <Grid item xs={4}>
              <ListItem>
                <ListItemText primary="Date" secondary={new Date(raceDetails.race_date).toLocaleDateString()} />
              </ListItem>
              </Grid>
              <Grid item xs={4}>
              <ListItem>
                <ListItemText primary="Venue" secondary={raceDetails.venue} />
              </ListItem>
              </Grid>
              <Grid item xs={4}>
              <ListItem>
                <ListItemText primary="Runs" secondary={raceDetails.number_runs} />
              </ListItem>
              </Grid>
              <Grid item xs={4}>
              <ListItem>
                <ListItemText primary="Team Race" secondary={raceDetails.is_team ? 'Yes' : 'No'} />
              </ListItem>
              </Grid>
            </Grid>
            </List>

            <div className="action-buttons flex flex-col mt-6 space-y-4">
              <Button
                variant="contained"
                color="primary"
                component={Link}
                to={`/competition/${competitionId}/race/${raceId}/start-list`}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg"
              >
                View Start List
              </Button>
              <Button
                variant="contained"
                color="secondary"
                component={Link}
                to={`/competition/${competitionId}/race/${raceId}/results/edit`}
                className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded shadow-lg"
              >
                Record Results
              </Button>
            </div>
          </>
        ) : (
          <Typography variant="h6" component="h2" className="text-gray-800 font-bold text-center">
            Loading race details...
          </Typography>
        )}
      </Paper>
    </Container>
  );
}
