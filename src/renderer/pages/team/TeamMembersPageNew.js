import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, UserPlus, UserMinus, ChevronDown } from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge,
  DataTable,
  Select
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function TeamMembersPageNew() {
  const navigate = useNavigate();
  const { competitionId, teamId } = useParams();
  const handleBack = useBackButton();

  const [team, setTeam] = useState(null);
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [availableCompetitors, setAvailableCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, [competitionId, teamId]);

  useEffect(() => {
    if (selectedRaceId) {
      fetchTeamMembers();
      fetchAvailableCompetitors();
    }
  }, [selectedRaceId]);

  const fetchInitialData = async () => {
    try {
      // Fetch team details
      const teamResult = await window.api.select(
        `SELECT team_name, is_corps, is_reserve FROM competition_team
         WHERE competition_id = ? AND team_id = ?`,
        [competitionId, teamId]
      );

      if (teamResult.length > 0) {
        setTeam(teamResult[0]);
      }

      // Fetch races for this competition (team races only)
      const racesResult = await window.api.select(
        `SELECT race_id, race_name, race_type, race_date
         FROM races
         WHERE competition_id = ? AND is_team = 1
         ORDER BY race_date, race_name`,
        [competitionId]
      );
      setRaces(racesResult);

      // Auto-select first race if available
      if (racesResult.length > 0) {
        setSelectedRaceId(racesResult[0].race_id);
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const result = await window.api.select(
        `SELECT
          ctm.racer_id,
          p.first_name,
          p.last_name,
          p.id AS service_number
         FROM competition_team_members ctm
         JOIN people p ON ctm.racer_id = p.id
         LEFT JOIN competition_competitor cc ON cc.competition_id = ctm.competition_id AND cc.racer_id = ctm.racer_id
         WHERE ctm.competition_id = ? AND ctm.team_id = ? AND ctm.race_id = ?
         ORDER BY p.last_name, p.first_name`,
        [competitionId, teamId, selectedRaceId]
      );
      setTeamMembers(result);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    }
  };

  const fetchAvailableCompetitors = async () => {
    try {
      // Get competitors registered for this competition who are not already in this team for this race
      const result = await window.api.select(
        `SELECT
          cc.racer_id,
          p.first_name,
          p.last_name,
          p.id AS service_number
         FROM competition_competitor cc
         JOIN people p ON cc.racer_id = p.id
         WHERE cc.competition_id = ?
           AND cc.racer_id NOT IN (
             SELECT racer_id FROM competition_team_members
             WHERE competition_id = ? AND team_id = ? AND race_id = ?
           )
         ORDER BY p.last_name, p.first_name`,
        [competitionId, competitionId, teamId, selectedRaceId]
      );
      setAvailableCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch available competitors:', error);
    }
  };

  const handleAddMember = async (racerId) => {
    try {
      await window.api.insert(
        `INSERT INTO competition_team_members (competition_id, team_id, race_id, racer_id)
         VALUES (?, ?, ?, ?)`,
        [competitionId, teamId, selectedRaceId, racerId]
      );
      await fetchTeamMembers();
      await fetchAvailableCompetitors();
    } catch (error) {
      console.error('Failed to add team member:', error);
      alert('Failed to add team member. They may already be assigned to another team for this race.');
    }
  };

  const handleRemoveMember = async (racerId) => {
    try {
      await window.api.delete(
        `DELETE FROM competition_team_members
         WHERE competition_id = ? AND team_id = ? AND race_id = ? AND racer_id = ?`,
        [competitionId, teamId, selectedRaceId, racerId]
      );
      await fetchTeamMembers();
      await fetchAvailableCompetitors();
    } catch (error) {
      console.error('Failed to remove team member:', error);
    }
  };

  const memberColumns = [
    {
      header: 'Name',
      accessorKey: 'last_name',
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.last_name}, {row.original.first_name}
        </span>
      )
    },
    {
      header: 'Service Number',
      accessorKey: 'service_number',
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="danger"
          onClick={() => handleRemoveMember(row.original.racer_id)}
          leftIcon={<UserMinus className="w-3 h-3" />}
        >
          Remove
        </Button>
      )
    }
  ];

  const availableColumns = [
    {
      header: 'Name',
      accessorKey: 'last_name',
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.last_name}, {row.original.first_name}
        </span>
      )
    },
    {
      header: 'Service Number',
      accessorKey: 'service_number'
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="primary"
          onClick={() => handleAddMember(row.original.racer_id)}
          leftIcon={<UserPlus className="w-3 h-3" />}
        >
          Add
        </Button>
      )
    }
  ];

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-500">Loading...</div>
        </div>
      </PageContainer>
    );
  }

  const selectedRace = races.find(r => r.race_id === selectedRaceId);

  return (
    <PageContainer>
      <PageHeader
        title={`${team?.team_name || 'Team'} Members`}
        subtitle="Manage team line-up for each race"
        actions={
          <Button
            variant="outline"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        }
      />

      {/* Race Selector */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-neutral-700">
              Select Race:
            </label>
            {races.length === 0 ? (
              <p className="text-neutral-500 text-sm">
                No team races have been created yet. Create a team race first to assign members.
              </p>
            ) : (
              <select
                value={selectedRaceId}
                onChange={(e) => setSelectedRaceId(e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {races.map(race => (
                  <option key={race.race_id} value={race.race_id}>
                    {race.race_name} ({race.race_type})
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedRace && (
            <p className="mt-2 text-xs text-neutral-500">
              Assign racers to {team?.team_name} for the {selectedRace.race_name}.
              Each racer can only be on one team per race.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedRaceId && (
        <div className="grid grid-cols-2 gap-6">
          {/* Current Team Members */}
          <Card>
            <div className="p-4 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-500" />
                  <h3 className="font-semibold">Current Members</h3>
                </div>
                <Badge variant="primary">{teamMembers.length} racers</Badge>
              </div>
            </div>
            <CardContent noPadding>
              {teamMembers.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-500">No members assigned for this race</p>
                </div>
              ) : (
                <DataTable columns={memberColumns} data={teamMembers} pageSize={10} />
              )}
            </CardContent>
          </Card>

          {/* Available Competitors */}
          <Card>
            <div className="p-4 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-success" />
                  <h3 className="font-semibold">Available Competitors</h3>
                </div>
                <Badge variant="default">{availableCompetitors.length} available</Badge>
              </div>
            </div>
            <CardContent noPadding>
              {availableCompetitors.length === 0 ? (
                <div className="p-8 text-center">
                  <UserPlus className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-500">All competitors are assigned to teams</p>
                </div>
              ) : (
                <DataTable columns={availableColumns} data={availableCompetitors} pageSize={10} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
