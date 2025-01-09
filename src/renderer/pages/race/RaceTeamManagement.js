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
  InputLabel,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import { fetchSeedList } from '../../utils/FetchSeedList';
import { useBackButton } from '../../utils/navigation';
import { startListPdf } from '../../utils/StartListPdf';
import { getRaceDetails } from '../../utils/RaceDetails';
import { shuffleArray } from '../../utils/GenericUtils';

export default function RaceTeamManagement() {
  const { competitionId, raceId } = useParams();
  const [struckOutCompetitors, setStruckOutCompetitors] = useState({});
  const [startList, setStartList] = useState([]);
  const [teams, setTeams] = useState([]);
  const [womenStartList, setWomenStartList] = useState([null]);
  const [startListExists, setStartListExists] = useState(false);
  const [raceDetails, setRaceDetails] = useState({
    is_women_separate: false,
    randomise_top: 15,
    randomise_top_women: 5,
  });

  const handleBack = useBackButton();

  const fetchRaceDetails = async () => {
    const details = await getRaceDetails(raceId, competitionId);
    setRaceDetails(details);
  };

  const getStartList = async () => {
    const query = `
    SELECT
      p.id AS racer_id, p.first_name, p.last_name, p.gender, rc.bib_number,
      cc.is_reserve, cc.is_junior, cc.is_senior, cc.is_veteran, cc.title,
      cc.is_veteran, cc.is_female, cc.is_novice, seed_points, COALESCE(ctm.team_id, '') AS team_id
      FROM race_competitor rc
    INNER JOIN people p ON rc.racer_id = p.id
    INNER JOIN competition_competitor cc ON rc.racer_id = cc.racer_id AND rc.competition_id = cc.competition_id
    LEFT JOIN competition_team_members ctm ON ctm.competition_id = cc.competition_id AND ctm.racer_id = cc.racer_id AND ctm.race_id = rc.race_id
    WHERE rc.competition_id = ? AND rc.race_id = ?
    ORDER BY bib_number
    `;
    const results = await window.api.select(query, [competitionId, raceId]);
    if (results) {
      setStartList(results);
    }
  };

  const getTeams = async () => {
    const query = `
    SELECT
     team_id, team_name
    FROM competition_team ct
    WHERE ct.competition_id = ?
    ORDER BY team_name
    `;
    const results = await window.api.select(query, [competitionId]);
    if (results) {
      setTeams(results);
    }
  };

  const teamExists = async (userId) => {
    const query = `
    SELECT
     COUNT(*) AS count
    FROM competition_team_members ct
    WHERE ct.competition_id = ? AND ct.racer_id = ? AND ct.race_id = ?
    `;
    const results = await window.api.select(query, [
      competitionId,
      userId,
      raceId,
    ]);
    if (results) {
      return results[0].count > 0;
    }
    return false;
  };

  const newTeam = async (userId, teamId) => {
    const query = `
    INSERT INTO competition_team_members (competition_id, team_id, racer_id, race_id)
     VALUES (?, ?, ?, ?)
    `;
    const results = await window.api.select(query, [
      competitionId,
      teamId,
      userId,
      raceId,
    ]);
  };

  const updateTeam = async (userId, teamId) => {
    const query = `
    UPDATE competition_team_members
    SET team_id = ?
    WHERE competition_id = ? AND racer_id = ? AND race_id = ?
    `;
    await window.api.select(query, [teamId, competitionId, userId, raceId]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const comp = startList.findIndex(
      (competitor) => competitor.racer_id === name,
    );
    startList[comp].team_id = value;
    console.log(startList);
    setStartList(startList);
    teamExists(name)
      .then((exists) => {
        console.log(exists);
        if (exists) {
          updateTeam(name, value);
        } else {
          newTeam(name, value);
          console.log('new team');
        }
      })
      .catch((e) => {
        console.error(e);
      });
  };

  useEffect(() => {
    fetchRaceDetails().catch(console.error);
    getStartList().catch(console.error);
    getTeams().catch(console.error);
  }, [competitionId, raceId]);

  const raceTeamManagement = (
    <Container className="generate-start-list-page flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Team Management
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
            {startList.map((competitor) => (
              <>
                <p>
                  {competitor.last_name.toUpperCase()} {competitor.first_name}
                </p>
                <FormControl fullWidth>
                  <InputLabel id="teamSelect">Team Name</InputLabel>
                  <Select
                    labelId="teamSelect"
                    onChange={handleChange}
                    className="mb-2"
                    name={competitor.racer_id}
                    id={competitor.racer_id}
                    label="Team Name"
                    value={competitor.team_id}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {teams.map((team) => (
                      <MenuItem value={team.team_id}>{team.team_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            ))}
          </Paper>
        )}
      </Paper>
    </Container>
  );
  return raceTeamManagement;
}
