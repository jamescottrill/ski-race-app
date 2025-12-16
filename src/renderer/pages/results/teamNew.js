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
import { fetchSeedList } from '../../utils/FetchSeedList';
import { generatePDF } from '../../pdfs/SeedList';

function TeamResultsNew() {
  const { competitionId } = useParams();
  const [teamResults, setTeamResults] = useState([]);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const handleBack = useBackButton();

  const completedRaces = async () => {
    const query = `
      SELECT
        DISTINCT rr.race_id AS id, r.race_name AS text, r.race_date AS raceDate, r.is_seeding AS isSeeding
      FROM race_run rr
        INNER JOIN races r ON r.race_id = rr.race_id
      WHERE rr.competition_id = ?
        AND NOT r.is_training
        AND rr.is_complete
        AND r.is_individual
      ORDER BY r.race_date ASC`;
    const res = await window.api.select(query, [competitionId]);
    setRaces(res);
    return res;
  };

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      try {
        console.log('TeamResultsNew: Fetching team results for competition:', competitionId);
        const initialRaces = await completedRaces();
        console.log('TeamResultsNew: Found races:', initialRaces);

        if (initialRaces.length === 0) {
          setTeamResults([]);
          setLoading(false);
          return;
        }

        // Fetch individual results with team info
        let individualData;
        if (initialRaces.length > 3) {
          individualData = await fetchSeedList(
            competitionId,
            initialRaces.filter((e) => !e.isSeeding).map((e) => e.id),
          );
        } else {
          individualData = await fetchSeedList(
            competitionId,
            initialRaces.map((e) => e.id),
          );
        }

        // Filter to only include competitors who completed all races
        individualData = individualData.filter((competitor) => {
          for (const race of initialRaces) {
            if (competitor[race.id] === null || competitor[race.id] === undefined) {
              return false;
            }
          }
          return true;
        });

        console.log('TeamResultsNew: Individual data:', individualData);

        // Group by team
        const teamMap = new Map();

        individualData.forEach((competitor) => {
          const teamName = competitor.team_name || competitor.regiment;
          if (!teamName) return;

          if (!teamMap.has(teamName)) {
            teamMap.set(teamName, {
              team_name: teamName,
              members: []
            });
          }

          teamMap.get(teamName).members.push(competitor);
        });

        // Calculate team standings
        const teamStandings = [];

        teamMap.forEach((team, teamName) => {
          const teamResult = {
            team_name: teamName,
            member_count: team.members.length
          };

          // For each race, sum the top 3 members' points
          initialRaces.forEach((race) => {
            const memberPoints = team.members
              .map(m => parseFloat(m[race.id]) || 0)
              .sort((a, b) => a - b) // Lower points are better
              .slice(0, 3); // Top 3

            // Only include if team has at least 3 members who completed the race
            if (memberPoints.length >= 3) {
              teamResult[race.id] = memberPoints.reduce((sum, p) => sum + p, 0);
            } else {
              teamResult[race.id] = null;
            }
          });

          // Calculate total points (sum of all race points)
          let total = 0;
          let validRaces = 0;
          initialRaces.forEach((race) => {
            if (teamResult[race.id] !== null) {
              total += teamResult[race.id];
              validRaces++;
            }
          });

          // Only include teams that completed all races with 3+ members
          if (validRaces === initialRaces.length) {
            teamResult.total_points = total;
            teamStandings.push(teamResult);
          }
        });

        // Sort by total points
        teamStandings.sort((a, b) => a.total_points - b.total_points);

        // Add positions
        let position = 1;
        let previousTotal = null;
        teamStandings.forEach((team, index) => {
          if (previousTotal !== null && team.total_points !== previousTotal) {
            position = index + 1;
          }
          team.position = position;
          previousTotal = team.total_points;
        });

        console.log('TeamResultsNew: Team standings:', teamStandings);
        setTeamResults(teamStandings);
      } catch (error) {
        console.error('Failed to fetch team results:', error);
        setTeamResults([]);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
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
          if (position === 1) {
            return (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center text-white font-bold">
                  {position}
                </div>
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
            );
          } else if (position === 2) {
            return (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center text-white font-bold">
                  {position}
                </div>
                <Medal className="w-5 h-5 text-gray-500" />
              </div>
            );
          } else if (position === 3) {
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
