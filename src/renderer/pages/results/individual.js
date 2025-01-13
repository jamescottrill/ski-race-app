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
} from '@mui/material';
import { fetchSeedList } from '../../utils/FetchSeedList';
import { useBackButton } from '../../utils/navigation';
import { generatePDF } from '../../pdfs/SeedList';

export default function IndividualResults() {
  const [races, setRaces] = useState([]);
  const [selectedRaces, setSelectedRaces] = useState([]);
  const [seedList, setSeedList] = useState([]);
  const [junior, setJunior] = useState([]);
  const [veteran, setVeteran] = useState([]);
  const [novice, setNovice] = useState([]);
  const [female, setFemale] = useState([]);
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  const seedListPdf = () => {
    generatePDF(seedList, races);
  };

  const completedRaces = async () => {
    /*
     */
    const query = `
        SELECT
          DISTINCT rr.race_id AS id, r.race_name AS text, r.race_date AS raceDate, r.is_seeding AS isSeeding
        FROM race_run rr
          INNER JOIN races r ON r.race_id = rr.race_id
        WHERE rr.competition_id = ?
          AND NOT r.is_training
          AND rr.is_complete
          AND r.is_individual
        ORDER BY r.race_date ASC`;
    const res = await window.api.select(query, [competitionId]);
    setRaces(res);
    setSelectedRaces(res.map((e) => e.id));
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
      data = data.filter((e) => {
        for (const race of initialRaces) {
          if (e[race.id] === null) {
            return false;
          }
        }
        return true;
      });
      console.log(data);
      setNovice(data.filter((e) => e.is_novice));
      setJunior(data.filter((e) => e.is_junior));
      setVeteran(data.filter((e) => e.is_veteran));
      setFemale(data.filter((e) => e.gender === 'F'));
      setSeedList(data);
    };
    fetchList();
  }, [competitionId]);


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
            ? `You need at least one individual race completed to see the results.`
            : `Individual Results`}
        </Typography>
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
                  {seedList.map((competitor, i) => (
                    <TableRow key={competitor.id}>
                      <TableCell align="center">
                        {i + 1}
                      </TableCell>
                      <TableCell align="left">{competitor.title}</TableCell>
                      <TableCell
                        align="left">{`${competitor.last_name.toUpperCase()} ${competitor.first_name}`}</TableCell>
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
          </>
        )}
        {selectedRaces.length > 0 && female && (
          <>
            <h1>Female Results</h1>
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
                  {female.map((competitor, i) => (
                    <TableRow key={competitor.id}>
                      <TableCell align="center">
                        {i + 1}
                      </TableCell>
                      <TableCell align="left">{competitor.title}</TableCell>
                      <TableCell
                        align="left">{`${competitor.last_name.toUpperCase()} ${competitor.first_name}`}</TableCell>
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
          </>
        )}
        {selectedRaces.length > 0 && junior && (
          <>
            <h1>Junior Results</h1>
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
                  {junior.map((competitor, i) => (
                    <TableRow key={competitor.id}>
                      <TableCell align="center">
                        {i + 1}
                      </TableCell>
                      <TableCell align="left">{competitor.title}</TableCell>
                      <TableCell
                        align="left">{`${competitor.last_name.toUpperCase()} ${competitor.first_name}`}</TableCell>
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
          </>
        )}
        {selectedRaces.length > 0 && veteran && (
          <>
            <h1>Veteran Results</h1>
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
                  {veteran.map((competitor, i) => (
                    <TableRow key={competitor.id}>
                      <TableCell align="center">
                        {i + 1}
                      </TableCell>
                      <TableCell align="left">{competitor.title}</TableCell>
                      <TableCell
                        align="left">{`${competitor.last_name.toUpperCase()} ${competitor.first_name}`}</TableCell>
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
          </>
        )}
        {selectedRaces.length > 0 && novice && (
          <>
            <h1>Novice Results</h1>
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
                  {novice.map((competitor, i) => (
                    <TableRow key={competitor.id}>
                      <TableCell align="center">
                        {i + 1}
                      </TableCell>
                      <TableCell align="left">{competitor.title}</TableCell>
                      <TableCell
                        align="left">{`${competitor.last_name.toUpperCase()} ${competitor.first_name}`}</TableCell>
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
          </>
        )}
        <div className="mt-4 flex justify-center space-x-4">
          <Button variant="contained" onClick={seedListPdf}>
            Download PDF
          </Button>
        </div>
        <Button variant="contained" onClick={handleBack}>
          Back
        </Button>
      </Paper>
    </Container>
  );
}
