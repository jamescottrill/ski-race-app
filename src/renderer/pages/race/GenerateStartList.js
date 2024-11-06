import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
  Checkbox,
  Grid,
  TextField,
  FormControlLabel,
} from '@mui/material';
import { fetchSeedList } from '../../utils/FetchSeedList';
import { useBackButton } from '../../utils/navigation';
import { startListPdf } from '../../utils/StartListPdf';
import { getRaceDetails } from '../../utils/RaceDetails';
import { shuffleArray } from '../../utils/GenericUtils';

export default function GenerateStartList() {
  const { competitionId, raceId } = useParams();
  const [seedList, setSeedList] = useState([]);
  const [struckOutCompetitors, setStruckOutCompetitors] = useState({});
  const [startList, setStartList] = useState(null);
  const [womenStartList, setWomenStartList] = useState(null);
  const [startListExists, setStartListExists] = useState(false);
  const [raceDetails, setRaceDetails] = useState({
    is_women_separate: false,
    randomise_top: 15,
    randomise_top_women: 15,
  });

  const handleBack = useBackButton();

  const getFetchSeedList = async () => {
    const seedlist = await fetchSeedList(competitionId);
    setSeedList(seedlist);
  };

  const fetchRaceDetails = async () => {
    const details = await getRaceDetails(raceId, competitionId);
    setRaceDetails(details);
  };

  const getStartList = async () => {
    const query = `
    SELECT
      p.id, p.first_name, p.last_name, rc.bib_number,
      cc.is_reserve, cc.is_junior, cc.is_senior, cc.is_veteran, cc.title,
      cc.is_veteran, cc.is_female, cc.team
      FROM race_competitor rc
    INNER JOIN people p ON rc.racer_id = p.id
    INNER JOIN competition_competitor cc ON rc.racer_id = cc.racer_id AND rc.competition_id = cc.competition_id
    WHERE rc.competition_id = ? AND rc.race_id = ?
    `;
    const results = await window.api.select(query, [competitionId, raceId]);
    if (results) {
      setStartList(results);
    }
  };

  const startListExistsFn = async () => {
    let exists = false;
    const query = `
    SELECT
      COUNT(*) AS ct
    FROM race_competitor
    WHERE competition_id = ? AND race_id = ?
    `;
    const values = [competitionId, raceId];
    const result = await window.api.select(query, values);
    if (result && result[0]) {
      exists = result[0].ct > 0;
    }
    setStartListExists(exists);
    getStartList();
  };

  const generatePDF = () => {
    startListPdf(raceDetails, startList, womenStartList);
  };

  const handleStrikeOut = (competitorId) => {
    setStruckOutCompetitors((prev) => ({
      ...prev,
      [competitorId]: !prev[competitorId],
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRaceDetails({
      ...raceDetails,
      [name]: parseInt(value, 10) || 0, // Parse value as integer, default to 0 if invalid
    });
  };

  const generateStartList = () => {
    const activeCompetitors = seedList.filter(
      (competitor) => !struckOutCompetitors[competitor.id],
    );
    let menStartList = [];
    let tmpWomenStartList = [];

    if (raceDetails.is_women_separate) {
      // Handle separate start lists for men and women
      let topMenCompetitors = activeCompetitors
        .filter((competitor) => competitor.gender === 'M')
        .slice(0, raceDetails.randomise_top);

      let topWomenCompetitors = activeCompetitors
        .filter((competitor) => competitor.gender === 'F')
        .slice(0, raceDetails.randomise_top_women);

      topMenCompetitors = shuffleArray(topMenCompetitors);
      topWomenCompetitors = shuffleArray(topWomenCompetitors);

      menStartList = [
        ...topMenCompetitors,
        ...activeCompetitors
          .filter((competitor) => competitor.gender === 'M')
          .slice(raceDetails.randomise_top),
      ];
      tmpWomenStartList = [
        ...topWomenCompetitors,
        ...activeCompetitors
          .filter((competitor) => competitor.gender === 'F')
          .slice(raceDetails.randomise_top_women),
      ];
    } else {
      // Combined start list
      let topCompetitors = activeCompetitors.slice(
        0,
        raceDetails.randomise_top,
      );
      topCompetitors = shuffleArray(topCompetitors);
      menStartList = [
        ...topCompetitors,
        ...activeCompetitors.slice(raceDetails.randomise_top),
      ];
    }

    setStartList(menStartList);
    setWomenStartList(raceDetails.is_women_separate ? tmpWomenStartList : null);
  };

  useEffect(() => {
    fetchRaceDetails().catch(console.error);
    getFetchSeedList().catch(console.error);
    startListExistsFn().catch(console.error);
    getStartList().catch(console.error);
  }, [competitionId, raceId]);

  const saveStartList = async (list, gender) => {
    const query = `
      INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number)
      VALUES (?, ?, ?, ?);
    `;
    const raceQuery = `
      INSERT INTO race_results (competition_id, race_id, racer_id, run_number)
      VALUES (?, ?, ?, 1);
    `;
    try {
      const promises = [];
      let res;
      for (let i = 0; i < list.length; i += 1) {
        res = window.api.insert(query, [
          competitionId,
          raceId,
          list[i].id,
          i + 1,
        ]);
        promises.push(res);
        res = window.api.insert(raceQuery, [competitionId, raceId, list[i].id]);
        promises.push(res);
      }
      await Promise.all(promises);
      alert(`${gender} start list saved successfully.`);
    } catch (error) {
      console.error(`Failed to save ${gender} start list:`, error);
    }
  };

  const handleSaveStartList = () => {
    if (womenStartList) {
      saveStartList(startList, "Men's");
      saveStartList(womenStartList, "Women's");
    } else {
      saveStartList(startList, 'Congratulations, ');
    }
  };

  const generateNewStartList = (
    <Container className="generate-start-list-page flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Generate Start List
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={handleBack}
          // className="over:bg-green-700 text-white py-2 px-4 rounded shadow-lg w-full mt-4"
        >
          Back
        </Button>
        <Grid container spacing={2} className="my-4">
          <Grid item xs={12} sm={6}>
            <TextField
              label="Top X to Randomise"
              type="number"
              variant="outlined"
              fullWidth
              name="randomise_top" // Update the name to match your state
              value={raceDetails.randomise_top}
              onChange={handleChange}
            />
          </Grid>
          {raceDetails.is_women_separate && ( // Conditionally show the second input
            <Grid item xs={12} sm={6}>
              <TextField
                label="Top X Women to Randomise"
                type="number"
                variant="outlined"
                fullWidth
                name="randomise_top_women" // Update the name to match your state
                value={raceDetails.randomise_top_women}
                onChange={handleChange}
              />
            </Grid>
          )}
        </Grid>
        <Typography variant="h6" component="h2" className="mb-4 text-gray-700">
          Competitors
        </Typography>
        <List>
          {seedList.map((competitor, i) => (
            <ListItem
              key={`sl-${competitor.id}`}
              style={{
                textDecoration: struckOutCompetitors[competitor.id]
                  ? 'line-through'
                  : 'none',
                color: struckOutCompetitors[competitor.id] ? 'gray' : 'black',
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={struckOutCompetitors[competitor.id] || false}
                    onChange={() => handleStrikeOut(competitor.id)}
                  />
                }
                label=""
              />
              <ListItemText
                primary={`${i + 1}: ${competitor.first_name} ${competitor.last_name} (${competitor.gender})`}
                secondary={`Seed: ${competitor.seed_points}`}
              />
            </ListItem>
          ))}
        </List>
        <Button
          variant="contained"
          color="primary"
          onClick={generateStartList}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full mt-4"
        >
          Generate Start List
        </Button>

        {startList && (
          <Paper elevation={1} className="p-4 mt-4">
            <Typography
              variant="h6"
              component="h2"
              className="mb-4 text-gray-700"
            >
              {raceDetails.is_women_separate
                ? "Men's Start List"
                : 'Start List'}
            </Typography>
            <List>
              {startList.map((competitor, index) => (
                <ListItem key={competitor.id}>
                  <ListItemText
                    primary={`Bib ${index + 1}: ${competitor.first_name} ${competitor.last_name} (${competitor.seed_points})`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {womenStartList && (
          <Paper elevation={1} className="p-4 mt-4">
            <Typography
              variant="h6"
              component="h2"
              className="mb-4 text-gray-700"
            >
              Women&apos;s Start List
            </Typography>
            <List>
              {womenStartList.map((competitor, index) => (
                <ListItem key={competitor.id}>
                  <ListItemText
                    primary={`Bib ${index + 1}: ${competitor.first_name} ${competitor.last_name} (${competitor.seed_points})`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {startList && (
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSaveStartList}
            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded shadow-lg w-full mt-4"
          >
            Save Start List
          </Button>
        )}
      </Paper>
    </Container>
  );

  const showStartList = (
    <Container className="generate-start-list-page flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Start List
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={handleBack}
          // className="over:bg-green-700 text-white py-2 px-4 rounded shadow-lg w-full mt-4"
        >
          Back
        </Button>
        {startList && (
          <Paper elevation={1} className="p-4 mt-4">
            {!!raceDetails.is_women_separate && (
              <Typography
                variant="h6"
                component="h2"
                className="mb-4 text-gray-700"
              >
                Men&apos;s Start List
              </Typography>
            )}
            <List>
              {startList.map((competitor, index) => (
                <ListItem key={competitor.id}>
                  <ListItemText
                    primary={`${index + 1}: ${competitor.first_name} ${competitor.last_name}`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {womenStartList && (
          <Paper elevation={1} className="p-4 mt-4">
            <Typography
              variant="h6"
              component="h2"
              className="mb-4 text-gray-700"
            >
              Women&apos;s Start List
            </Typography>
            <List>
              {womenStartList.map((competitor, index) => (
                <ListItem key={competitor.id}>
                  <ListItemText
                    primary={`Bib ${index + 1}: ${competitor.first_name} ${competitor.last_name} (${competitor.seed_points})`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
        <Button variant="contained" onClick={generatePDF}>
          Download PDF
        </Button>
      </Paper>
    </Container>
  );
  return startListExists ? showStartList : generateNewStartList;
}
