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
  Box,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '../../utils/navigation';
import TeamModal from '../../components/TeamModal';
import EditTeamModal from '../../components/EditTeamModal';

export default function TeamListPage() {
  const [teams, setTeams] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const navigate = useNavigate();
  const handleBack = useBackButton();


  const fetchTeams = async () => {
    try {
      // 1. Fetch team data from your database
      const result = await window.api.select(`
        SELECT
          ct.team_id,
          ct.team_name,
          COUNT(ctm.racer_id) AS num_members,
          ct.is_corps,
          ct.is_reserve,
          ct.is_female,
          ct.is_hc
        FROM competition_team ct
        LEFT JOIN competition_team_members ctm ON ct.team_id = ctm.team_id AND ct.competition_id = ctm.competition_id
        GROUP BY ct.team_id, ct.team_name
      `);
      setTeams(result);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };


  useEffect(() => {
    fetchTeams();
  }, []);

  const handleCreateTeam = async (newTeamData) => {
    try {
      // 1. Insert new team data into the database
      const teamId = await window.api.insert(
        'INSERT INTO competition_team (team_name, is_corps, is_female, is_reserve, is_hc) VALUES (?, ?, ?, ?, ?)',
        [
          newTeamData.teamName,
          newTeamData.isCorps,
          newTeamData.isFemale,
          newTeamData.isReserve,
          newTeamData.isHC,
        ],
      );

      // 2. Update state (you can either refetch all teams or add the new team directly)
      setTeams([...teams, { ...newTeamData, team_id: teamId }]);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Failed to create team:', error);
      // Handle error (e.g., display an error message)
    }
  };

  const handleEditTeam = async (updatedTeamData) => {
    try {
      // 1. Update team data in the database
      await window.api.insert(
        `
        UPDATE competition_team
        SET
          team_name = ?,
          is_corps = ?,
          is_female = ?,
          is_reserve = ?,
          is_hc = ?
        WHERE team_id = ?
      `,
        [
          updatedTeamData.teamName,
          updatedTeamData.isCorps,
          updatedTeamData.isFemale,
          updatedTeamData.isReserve,
          updatedTeamData.isHC,
          updatedTeamData.teamId,
        ],
      );

      const updatedTeams = teams.map((team) =>
        team.team_id === updatedTeamData.teamId
          ? { ...team, ...updatedTeamData }
          : team,
      );
      setTeams(updatedTeams);
      setIsEditModalOpen(false);
      setSelectedTeam(null);
    } catch (error) {
      console.error('Failed to update team:', error);
      // Handle error
    }
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleOpenEditModal = (team) => {
    setSelectedTeam(team);
    setIsEditModalOpen(true);
    fetchTeams();
  };

  const handleCloseEditModal = (message) => {
    setIsEditModalOpen(false);
    setSelectedTeam(null);
    fetchTeams();
    if (message && message.message) window.alert(message.message);

  };

  return (
    <Container className="team-list-page flex flex-col items-center justify-center min-h-screen  w-full max-w-full">
      <Typography
        variant="h4"
        component="h1"
        className="mb-6 text-gray-800 font-bold text-center"
      >
        Teams
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Team Name</TableCell>
              <TableCell align="right">Members</TableCell>
              <TableCell align="center">Corps</TableCell>
              <TableCell align="center">Female</TableCell>
              <TableCell align="center">Reserve</TableCell>
              <TableCell align="center">HC</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.team_id}>
                <TableCell component="th" scope="row">
                  {team.team_name}
                </TableCell>
                <TableCell align="right">{team.num_members}</TableCell>
                <TableCell align="center">
                  {team.is_corps ? 'Yes' : 'No'}
                </TableCell>
                <TableCell align="center">
                  {team.is_female ? 'Yes' : 'No'}
                </TableCell>
                <TableCell align="center">
                  {team.is_reserve ? 'Yes' : 'No'}
                </TableCell>
                <TableCell align="center">
                  {team.is_hc ? 'Yes' : 'No'}
                </TableCell>
                <TableCell align="center">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleOpenEditModal(team.team_id)}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box mt={4} display="flex" justifyContent="space-between" width="100%">
        <Button variant="contained" color="secondary" onClick={handleBack}>
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleOpenCreateModal}
        >
          Create New Team
        </Button>
      </Box>

      {/* Create Team Modal */}
      <TeamModal
        open={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onCreate={handleCreateTeam}
      />

      {/* Edit Team Modal */}
      <EditTeamModal
        open={isEditModalOpen}
        onClose={handleCloseEditModal}
        onError={window.alert}
        teamId={selectedTeam}
      />
    </Container>
  );
}
