import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  Copy,
  UserPlus,
  UserMinus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  SimpleSelect,
  Label
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import toast from 'react-hot-toast';

export default function RaceTeamManagementNew() {
  const { competitionId, raceId } = useParams();
  const handleBack = useBackButton();
  const [teams, setTeams] = useState([]);
  const [availableCompetitors, setAvailableCompetitors] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState([]);
  const [currentRace, setCurrentRace] = useState(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    fetchTeams();
    fetchRaces();
  }, [competitionId]);

  useEffect(() => {
    if (selectedTeam && raceId) {
      fetchTeamMembers(selectedTeam);
      fetchAvailableCompetitors();
    }
  }, [selectedTeam, raceId]);

  const fetchRaces = async () => {
    try {
      const query = `
        SELECT race_id, race_name, race_date, is_team
        FROM races
        WHERE competition_id = ? AND is_team = 1
        ORDER BY race_date
      `;
      const result = await window.api.select(query, [competitionId]);
      setRaces(result);

      const current = result.find(r => r.race_id === raceId);
      setCurrentRace(current);
    } catch (error) {
      console.error('Failed to fetch races:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const query = `
        SELECT
          ct.team_id,
          ct.team_name,
          ct.is_corps,
          ct.is_reserve,
          ct.is_female,
          ct.is_hc,
          (SELECT COUNT(*) FROM competition_team_members ctm
           WHERE ctm.team_id = ct.team_id
           AND ctm.competition_id = ct.competition_id
           AND ctm.race_id = ?) as member_count
        FROM competition_team ct
        WHERE ct.competition_id = ?
        ORDER BY ct.team_name
      `;
      const result = await window.api.select(query, [raceId, competitionId]);
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
        WHERE ctm.team_id = ? AND ctm.race_id = ? AND ctm.competition_id = ?
        ORDER BY p.last_name, p.first_name
      `;
      const result = await window.api.select(query, [competitionId, teamId, raceId, competitionId]);
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
          WHERE competition_id = ? AND race_id = ?
        )
        ORDER BY p.last_name, p.first_name
      `;
      const result = await window.api.select(query, [competitionId, competitionId, raceId]);
      setAvailableCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch available competitors:', error);
    }
  };

  const handleAddMember = async (competitorId) => {
    if (!selectedTeam) return;

    try {
      await window.api.insert(
        'INSERT INTO competition_team_members (competition_id, team_id, race_id, racer_id) VALUES (?, ?, ?, ?)',
        [competitionId, selectedTeam, raceId, competitorId]
      );
      await fetchTeamMembers(selectedTeam);
      await fetchAvailableCompetitors();
      await fetchTeams();
    } catch (error) {
      console.error('Failed to add team member:', error);
      toast.error('Failed to add team member');
    }
  };

  const handleRemoveMember = async (competitorId) => {
    if (!selectedTeam) return;

    try {
      await window.api.delete(
        'DELETE FROM competition_team_members WHERE competition_id = ? AND team_id = ? AND race_id = ? AND racer_id = ?',
        [competitionId, selectedTeam, raceId, competitorId]
      );
      await fetchTeamMembers(selectedTeam);
      await fetchAvailableCompetitors();
      await fetchTeams();
    } catch (error) {
      console.error('Failed to remove team member:', error);
      toast.error('Failed to remove team member');
    }
  };

  const handleCopyToAllRaces = async () => {
    if (races.length <= 1) {
      toast.error('No other team races to copy to');
      return;
    }

    setCopying(true);
    try {
      // Get all team members for current race
      const currentMembers = await window.api.select(
        `SELECT team_id, racer_id FROM competition_team_members
         WHERE competition_id = ? AND race_id = ?`,
        [competitionId, raceId]
      );

      if (currentMembers.length === 0) {
        toast.error('No team members to copy');
        setCopying(false);
        return;
      }

      let copiedCount = 0;
      let skippedCount = 0;

      // Copy to all other races
      for (const race of races) {
        if (race.race_id === raceId) continue;

        for (const member of currentMembers) {
          try {
            // Check if already exists
            const existing = await window.api.select(
              `SELECT 1 FROM competition_team_members
               WHERE competition_id = ? AND team_id = ? AND race_id = ? AND racer_id = ?`,
              [competitionId, member.team_id, race.race_id, member.racer_id]
            );

            if (existing.length === 0) {
              await window.api.insert(
                `INSERT INTO competition_team_members (competition_id, team_id, race_id, racer_id)
                 VALUES (?, ?, ?, ?)`,
                [competitionId, member.team_id, race.race_id, member.racer_id]
              );
              copiedCount++;
            } else {
              skippedCount++;
            }
          } catch (err) {
            console.error('Failed to copy member:', err);
          }
        }
      }

      toast.success(`Copied ${copiedCount} assignments to ${races.length - 1} race(s). ${skippedCount} already existed.`);
    } catch (error) {
      console.error('Failed to copy teams:', error);
      toast.error('Failed to copy teams to other races');
    } finally {
      setCopying(false);
    }
  };

  const handleCopyFromRace = async (sourceRaceId) => {
    if (!sourceRaceId || sourceRaceId === raceId) return;

    setCopying(true);
    try {
      // Get all team members from source race
      const sourceMembers = await window.api.select(
        `SELECT team_id, racer_id FROM competition_team_members
         WHERE competition_id = ? AND race_id = ?`,
        [competitionId, sourceRaceId]
      );

      if (sourceMembers.length === 0) {
        toast.error('No team members in source race');
        setCopying(false);
        return;
      }

      // Clear current race team members first
      await window.api.delete(
        `DELETE FROM competition_team_members WHERE competition_id = ? AND race_id = ?`,
        [competitionId, raceId]
      );

      let copiedCount = 0;
      for (const member of sourceMembers) {
        try {
          await window.api.insert(
            `INSERT INTO competition_team_members (competition_id, team_id, race_id, racer_id)
             VALUES (?, ?, ?, ?)`,
            [competitionId, member.team_id, raceId, member.racer_id]
          );
          copiedCount++;
        } catch (err) {
          console.error('Failed to copy member:', err);
        }
      }

      toast.success(`Copied ${copiedCount} team assignments from selected race`);
      await fetchTeams();
      if (selectedTeam) {
        await fetchTeamMembers(selectedTeam);
        await fetchAvailableCompetitors();
      }
    } catch (error) {
      console.error('Failed to copy from race:', error);
      toast.error('Failed to copy teams from selected race');
    } finally {
      setCopying(false);
    }
  };

  const memberColumns = [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.title && <span className="text-neutral-500">{row.original.title} </span>}
            {row.original.last_name?.toUpperCase()} {row.original.first_name}
          </div>
          <div className="text-xs text-neutral-500">
            {row.original.regiment}
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
            {row.original.title && <span className="text-neutral-500">{row.original.title} </span>}
            {row.original.last_name?.toUpperCase()} {row.original.first_name}
          </div>
          <div className="text-xs text-neutral-500">
            {row.original.regiment}
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

  const otherRaces = races.filter(r => r.race_id !== raceId);

  return (
    <PageContainer>
      <PageHeader
        title="Race Team Management"
        subtitle={currentRace ? `Managing teams for: ${currentRace.race_name}` : 'Manage teams for this race'}
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleCopyToAllRaces}
              disabled={copying || races.length <= 1}
              leftIcon={<Copy className="w-4 h-4" />}
            >
              {copying ? 'Copying...' : 'Copy to All Races'}
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

      {/* Bulk Actions Card */}
      <Card className="mb-6">
        <CardContent>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary-500" />
            Bulk Team Assignment
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-neutral-600 mb-3">
                Copy all team assignments from this race to all other team races in the competition.
              </p>
              <Button
                variant="outline"
                onClick={handleCopyToAllRaces}
                disabled={copying || races.length <= 1}
                leftIcon={<Copy className="w-4 h-4" />}
              >
                Copy to All Races ({races.length - 1} other races)
              </Button>
            </div>
            <div>
              <Label>Copy from another race</Label>
              <div className="flex gap-2 mt-1">
                <SimpleSelect
                  id="copy-from-race"
                  onChange={(e) => e.target.value && handleCopyFromRace(e.target.value)}
                  disabled={copying || otherRaces.length === 0}
                >
                  <option value="">Select race to copy from...</option>
                  {otherRaces.map(race => (
                    <option key={race.race_id} value={race.race_id}>
                      {race.race_name}
                    </option>
                  ))}
                </SimpleSelect>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                This will replace all current team assignments with those from the selected race.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Selection */}
      <Card className="mb-6">
        <CardContent>
          <Label htmlFor="team-select">Select Team to Manage</Label>
          <SimpleSelect
            id="team-select"
            value={selectedTeam || ''}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="">Select a team</option>
            {teams.map(team => (
              <option key={team.team_id} value={team.team_id}>
                {team.team_name} ({team.member_count} members)
                {team.is_hc ? ' [HC]' : ''}
                {team.is_corps ? ' [Corps]' : ''}
                {team.is_female ? ' [Female]' : ''}
              </option>
            ))}
          </SimpleSelect>
        </CardContent>
      </Card>

      {selectedTeam && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-500" />
                Team Members ({teamMembers.length})
              </h3>
              {teamMembers.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No members assigned to this team for this race</p>
                </div>
              ) : (
                <DataTable
                  columns={memberColumns}
                  data={teamMembers}
                  pageSize={10}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-success" />
                Available Competitors ({availableCompetitors.length})
              </h3>
              {availableCompetitors.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>All competitors have been assigned to teams</p>
                </div>
              ) : (
                <DataTable
                  columns={availableColumns}
                  data={availableCompetitors}
                  pageSize={10}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
