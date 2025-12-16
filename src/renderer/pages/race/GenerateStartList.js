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
import { startListTwoRunPdf } from '../../utils/StartListTwoRunPdf';
import { getRaceDetails } from '../../utils/RaceDetails';
import { shuffleArray } from '../../utils/GenericUtils';
import { useNavigate } from 'react-router-dom';

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
    randomise_top_women: 5,
  });

  const handleBack = useBackButton();

  function refreshPage(){
    const navigate = useNavigate();
    navigate(`/competition/${competitionId}/race/${raceId}/start-list`);
  }

  const getFetchSeedList = async () => {
    let completedRaces;
    completedRaces = await window.api.select(
      `SELECT DISTINCT rr.race_id AS raceId
        FROM race_run rr
        INNER JOIN races r ON r.race_id = rr.race_id
        WHERE rr.competition_id = ?
          AND NOT r.is_training
          AND rr.is_complete
        ORDER BY r.race_date ASC`,
      [competitionId],
    );
    console.log(completedRaces);
    if (completedRaces.length > 3) {
      completedRaces = await window.api.select(
        `SELECT
            DISTINCT rr.race_id AS raceId
        FROM race_results rr
        INNER JOIN races r
          ON r.race_id = rr.race_id
        WHERE rr.competition_id = ?
          AND NOT r.is_training
          AND NOT r.is_seeding
        ORDER BY r.race_date ASC`,
        [competitionId],
      );
    }
    console.log(completedRaces);
    const seedlist = await fetchSeedList(
      competitionId,
      completedRaces.map((e) => e.raceId),
    );
    setSeedList(seedlist);
  };

  const fetchRaceDetails = async () => {
    const details = await getRaceDetails(raceId, competitionId);
    setRaceDetails(details);
  };

  const getStartList = async () => {
    const query = `
    SELECT
      p.id AS racer_id, p.first_name, p.last_name, p.gender, rc.bib_number,
      cc.is_reserve, cc.is_junior, cc.is_senior, cc.is_veteran, cc.title,
      cc.is_veteran, cc.is_female, cc.is_novice, seed_points, cc.regiment AS team
      FROM race_competitor rc
    INNER JOIN people p ON rc.racer_id = p.id
    INNER JOIN competition_competitor cc ON rc.racer_id = cc.racer_id AND rc.competition_id = cc.competition_id
--     LEFT JOIN competition_team_members ctm ON ctm.competition_id = rc.competition_id AND ctm.racer_id = rc.racer_id
--     LEFT JOIN competition_team ct ON ct.team_id = ctm.team_id AND ct.competition_id = ctm.competition_id
    WHERE rc.competition_id = ? AND rc.race_id = ?
--     AND NOT COALESCE(ct.is_female, FALSE)
--     AND NOT COALESCE(ct.is_hc, FALSE)
    ORDER BY bib_number
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
    raceDetails.number_runs === 2 ? startListTwoRunPdf(raceDetails, startList, womenStartList) :
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
      (competitor) => !struckOutCompetitors[competitor.racer_id],
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
    menStartList.map((competitor, index) => {competitor.bib_number = index+1; return competitor;})
    tmpWomenStartList.map((competitor, index) => {competitor.bib_number = index+1; return competitor;})
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
    console.log(list);
    const query = `
      INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number, seed_points)
      VALUES (?, ?, ?, ?, ?);
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
          list[i].racer_id,
          list[i].bib_number,
          list[i].seed_points,
        ]);
        promises.push(res);
        res = window.api.insert(raceQuery, [
          competitionId,
          raceId,
          list[i].racer_id,
        ]);
        promises.push(res);
      }
      await Promise.all(promises);
      alert(`${gender} start list saved successfully.`);
    } catch (error) {
      console.error(`Failed to save ${gender} start list:`, error);
    }
  };

  const deleteStartList = async () => {
    const query = `
      DELETE FROM race_competitor
      WHERE competition_id = ? AND race_id = ?;
    `;
    const raceQuery = `
      DELETE FROM race_results
      WHERE competition_id = ? AND race_id = ?;
    `;
    try {
      const promises = [];
      const res1 = window.api.delete(query, [competitionId, raceId]);
      const res2 = window.api.delete(raceQuery, [competitionId, raceId]);
      promises.push(res1);
      promises.push(res2);
      await Promise.all(promises);
      alert(`Start list deleted successfully.`);
    } catch (error) {
      alert(`Failed to delete start list. ${error}`);
      console.error(`Failed to delete start list:`, error);
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

  const changeBibNumber = (e) => {
    const {id, value} = e.target;
    const index = startList.findIndex(competitor => competitor.racer_id === id);
    const competitor = startList[index];
    competitor.bib_number = parseInt(value, 10);
    startList[index] = competitor;
    setStartList([...startList]);
  }

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
          {raceDetails.is_women_separate !== 0 && ( // Conditionally show the second input
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
              key={`sl-${competitor.racer_id}`}
              style={{
                textDecoration: struckOutCompetitors[competitor.racer_id]
                  ? 'line-through'
                  : 'none',
                color: struckOutCompetitors[competitor.racer_id]
                  ? 'gray'
                  : 'black',
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={struckOutCompetitors[competitor.racer_id] || false}
                    onChange={() => handleStrikeOut(competitor.racer_id)}
                  />
                }
                label=""
              />
              <ListItemText
                primary={`${i + 1}: ${competitor.last_name.toUpperCase()} ${competitor.first_name} (${competitor.gender})`}
                secondary={`Seed: ${competitor.seed_points.toFixed(2)}`}
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
                <ListItem key={competitor.racer_id}>
                  <TextField
                    defaultValue={index+1}
                    id={competitor.racer_id}
                    onChange={changeBibNumber}
                  ></TextField>
                  <ListItemText
                    primary={`${competitor.last_name.toUpperCase()} ${competitor.first_name} (${competitor.seed_points.toFixed(2)})`}
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
                <ListItem key={competitor.racer_id}>
                  <ListItemText
                    primary={`Bib ${index + 1}: ${competitor.first_name} ${competitor.last_name} (${competitor.seed_points.toFixed(2)})`}
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
          <Paper>
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
                <ListItem key={competitor.racer_id}>
                  <ListItemText
                    primary={`${index + 1}: ${competitor.first_name} ${competitor.last_name}`}
                    secondary={`Seed: ${competitor.seed_points.toFixed(2)}`}
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
                <ListItem key={competitor.racer_id}>
                  <ListItemText
                    primary={`Bib ${index + 1}: ${competitor.first_name} ${competitor.last_name}`}
                    secondary={`Seed: ${competitor.seed_points.toFixed(2)}`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
        <Button variant="contained" onClick={generatePDF}>
          Download PDF
        </Button>
        <Button variant="contained" onClick={deleteStartList}>
          Delete Start List
        </Button>
      </Paper>
    </Container>
  );
  return startListExists ? showStartList : generateNewStartList;
}
