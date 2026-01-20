import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Users, Medal, ArrowLeft, Star, Download } from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { generatePDF } from '../../pdfs/SeedList';
import { fetchSeedList } from '../../utils/FetchSeedList';

function TeamResultsNew() {
  const { competitionId } = useParams();
  const [teamResults, setTeamResults] = useState([]);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const handleBack = useBackButton();

  useEffect(() => {
    const fetchTeamResults = async () => {
      setLoading(true);
      try {
        // Get completed team races
        const racesQuery = `
          SELECT DISTINCT rr.race_id AS id, r.race_name AS text, r.race_date AS raceDate, r.is_seeding AS isSeeding
          FROM race_run rr
            INNER JOIN races r ON r.race_id = rr.race_id AND r.competition_id = rr.competition_id
          WHERE rr.competition_id = ?
            AND NOT r.is_training
            AND NOT r.is_seeding
            AND rr.is_complete
            AND r.is_team
          ORDER BY r.race_date ASC
        `;
        const raceList = await window.api.select(racesQuery, [competitionId]);
        setRaces(raceList);

        if (raceList.length === 0) {
          setTeamResults([]);
          setLoading(false);
          return;
        }

        // Get seed points for all competitors using fetchSeedList
        let seedListData = await fetchSeedList(
            competitionId,
            raceList.map((e) => e.id)
          );

        // Get teams from competition_team
        const teamsQuery = `
          SELECT team_id, team_name, is_corps, is_reserve, is_female, is_hc
          FROM competition_team
          WHERE competition_id = ?
        `;
        const teams = await window.api.select(teamsQuery, [competitionId]);

        // For each team, get members and their seed points for each race
        const teamStandings = [];

        for (const team of teams) {
          const teamResult = {
            team_id: team.team_id,
            team_name: team.team_name,
            is_corps: team.is_corps,
            is_reserve: team.is_reserve,
            is_female: team.is_female,
            is_hc: team.is_hc,
            member_count: 0,
          };

          let totalPoints = 0;
          let validRaceCount = 0;

          for (const race of raceList) {
            // Get team members for this race
            const membersQuery = `
              SELECT ctm.racer_id
              FROM competition_team_members ctm
              WHERE ctm.competition_id = ?
                AND ctm.team_id = ?
                AND ctm.race_id = ?
            `;
            const members = await window.api.select(membersQuery, [
              competitionId,
              team.team_id,
              race.id,
            ]);

            // Update member count (use max across all races)
            if (members.length > teamResult.member_count) {
              teamResult.member_count = members.length;
            }
            // Get seed points for each team member from the seed list
            // Only include actual finishing seed points, not artificial/penalty points
            const memberSeedPoints = members
              .map((member) => {
                const seedData = seedListData.find(
                  (s) => s.racer_id === member.racer_id
                );
                // Check if this racer has actual (non-penalty) seed points for this race
                if (
                  seedData &&
                  seedData[race.id] !== null &&
                  seedData[race.id] !== undefined &&
                  !seedData[`${race.id}-penalty`]
                ) {
                  return parseFloat(seedData[race.id]);
                }
                return null;
              })
              .filter((p) => p !== null && !isNaN(p))
              .sort((a, b) => a - b);

            // Determine how many members count based on team type
            // Corps women: 2, Corps men: 4, Regular: 3
            let countingMembers = 3;
            if (team.is_corps) {
              countingMembers = team.is_female ? 2 : 4;
            }

            // Sum the top N members' seed points
            const topPoints = memberSeedPoints.slice(0, countingMembers);

            if (topPoints.length >= countingMembers) {
              const raceTotal = topPoints.reduce((sum, p) => sum + p, 0);
              teamResult[race.id] = raceTotal;
              totalPoints += raceTotal;
              validRaceCount += 1;
            } else {
              teamResult[race.id] = null;
            }
          }

          // Only include teams that have valid results for all races
          if (validRaceCount === raceList.length) {
            teamResult.total_points = totalPoints;
            teamStandings.push(teamResult);
          }
        }

        // Sort all teams by total points (lower is better)
        teamStandings.sort((a, b) => a.total_points - b.total_points);

        // Add positions with tie handling (only for non-HC teams)
        let position = 1;
        let previousTotal = null;
        let previousIndex = 0;
        teamStandings.forEach((team, index) => {
          if (team.is_hc) {
            // HC teams don't get a position
            team.position = 'HC';
          } else {
            // Only increment position based on non-HC teams
            if (previousTotal !== null && team.total_points !== previousTotal) {
              position = previousIndex + 1;
            }
            team.position = position;
            previousTotal = team.total_points;
            previousIndex += 1;
          }
        });

        setTeamResults(teamStandings);
      } catch (error) {
        console.error('Failed to fetch team results:', error);
        setTeamResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamResults();
  }, [competitionId]);

  const seedListPdf = () => {
    generatePDF(teamResults, races);
  };

  const createColumns = (raceList) => {
    const baseColumns = [
      {
        header: 'Position',
        accessorKey: 'position',
        cell: ({ row }) => {
          const position = row.original.position;
          const isHc = row.original.is_hc;

          if (isHc) {
            return (
              <div className="w-8 h-8 bg-neutral-100 border border-neutral-300 rounded-full flex items-center justify-center text-neutral-500 font-semibold text-xs">
                HC
              </div>
            );
          }

          if (position === 1) {
            return (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center text-white font-bold">
                  {position}
                </div>
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
            );
          }
          if (position === 2) {
            return (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center text-white font-bold">
                  {position}
                </div>
                <Medal className="w-5 h-5 text-gray-500" />
              </div>
            );
          }
          if (position === 3) {
            return (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                  {position}
                </div>
                <Medal className="w-5 h-5 text-orange-600" />
              </div>
            );
          }
          return (
            <div className="w-8 h-8 bg-neutral-200 rounded-full flex items-center justify-center text-neutral-700 font-semibold">
              {position}
            </div>
          );
        },
      },
      {
        header: 'Team',
        accessorKey: 'team_name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-400" />
            <span className="font-medium">{row.original.team_name || '-'}</span>
          </div>
        )
      },
      {
        header: 'Members',
        accessorKey: 'member_count',
        cell: ({ row }) => (
          <div className="text-center">{row.original.member_count || 0}</div>
        )
      }
    ];

    const raceColumns = raceList.map((race) => ({
      header: race.text,
      accessorKey: race.id.toString(),
      cell: ({ row }) => {
        const value = row.original[race.id];
        return (
          <div className="text-center font-mono">
            {value !== null && value !== undefined ? value.toFixed(2) : '-'}
          </div>
        );
      }
    }));

    const totalColumn = {
      header: 'Total Points',
      accessorKey: 'total_points',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 justify-center">
          <Star className="w-4 h-4 text-warning" />
          <span className="font-bold text-lg">
            {row.original.total_points?.toFixed(2) || '0.00'}
          </span>
        </div>
      )
    };

    return [...baseColumns, ...raceColumns, totalColumn];
  };

  // Calculate stats
  const stats = {
    totalTeams: teamResults.length,
    completedRaces: races.length,
    leadingScore:
      teamResults.length > 0 ? teamResults[0]?.total_points?.toFixed(2) || 0 : 0,
  };

  return (
    <PageContainer>
      <PageHeader
        title="Team Results"
        subtitle="Competition team standings and scores"
        actions={
          <div className="flex gap-3">
            {teamResults.length > 0 && (
              <Button
                variant="primary"
                onClick={seedListPdf}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download PDF
              </Button>
            )}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary-700">{stats.totalTeams}</p>
              <p className="text-sm text-neutral-600">Total Teams</p>
            </div>
            <Users className="w-8 h-8 text-primary-300" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-success">{stats.completedRaces}</p>
              <p className="text-sm text-neutral-600">Completed Races</p>
            </div>
            <Trophy className="w-8 h-8 text-success/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-warning">{stats.leadingScore}</p>
              <p className="text-sm text-neutral-600">Leading Score</p>
            </div>
            <Star className="w-8 h-8 text-warning/30" />
          </div>
        </Card>
      </div>

      {/* Results Table */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">Loading team results...</div>
            </div>
          ) : teamResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Trophy className="w-12 h-12 text-neutral-300" />
              <p className="text-neutral-500">
                No team standings available. Teams need at least 3 members who have completed all individual races.
              </p>
            </div>
          ) : (
            <DataTable
              columns={createColumns(races)}
              data={teamResults}
              pageSize={50}
              enableSorting={false}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default TeamResultsNew;
