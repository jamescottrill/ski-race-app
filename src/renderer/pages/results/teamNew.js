import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Trophy, 
  Users, 
  Medal,
  ArrowLeft,
  Award,
  Star
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

function TeamResultsNew() {
  const { competitionId } = useParams();
  const [teamResults, setTeamResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const handleBack = useBackButton();

  useEffect(() => {
    fetchTeamResults();
  }, [competitionId]);

  const fetchTeamResults = async () => {
    setLoading(true);
    try {
      // Fetch team results with aggregated scores
      const query = `
        SELECT 
          ct.team_name,
          ct.team_id,
          COUNT(DISTINCT ctm.racer_id) as team_size,
          SUM(rr.points) as total_points,
          MIN(rr.total_time) as best_time
        FROM competition_team ct
        LEFT JOIN competition_team_members ctm ON ct.team_id = ctm.team_id
        LEFT JOIN race_results rr ON ctm.racer_id = rr.competitor_id
        WHERE ct.competition_id = ?
        GROUP BY ct.team_id, ct.team_name
        ORDER BY total_points DESC
      `;
      
      const results = await window.api.select(query, [competitionId]);
      
      // Add position numbers
      const rankedResults = results.map((team, index) => ({
        ...team,
        position: index + 1
      }));
      
      setTeamResults(rankedResults);
    } catch (error) {
      console.error('Failed to fetch team results:', error);
      setTeamResults([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
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
      header: 'Team Name',
      accessorKey: 'team_name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary-400" />
          <span className="font-medium text-neutral-900">{row.original.team_name}</span>
        </div>
      ),
    },
    {
      header: 'Team Size',
      accessorKey: 'team_size',
      cell: ({ row }) => (
        <Badge variant="default">
          {row.original.team_size} members
        </Badge>
      ),
    },
    {
      header: 'Total Points',
      accessorKey: 'total_points',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" />
          <span className="font-bold text-lg">{row.original.total_points || 0}</span>
        </div>
      ),
    },
    {
      header: 'Best Time',
      accessorKey: 'best_time',
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.best_time || '--:--'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => {
        const position = row.original.position;
        if (position <= 3) {
          return <Badge variant="success">Podium</Badge>;
        } else if (position <= 10) {
          return <Badge variant="info">Top 10</Badge>;
        }
        return <Badge variant="default">Competing</Badge>;
      },
    },
  ];

  // Calculate stats
  const stats = {
    totalTeams: teamResults.length,
    avgTeamSize: teamResults.length > 0 
      ? Math.round(teamResults.reduce((sum, t) => sum + (t.team_size || 0), 0) / teamResults.length)
      : 0,
    highestPoints: teamResults.length > 0 ? teamResults[0]?.total_points || 0 : 0,
  };

  return (
    <PageContainer>
      <PageHeader
        title="Team Results"
        subtitle="Competition team standings and scores"
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

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
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
              <p className="text-2xl font-bold text-success">{stats.avgTeamSize}</p>
              <p className="text-sm text-neutral-600">Avg Team Size</p>
            </div>
            <Users className="w-8 h-8 text-success/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-warning">{stats.highestPoints}</p>
              <p className="text-sm text-neutral-600">Leading Score</p>
            </div>
            <Trophy className="w-8 h-8 text-warning/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-info">3</p>
              <p className="text-sm text-neutral-600">Podium Places</p>
            </div>
            <Medal className="w-8 h-8 text-info/30" />
          </div>
        </Card>
      </div>

      {/* Results Table */}
      <Card>
        <CardContent noPadding>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">Loading team results...</div>
            </div>
          ) : teamResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Trophy className="w-12 h-12 text-neutral-300" />
              <p className="text-neutral-500">No team results available yet</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={teamResults}
              pageSize={25}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default TeamResultsNew;