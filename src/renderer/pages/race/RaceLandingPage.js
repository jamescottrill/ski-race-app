import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Container,
  Button,
} from '@mui/material';
import { useBackButton } from '../../utils/navigation';

export default function RaceLandingPage() {
  const [races, setRaces] = useState([]);
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  const fetchRaces = async () => {
    const query = `
      SELECT race_id AS id, race_name, race_type, is_team, race_date, venue, number_runs
      FROM races
      WHERE competition_id = ?
    `;
    const params = [competitionId];

    try {
      const result = await window.api.select(query, params);
      setRaces(result);
    } catch (error) {
      console.error('Failed to fetch races:', error);
    }
  };

  const handleEditRace = (raceId) => {
    navigate(`/competition/${competitionId}/race/${raceId}/edit`);
  };

  const handleViewRace = (raceId) => {
    navigate(`/competition/${competitionId}/race/${raceId}`);
  };
  //
  // const handleViewResults = (raceId) => {
  //   navigate(`/competition/${competitionId}/race/${raceId}/results`);
  // };

  const handleNewRace = () => {
    navigate(`/competition/${competitionId}/race/new`);
  };

  useEffect(() => {
    fetchRaces();
  }, []);

  return (
    <Container className="race-landing-page flex flex-col items-center justify-center min-h-screen  w-full max-w-full">
      <Paper>
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Races
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={handleNewRace}
          className="text-white py-2 px-4 rounded shadow-lg flex ml-auto mr-3"
        >
          New Race
        </Button>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Race Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Venue</TableCell>
                <TableCell>Number of Runs</TableCell>
                <TableCell>Actions</TableCell>{' '}
                {/* Actions column for buttons */}
              </TableRow>
            </TableHead>
            <TableBody>
              {races.map((race) => (
                <TableRow key={race.id}>
                  <TableCell>{race.race_name}</TableCell>
                  <TableCell>{race.race_type}</TableCell>
                  <TableCell>{race.is_team ? 'Team' : 'Individual'}</TableCell>
                  <TableCell>{race.race_date}</TableCell>
                  <TableCell>{race.venue}</TableCell>
                  <TableCell>{race.number_runs}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleViewRace(race.id)}
                      className="mr-2"
                    >
                      View
                    </Button>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => handleEditRace(race.id)}
                      className="mr-2"
                    >
                      Edit
                    </Button>

                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
