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
import DataFrame from 'dataframe-js';
import { fetchSeedList } from '../../utils/FetchSeedList';
import { useBackButton } from '../../utils/navigation';
import { generatePDF } from '../../pdfs/SeedList';
import * as dfd from 'danfojs';

export default function SeedListPage() {
  const [seedList, setSeedList] = useState([]);
  const [races, setRaces] = useState([]);
  const [selectedRaces, setSelectedRaces] = useState([]);
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  const seedListPdf = () => {
    generatePDF(seedList);
  };

  const completedRaces = async () => {
    const query = `SELECT race_id AS id, race_name AS text FROM races WHERE competition_id = ? AND NOT is_training`;
    const results = await window.api.select(query, [competitionId]);
    setRaces(results);
    setSelectedRaces(results.map((e) => e.id));
  };

  useEffect(() => {
    const fetchList = async () => {
      await completedRaces();
      const data = await fetchSeedList(competitionId, selectedRaces);
      setSeedList(data);
    };
    fetchList();
  }, [competitionId]);

  const handleChange = (event) => {
    const { value } = event.target;
    setSelectedRaces(value);
    const refreshData = async (sRaces) => {
      const data = await fetchSeedList(competitionId, sRaces);
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
                  {seedList.map((competitor, index) => (
                    <TableRow key={competitor.id}>
                      <TableCell align="center">{index + 1}</TableCell>
                      <TableCell align="left">{competitor.title}</TableCell>
                      <TableCell align="left">{`${competitor.last_name.toUpperCase()} ${competitor.first_name}`}</TableCell>
                      <TableCell align="left">{competitor.team_name}</TableCell>
                        {races
                          .filter((e) => selectedRaces.includes(e.id))
                          .map((e) => (
                            <TableCell align="center">{competitor[e.id]}</TableCell>
                          ))}
                    <TableCell align="center">{competitor.seed_points}</TableCell>
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
