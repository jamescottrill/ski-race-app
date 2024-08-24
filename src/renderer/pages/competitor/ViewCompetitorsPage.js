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
  Button
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useBackButton } from '../../utils/navigation';

export default function ViewCompetitorsPage() {
  const [competitors, setCompetitors] = useState([]);
  const { competitionId } = useParams();

  const handleBack = useBackButton();
  const navigate = useNavigate();
  const handleEditClick = (competitorId) => {
    console.log(`/competition/${competitionId}/competitor/${competitorId}/edit`);
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
    `;

    try {
      const result = await window.api.select(query);
      setCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    }
  };

  const calculateCategory = (competitor) => {
    let category = '';

    // Gender prefix
    if (competitor.gender === 'F') {
      category += 'F';
    }

    // Age category
    if (competitor.is_junior) {
      category += 'J';
    } else if (competitor.is_veteran) {
      category += 'V';
    } else {
      category += 'S';
    }

    // Novice status
    if (competitor.is_novice) {
      category += 'N';
    }

    // Reserve status
    if (competitor.is_reserve) {
      category += 'R';
    }

    return category;
  };

  return (
    <Container className="view-competitors-page flex flex-col items-center justify-center min-h-screen  w-full max-w-full">
      <Typography variant="h4" component="h1" className="mb-6 text-gray-800 font-bold text-center">
        Competitors
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>First Name</TableCell>
              <TableCell>Last Name</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>Date of Birth</TableCell>
              <TableCell>Service Number</TableCell>
              <TableCell>Country</TableCell>
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
                <TableCell>{competitor.country}</TableCell>
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
                </TableCell> {/* Edit button */}
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
    </Container>
  );
}
