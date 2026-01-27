import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Edit2, Trash2, UserPlus, Copy } from 'lucide-react';
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
import toast from 'react-hot-toast';

export default function TeamListPageNew() {
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const handleBack = useBackButton();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState([]);
  const [copying, setCopying] = useState(false);
  const [sourceRaceId, setSourceRaceId] = useState('');

  useEffect(() => {
    fetchTeams();
    fetchRaces();
  }, [competitionId]);

  const fetchRaces = async () => {
    try {
      const result = await window.api.select(
        `SELECT race_id, race_name, race_type FROM races
         WHERE competition_id = ? AND is_team = 1
         ORDER BY race_date`,
        [competitionId]
      );
      setRaces(result);
      if (result.length > 0) {
        setSourceRaceId(result[0].race_id);
      }
    } catch (error) {
      console.error('Failed to fetch races:', error);
    }
  };

  const handleCopyAllTeamsToAllRaces = async () => {
    if (!sourceRaceId) {
      toast.error('Please select a source race');
      return;
    }

    if (races.length <= 1) {
      toast.error('No other races to copy to');
      return;
    }

    setCopying(true);
    try {
      // Get source members with team info
      const sourceMembers = await window.api.select(
        `SELECT ctm.team_id, ctm.racer_id, ct.is_corps
         FROM competition_team_members ctm
         JOIN competition_team ct ON ct.team_id = ctm.team_id AND ct.competition_id = ctm.competition_id
         WHERE ctm.competition_id = ? AND ctm.race_id = ?`,
        [competitionId, sourceRaceId]
      );

      if (sourceMembers.length === 0) {
        toast.error('No team members in the source race');
        setCopying(false);
        return;
      }

      let copiedCount = 0;
      let skippedCount = 0;
      let conflictCount = 0;

      for (const race of races) {
        if (race.race_id === sourceRaceId) continue;

        for (const member of sourceMembers) {
          try {
            // Check if already in this exact team for this race
            const existing = await window.api.select(
              `SELECT 1 FROM competition_team_members
               WHERE competition_id = ? AND team_id = ? AND race_id = ? AND racer_id = ?`,
              [competitionId, member.team_id, race.race_id, member.racer_id]
            );

            if (existing.length > 0) {
              skippedCount++;
              continue;
            }

            // Check if already in another team of the same category for this race
            const existingInCategory = await window.api.select(
              `SELECT ct.team_name
               FROM competition_team_members ctm
               JOIN competition_team ct ON ct.team_id = ctm.team_id AND ct.competition_id = ctm.competition_id
               WHERE ctm.competition_id = ?
                 AND ctm.race_id = ?
                 AND ctm.racer_id = ?
                 AND ct.is_corps = ?`,
              [competitionId, race.race_id, member.racer_id, member.is_corps ? 1 : 0]
            );

            if (existingInCategory.length > 0) {
              conflictCount++;
              continue;
            }

            await window.api.insert(
              `INSERT INTO competition_team_members (competition_id, team_id, race_id, racer_id)
               VALUES (?, ?, ?, ?)`,
              [competitionId, member.team_id, race.race_id, member.racer_id]
            );
            copiedCount++;
          } catch (err) {
            console.error('Failed to copy member:', err);
          }
        }
      }

      let message = `Copied ${copiedCount} assignments to ${races.length - 1} race(s).`;
      if (skippedCount > 0) message += ` ${skippedCount} already existed.`;
      if (conflictCount > 0) message += ` ${conflictCount} skipped due to conflicts.`;
      toast.success(message);
      await fetchTeams();
    } catch (error) {
      console.error('Failed to copy teams:', error);
      toast.error('Failed to copy teams');
    } finally {
      setCopying(false);
    }
  };

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

      {/* Bulk Copy Section */}
      {races.length > 1 && (
        <Card className="mb-6">
          <CardContent>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Copy className="w-5 h-5 text-primary-500" />
              Bulk Team Assignment
            </h3>
            <p className="text-sm text-neutral-600 mb-4">
              Copy all team assignments from one race to all other team races.
            </p>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="source-race">Source Race</Label>
                <SimpleSelect
                  id="source-race"
                  value={sourceRaceId}
                  onChange={(e) => setSourceRaceId(e.target.value)}
                >
                  {races.map(race => (
                    <option key={race.race_id} value={race.race_id}>
                      {race.race_name} ({race.race_type})
                    </option>
                  ))}
                </SimpleSelect>
              </div>
              <Button
                variant="primary"
                onClick={handleCopyAllTeamsToAllRaces}
                disabled={copying || !sourceRaceId}
                leftIcon={<Copy className="w-4 h-4" />}
              >
                {copying ? 'Copying...' : `Copy to ${races.length - 1} Other Race(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
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
