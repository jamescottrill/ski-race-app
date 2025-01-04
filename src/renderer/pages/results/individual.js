import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  MenuItem,
} from '@mui/material';
import { fetchSeedList } from '../../utils/FetchSeedList';
import { useBackButton } from '../../utils/navigation';
import { generatePDF } from '../../pdfs/SeedList';

export default function IndividualResults() {
  const [results, setResults] = useState([]);
  const [races, setRaces] = useState([]);
  const [selectedRaces, setSelectedRaces] = useState([]);
  const [seedList, setSeedList] = useState([]);
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  const seedListPdf = () => {
    generatePDF(results, races);
  };

  const completedRaces = async () => {
    /*
     */
    const query = `
        SELECT
          DISTINCT rr.race_id AS id, r.race_name AS text, r.race_date AS raceDate, r.is_seeding AS isSeeding
        FROM race_run rr
          INNER JOIN races r ON r.race_id = rr.race_id
        WHERE rr.competition_id = ? AND NOT r.is_training AND rr.is_complete AND r.is_individual
        ORDER BY r.race_date ASC`;
    const res = await window.api.select(query, [competitionId]);
    // setRaces(res);
    return res;
  };

  useEffect(() => {
    const fetchList = async () => {
      const initialRaces = await completedRaces();
      let data;
      if (initialRaces.length > 3) {
        data = await fetchSeedList(
          competitionId,
          initialRaces.filter((e) => !e.isSeeding).map((e) => e.id),
        );
      } else {
        data = await fetchSeedList(
          competitionId,
          initialRaces.map((e) => e.id),
        );
      }
      setRaces(data);
    };
    fetchList();
  }, [competitionId]);

  const handleChange = (event) => {
    const { value } = event.target;
    setSelectedRaces(value);
    const refreshData = async (sRaces) => {
      const fRaces = races.filter((e) => sRaces.includes(e.id));
      let data;
      try {
        data = await fetchSeedList(
          competitionId,
          fRaces.map((e) => e.id),
        );
      } catch (e) {
        console.error(e);
      }
      setSeedList(data);
    };
    refreshData(value);
  };

  return (
    <Container className="seed-list-page flex flex-col items-center justify-top mt-4 min-h-screen">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full">
        <Button variant="contained" onClick={handleBack}>
          Back
        </Button>
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          {/* eslint-disable-next-line no-nested-ternary */}
          {selectedRaces.length === 0
            ? `Select a race to continue`
            : selectedRaces.length === 1
              ? `Seed List after ${selectedRaces.length} Race`
              : `Seed List after ${selectedRaces.length} Races`}
        </Typography>
        <FormControl fullWidth>
          <InputLabel id="multi-select-label">Completed Races</InputLabel>
          <Select
            labelId="multi-select-label"
            multiple
            value={selectedRaces}
            onChange={handleChange}
            renderValue={(selected) =>
              selected
                .map((id) => races.find((option) => option.id === id)?.text)
                .join(', ')
            }
            className="mb-2"
          >
            {races.map((option) => (
              <MenuItem key={option.text} value={option.id}>
                <Checkbox checked={selectedRaces.includes(option.id)} />
                <ListItemText primary={option.text} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {selectedRaces.length > 0 && seedList && (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell align="center">Position</TableCell>
                    <TableCell align="center">Rank</TableCell>
                    <TableCell align="center">Name</TableCell>
                    <TableCell align="center">Team</TableCell>
                    {races
                      .filter((e) => selectedRaces.includes(e.id))
                      .map((e) => (
                        <TableCell align="center">{e.text}</TableCell>
                      ))}
                    <TableCell align="center">Overall Points</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {seedList.map((competitor) => (
                    <TableRow key={competitor.id}>
                      <TableCell align="center">
                        {competitor.position}
                      </TableCell>
                      <TableCell align="left">{competitor.title}</TableCell>
                      <TableCell align="left">{`${competitor.last_name.toUpperCase()} ${competitor.first_name}`}</TableCell>
                      <TableCell align="left">{competitor.team_name}</TableCell>
                      {races
                        .filter((e) => selectedRaces.includes(e.id))
                        .map((e) => (
                          <TableCell align="center">
                            {competitor[e.id]}
                          </TableCell>
                        ))}
                      <TableCell align="center">
                        {competitor.seed_points.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <div className="mt-4 flex justify-center space-x-4">
              <Button variant="contained" onClick={seedListPdf}>
                Download PDF
              </Button>
            </div>
          </>
        )}

        <Button variant="contained" onClick={handleBack}>
          Back
        </Button>
      </Paper>
    </Container>
  );
}
