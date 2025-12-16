import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  ArrowLeft,
  Plus,
  Trash2,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge,
  SimpleSelect,
  Label
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function RaceTeamManagementNew() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [teams, setTeams] = useState([]);
  const [availableCompetitors, setAvailableCompetitors] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
    fetchAvailableCompetitors();
  }, [competitionId]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    try {
      const query = `
        SELECT 
          ct.team_id,
          ct.team_name,
          ct.team_type,
          COUNT(DISTINCT ctm.racer_id) as member_count
        FROM competition_team ct
        LEFT JOIN competition_team_members ctm ON ct.team_id = ctm.team_id
        WHERE ct.competition_id = ?
        GROUP BY ct.team_id, ct.team_name, ct.team_type
        ORDER BY ct.team_name
      `;
      const result = await window.api.select(query, [competitionId]);
      setTeams(result);
      if (result.length > 0 && !selectedTeam) {
        setSelectedTeam(result[0].team_id);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId) => {
    try {
      const query = `
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          p.gender,
          cc.regiment,
          cc.title
        FROM competition_team_members ctm
        INNER JOIN people p ON ctm.racer_id = p.id
        INNER JOIN competition_competitor cc ON p.id = cc.racer_id AND cc.competition_id = ?
        WHERE ctm.team_id = ?
        ORDER BY p.last_name, p.first_name
      `;
      const result = await window.api.select(query, [competitionId, teamId]);
      setTeamMembers(result);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    }
  };

  const fetchAvailableCompetitors = async () => {
    try {
      const query = `
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          p.gender,
          cc.regiment,
          cc.title
        FROM people p
        INNER JOIN competition_competitor cc ON p.id = cc.racer_id
        WHERE cc.competition_id = ?
        AND p.id NOT IN (
          SELECT racer_id FROM competition_team_members 
          WHERE team_id IN (SELECT team_id FROM competition_team WHERE competition_id = ?)
        )
        ORDER BY p.last_name, p.first_name
      `;
      const result = await window.api.select(query, [competitionId, competitionId]);
      setAvailableCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch available competitors:', error);
    }
  };

  const handleAddMember = async (competitorId) => {
    if (!selectedTeam) return;
    
    try {
      await window.api.insert(
        'INSERT INTO competition_team_members (team_id, racer_id) VALUES (?, ?)',
        [selectedTeam, competitorId]
      );
      await fetchTeamMembers(selectedTeam);
      await fetchAvailableCompetitors();
    } catch (error) {
      console.error('Failed to add team member:', error);
    }
  };

  const handleRemoveMember = async (competitorId) => {
    if (!selectedTeam) return;
    
    try {
      await window.api.delete(
        'DELETE FROM competition_team_members WHERE team_id = ? AND racer_id = ?',
        [selectedTeam, competitorId]
      );
      await fetchTeamMembers(selectedTeam);
      await fetchAvailableCompetitors();
    } catch (error) {
      console.error('Failed to remove team member:', error);
    }
  };

  const memberColumns = [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.first_name} {row.original.last_name}
            {row.original.title && <span className="ml-2 text-neutral-400">({row.original.title})</span>}
          </div>
          <div className="text-xs text-neutral-500">
            {row.original.regiment} • {row.original.gender}
          </div>
        </div>
      )
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="danger"
          onClick={() => handleRemoveMember(row.original.id)}
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
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.first_name} {row.original.last_name}
            {row.original.title && <span className="ml-2 text-neutral-400">({row.original.title})</span>}
          </div>
          <div className="text-xs text-neutral-500">
            {row.original.regiment} • {row.original.gender}
          </div>
        </div>
      )
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="primary"
          onClick={() => handleAddMember(row.original.id)}
          leftIcon={<UserPlus className="w-3 h-3" />}
        >
          Add
        </Button>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Race Team Management"
        subtitle="Manage teams for this race"
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
      
      <div className="mb-6">
        <Card>
          <CardContent>
            <Label htmlFor="team-select">Select Team</Label>
            <SimpleSelect
              id="team-select"
              value={selectedTeam || ''}
              onChange={(e) => setSelectedTeam(e.target.value)}
            >
              <option value="">Select a team</option>
              {teams.map(team => (
                <option key={team.team_id} value={team.team_id}>
                  {team.team_name} ({team.member_count} members)
                </option>
              ))}
            </SimpleSelect>
          </CardContent>
        </Card>
      </div>

      {selectedTeam && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-500" />
                Team Members ({teamMembers.length})
              </h3>
              <DataTable 
                columns={memberColumns} 
                data={teamMembers} 
                pageSize={10}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-success" />
                Available Competitors ({availableCompetitors.length})
              </h3>
              <DataTable 
                columns={availableColumns} 
                data={availableCompetitors} 
                pageSize={10}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}