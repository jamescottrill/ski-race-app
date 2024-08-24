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
} from '@mui/material';
import { fetchSeedList } from '../../utils/FetchSeedList';

export default function SeedListPage() {
  const [seedList, setSeedList] = useState([]);
  const { competitionId } = useParams();

  useEffect(() => {
    const fetchList = async () => {
      const data = await fetchSeedList(competitionId);
      setSeedList(data);
    };
    fetchList();
  }, [competitionId]);

  return (
    <Container className="seed-list-page flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Seed List
        </Typography>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Position</TableCell>
                <TableCell align="center">Rank</TableCell>
                <TableCell align="center">Name</TableCell>
                <TableCell align="center">Team</TableCell>
                <TableCell align="center">Points</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {seedList.map((competitor, index) => (
                <TableRow key={competitor.id}>
                  <TableCell align="center">{index + 1}</TableCell>
                  <TableCell align="left">{competitor.title}</TableCell>
                  <TableCell align="left">{`${competitor.first_name} ${competitor.last_name}`}</TableCell>
                  <TableCell align="left">{competitor.team_name}</TableCell>
                  <TableCell align="center">
                    {`${competitor.seed_points}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
}
