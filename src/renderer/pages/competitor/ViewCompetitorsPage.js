import React, { useState, useEffect } from 'react';
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
import { useNavigate, useParams } from 'react-router-dom';
import { useBackButton } from '../../utils/navigation';
import { calculateCategory } from '../../utils/CompetitorManagement';

export default function ViewCompetitorsPage() {
  const [competitors, setCompetitors] = useState([]);
  const { competitionId } = useParams();

  const handleBack = useBackButton();
  const navigate = useNavigate();
  const handleEditClick = (competitorId) => {
    navigate(`/competition/${competitionId}/competitor/${competitorId}/edit`);
  };

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    const query = `
      SELECT p.id, p.first_name, p.last_name, p.gender, p.dob, p.service_number, p.country,
             ct.team_name AS team, cc.is_novice, cc.is_reserve, cc.is_junior, cc.is_senior, cc.is_veteran
      FROM people p
      INNER JOIN competition_competitor cc ON p.id = cc.racer_id
      LEFT JOIN competition_team ct ON cc.competition_id = ct.competition_id AND ct.team_id = cc.team
      WHERE cc.competition_id = ?
    `;

    try {
      const result = await window.api.select(query, [competitionId]);
      setCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    }
  };

  return (
    <Container className="view-competitors-page m-4 flex flex-col items-center justify-center max-w-full">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg max-w-full">
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Competitors
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>First Name</TableCell>
                <TableCell>Last Name</TableCell>
                <TableCell>Gender</TableCell>
                <TableCell>Date of Birth</TableCell>
                <TableCell>Service Number</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {competitors.map((competitor, index) => (
                <TableRow key={index}>
                  <TableCell>{competitor.first_name}</TableCell>
                  <TableCell>{competitor.last_name}</TableCell>
                  <TableCell>{competitor.gender}</TableCell>
                  <TableCell>{competitor.dob}</TableCell>
                  <TableCell>{competitor.service_number}</TableCell>
                  <TableCell>{competitor.team}</TableCell>
                  <TableCell>{calculateCategory(competitor)}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleEditClick(competitor.id)}
                    >
                      Edit
                    </Button>
                  </TableCell>{' '}
                  {/* Edit button */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleBack}
          className="text-white py-2 px-4 rounded shadow-lg"
        >
          Back
        </Button>
      </Paper>
    </Container>
  );
}
