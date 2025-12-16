import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Edit2, Trash2, UserPlus } from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function TeamListPageNew() {
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const handleBack = useBackButton();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, [competitionId]);

  const fetchTeams = async () => {
    try {
      const query = `
        SELECT
          ct.team_id,
          ct.team_name,
          COUNT(DISTINCT ctm.racer_id) as member_count
        FROM competition_team ct
        LEFT JOIN competition_team_members ctm ON ct.team_id = ctm.team_id
        WHERE ct.competition_id = ?
        GROUP BY ct.team_id, ct.team_name
        ORDER BY ct.team_name
      `;
      const result = await window.api.select(query, [competitionId]);
      setTeams(result);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = () => {
    navigate(`/competition/${competitionId}/team/new`);
  };

  const handleEditTeam = (teamId) => {
    navigate(`/competition/${competitionId}/team/${teamId}/edit`);
  };

  const handleManageMembers = (teamId) => {
    navigate(`/competition/${competitionId}/team/${teamId}/members`);
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (window.confirm(`Are you sure you want to delete team "${teamName}"?`)) {
      try {
        // Delete team members first
        await window.api.delete('DELETE FROM competition_team_members WHERE team_id = ?', [teamId]);
        // Then delete the team
        await window.api.delete('DELETE FROM competition_team WHERE team_id = ?', [teamId]);
        await fetchTeams();
      } catch (error) {
        console.error('Failed to delete team:', error);
        alert('Failed to delete team. Please try again.');
      }
    }
  };

  const columns = [
    {
      header: 'Team Name',
      accessorKey: 'team_name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary-500" />
          <span className="font-medium">{row.original.team_name}</span>
        </div>
      )
    },
    {
      header: 'Type',
      accessorKey: 'team_type',
      cell: ({ row }) => {
        const type = row.original.team_type;
        const variant = type === 'Alpine' ? 'primary' : type === 'Nordic' ? 'info' : 'default';
        return <Badge variant={variant}>{type || 'General'}</Badge>;
      }
    },
    {
      header: 'Members',
      accessorKey: 'member_count',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono">{row.original.member_count}</span>
          <span className="text-neutral-500">competitors</span>
        </div>
      )
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleManageMembers(row.original.team_id)}
            leftIcon={<UserPlus className="w-3 h-3" />}
          >
            Members
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEditTeam(row.original.team_id)}
            leftIcon={<Edit2 className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDeleteTeam(row.original.team_id, row.original.team_name)}
            leftIcon={<Trash2 className="w-3 h-3" />}
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Teams"
        subtitle={`Manage competition teams for ${competitionId}`}
        actions={
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleCreateTeam}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Team
            </Button>
            <Button
              variant="outline"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total Teams</p>
              <p className="text-2xl font-bold text-primary-700">{teams.length}</p>
            </div>
            <Users className="w-8 h-8 text-primary-300" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Alpine Teams</p>
              <p className="text-2xl font-bold text-info">
                {teams.filter(t => t.team_type === 'Alpine').length}
              </p>
            </div>
            <Users className="w-8 h-8 text-info/30" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total Members</p>
              <p className="text-2xl font-bold text-success">
                {teams.reduce((sum, team) => sum + team.member_count, 0)}
              </p>
            </div>
            <Users className="w-8 h-8 text-success/30" />
          </div>
        </Card>
      </div>

      <Card>
        <CardContent noPadding>
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-neutral-500">Loading teams...</div>
            </div>
          ) : teams.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-600 mb-4">No teams created yet</p>
              <Button
                variant="primary"
                onClick={handleCreateTeam}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create First Team
              </Button>
            </div>
          ) : (
            <DataTable columns={columns} data={teams} pageSize={20} />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
