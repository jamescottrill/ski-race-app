import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Trophy,
  Users,
  Medal,
  ArrowLeft,
  Award,
  Star,
  Download
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
        AND r.is_team
      ORDER BY r.race_date ASC`;
    const res = await window.api.select(query, [competitionId]);
    setRaces(res);
    return res;
  };

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      try {
        const initialRaces = await completedRaces();
        if (initialRaces.length === 0) {
          setTeamResults([]);
          setLoading(false);
          return;
        }

        let data;
        if (initialRaces.length > 3) {
          data = await fetchSeedList(
            competitionId,
            initialRaces.filter((e) => !e.isSeeding).map((e) => e.id),
          );
        } else {
          data = await fetchSeedList(
            competitionId,
            initialRaces.map((e) => e.id),
          );
        }
        setTeamResults(data);
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
        header: 'Rank',
        accessorKey: 'title',
        cell: ({ row }) => row.original.title || '-'
      },
      {
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="font-medium">
            {row.original.last_name?.toUpperCase()} {row.original.first_name}
          </div>
        )
      },
      {
        header: 'Team',
        accessorKey: 'team_name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-400" />
            <span>{row.original.team_name || '-'}</span>
          </div>
        )
      }
    ];

    const raceColumns = raceList.map((race) => ({
      header: race.text,
      accessorKey: race.id.toString(),
      cell: ({ row }) => (
        <div className="text-center font-mono">
          {row.original[race.id] || '-'}
        </div>
      )
    }));

    const totalColumn = {
      header: 'Overall Points',
      accessorKey: 'seed_points',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" />
          <span className="font-bold text-lg">
            {row.original.seed_points?.toFixed(2) || '0.00'}
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
    highestPoints: teamResults.length > 0 ? teamResults[0]?.seed_points?.toFixed(2) || 0 : 0,
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
              <p className="text-sm text-neutral-600">Total Competitors</p>
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
              <p className="text-2xl font-bold text-warning">{stats.highestPoints}</p>
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
                No team race results available yet. Complete at least one team race to see standings.
              </p>
            </div>
          ) : (
            <DataTable
              columns={createColumns(races)}
              data={teamResults}
              pageSize={50}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default TeamResultsNew;