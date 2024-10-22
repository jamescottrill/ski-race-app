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
} from '@mui/material';

export default function GenerateStartList() {
  const { competitionId, raceId } = useParams();
  const [seedList, setSeedList] = useState([]);
  const [struckOutCompetitors, setStruckOutCompetitors] = useState({});
  const [startList, setStartList] = useState(null);
  const [womenStartList, setWomenStartList] = useState(null);
  const [raceDetails, setRaceDetails] = useState({
    is_women_separate: false,
    randomise_top: 15,
    randomise_top_women: 15,
  });

  useEffect(() => {
    fetchRaceDetails();
    fetchSeedList();
  }, []);

  const fetchRaceDetails = async () => {
    const query = `
      SELECT women_separate--, randomise_top, randomise_top_women
      FROM races
      WHERE race_id = ? AND competition_id = ?
    `;
    try {
      const result = await window.api.select(query, [raceId, competitionId]);
      if (result && result[0]) {
        setRaceDetails(result[0]);
      }
    } catch (error) {
      console.error('Failed to fetch race details:', error);
    }
  };

  const factorQuery = `factors AS( SELECT 'SL' AS type, 730 AS factor UNION ALL SELECT 'GS', 1010 UNION ALL SELECT 'SG', 1190 UNION ALL SELECT 'DH', 1250 UNION ALL SELECT 'AC', 1360 ),`;
  const raceSeedQuery = `race_seed AS(
                  SELECT race_id
                       , racer_id
                       , run_id
                       , race_time
                       , MIN(race_time) OVER(PARTITION BY race_id, run_id ORDER BY race_time DESC) AS min_time
                  FROM race_results
                  WHERE competition_id = ?
                ),
                all_results AS (
                  SELECT racer_id
                       , run_id
                       , (race_time * f.factor) / min_time - factor AS seed_points
                  FROM race_seed rs
                         JOIN races r ON rs.race_id = r.race_id
                         JOIN factors f ON r.race_type = f.type
                )`;

  const fetchSeedList = async () => {
    try {
      const completedRaces = await window.api.select(
        `
        SELECT DISTINCT rr.race_id
        FROM race_results rr
        INNER JOIN races r ON r.race_id = rr.race_id AND r.competition_id = rr.competition_id
        WHERE rr.competition_id = ?
          AND race_time IS NOT NULL
          AND (NOT r.is_seeding OR r.is_seeding IS NULL)
      `,
        [competitionId],
      );
      const hasSeedingRace = await window.api
        .select(
          `
            SELECT DISTINCT rr.race_id
            FROM race_results rr
            INNER JOIN races r ON r.race_id = rr.race_id AND r.competition_id = rr.competition_id
            WHERE rr.competition_id = ?
              AND race_time IS NOT NULL
              AND r.is_seeding
          `,
          [competitionId],
        )
        .then((results) => results.length > 0);

      let query;
      let params = [];
      switch (completedRaces.length) {
        case 0:
          if (hasSeedingRace) {
            query = `
              SELECT racer_id, arrival_seed AS seed_points, first_name, last_name, cc.title, team
              FROM competition_competitor cc
                     JOIN people p ON cc.racer_id = p.id
              WHERE competition_id = ?
            `;
            params = [competitionId];
          } else {
            query = `
              WITH
                ${factorQuery}
                ${raceSeedQuery}
              SELECT a.racer_id, first_name, last_name, p.title, gender, cc.team, MIN(seed_points)
              FROM all_results a
                     JOIN people p ON p.id = a.racer_id
                     JOIN competition_competitor cc ON p.id = cc.racer_id AND cc.competition_id = ?
              GROUP BY 1,2,3,4
            `;
            params = [competitionId];
          }
          break;
        case 1:
          query = `
              `;
          // TODO:: Move title into competition_competitor table
          params = [competitionId, competitionId];
      }
      const result = await window.api.select(query, params);
      console.log(result);
      setSeedList(result);
    } catch (error) {
      console.error('Failed to fetch seed list:', error);
    }
  };

  const handleStrikeOut = (competitorId) => {
    setStruckOutCompetitors((prev) => ({
      ...prev,
      [competitorId]: !prev[competitorId],
    }));
  };

  const generateStartList = () => {
    const activeCompetitors = seedList.filter(
      (competitor) => !struckOutCompetitors[competitor.id],
    );
    let menStartList = [];
    let womenStartList = [];

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
      womenStartList = [
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
    setWomenStartList(raceDetails.is_women_separate ? womenStartList : null);
  };

  const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
  };

  const saveStartList = async (list, gender) => {
    const query = `
      INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number)
      VALUES (?, ?, ?, ?)
    `;
    try {
      for (let i = 0; i < list.length; i++) {
        await window.api.insert(query, [
          competitionId,
          raceId,
          list[i].id,
          i + 1,
        ]);
      }
      alert(`${gender} start list saved successfully.`);
    } catch (error) {
      console.error(`Failed to save ${gender} start list:`, error);
    }
  };

  const handleSaveStartList = () => {
    if (startList) saveStartList(startList, 'Men');
    if (womenStartList) saveStartList(womenStartList, 'Women');
  };

  return (
    <Container className="generate-start-list-page flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Generate Start List
        </Typography>
        <Typography variant="h6" component="h2" className="mb-4 text-gray-700">
          Competitors
        </Typography>
        <List>
          {seedList.map((competitor) => (
            <ListItem
              key={competitor.id}
              style={{
                textDecoration: struckOutCompetitors[competitor.id]
                  ? 'line-through'
                  : 'none',
                color: struckOutCompetitors[competitor.id] ? 'gray' : 'black',
              }}
            >
              <Checkbox
                checked={struckOutCompetitors[competitor.id] || false}
                onChange={() => handleStrikeOut(competitor.id)}
              />
              <ListItemText
                primary={`${competitor.first_name} ${competitor.last_name} (${competitor.gender})`}
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
                    primary={`Bib ${index + 1}: ${competitor.first_name} ${competitor.last_name}`}
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
              Women's Start List
            </Typography>
            <List>
              {womenStartList.map((competitor, index) => (
                <ListItem key={competitor.id}>
                  <ListItemText
                    primary={`Bib ${index + 1}: ${competitor.first_name} ${competitor.last_name}`}
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
}
