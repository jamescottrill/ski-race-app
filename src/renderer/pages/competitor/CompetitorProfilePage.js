import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Trophy,
  TrendingUp,
  Calendar,
  MapPin,
  Flag,
  Activity,
  BarChart3,
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge,
  DataTable,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../design-system';
import {
  getCompetitorBio,
  getCompetitorRaceHistory,
  getCompetitorStats,
  getRaceSeedPointsForCompetitor,
  RACE_TYPE_COLOURS,
  RACE_TYPE_NAMES,
} from '../../queries/CompetitorHistory';
import PerformanceChart from '../../components/charts/PerformanceChart';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}`;
};

const getStatus = (race) => {
  if (race.run1_dns || race.run2_dns) return { label: 'DNS', variant: 'warning' };
  if (race.run1_dnf || race.run2_dnf) return { label: 'DNF', variant: 'danger' };
  if (race.run1_dsq || race.run2_dsq) return { label: 'DSQ', variant: 'danger' };
  if (race.run1_time) return { label: 'Finished', variant: 'success' };
  return { label: 'Pending', variant: 'default' };
};

export default function CompetitorProfilePage() {
  const { competitorId, competitionId } = useParams();
  const navigate = useNavigate();

  const [competitor, setCompetitor] = useState(null);
  const [raceHistory, setRaceHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (competitorId) {
      fetchData();
    }
  }, [competitorId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bio, history, statistics, seedPoints] = await Promise.all([
        getCompetitorBio(competitorId),
        getCompetitorRaceHistory(competitorId),
        getCompetitorStats(competitorId),
        getRaceSeedPointsForCompetitor(competitorId),
      ]);

      setCompetitor(bio);
      setRaceHistory(history);
      setStats(statistics);
      setChartData(seedPoints);
    } catch (error) {
      console.error('Failed to fetch competitor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (competitionId) {
      navigate(`/competition/${competitionId}/competitor/list`);
    } else {
      navigate('/competitor/find');
    }
  };

  const validSeedPoints = raceHistory
    .map((d) => d.earned_seed_points)
    .filter((p) => p != null && p >= 0);
  const bestSeedPoints = validSeedPoints.length > 0
    ? Math.min(...validSeedPoints)
    : null;

  const completionRate = stats
    ? ((stats.completed_races / stats.total_races) * 100).toFixed(0)
    : 0;

  const raceHistoryColumns = [
    {
      header: 'Date',
      accessorKey: 'race_date',
      cell: ({ row }) => formatDate(row.original.race_date),
    },
    {
      header: 'Competition',
      accessorKey: 'competition_name',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.competition_name}</span>
      ),
    },
    {
      header: 'Race',
      accessorKey: 'race_name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            style={{
              borderColor: RACE_TYPE_COLOURS[row.original.race_type],
              color: RACE_TYPE_COLOURS[row.original.race_type],
            }}
          >
            {row.original.race_type}
          </Badge>
          <button
            type="button"
            className="text-primary-600 hover:text-primary-800 hover:underline text-left"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/competition/${row.original.competition_id}/race/${row.original.race_id}/results`);
            }}
          >
            {row.original.race_name}
          </button>
        </div>
      ),
    },
    {
      header: 'Bib',
      accessorKey: 'bib_number',
    },
    {
      header: 'Run 1',
      accessorKey: 'run1_time',
      cell: ({ row }) => formatTime(row.original.run1_time),
    },
    {
      header: 'Run 2',
      accessorKey: 'run2_time',
      cell: ({ row }) =>
        row.original.number_runs > 1 ? formatTime(row.original.run2_time) : '-',
    },
    {
      header: 'Total',
      accessorKey: 'total_time',
      cell: ({ row }) => {
        const r = row.original;
        if (!r.run1_time) return '-';
        const total = r.number_runs > 1 && r.run2_time
          ? r.run1_time + r.run2_time
          : r.run1_time;
        return formatTime(total);
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => {
        const status = getStatus(row.original);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      header: 'Earned Pts',
      accessorKey: 'earned_seed_points',
      cell: ({ row }) =>
        row.original.earned_seed_points != null
          ? row.original.earned_seed_points.toFixed(2)
          : '-',
    },
  ];

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-500">Loading competitor profile...</div>
        </div>
      </PageContainer>
    );
  }

  if (!competitor) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-64">
          <User className="w-16 h-16 text-neutral-300 mb-4" />
          <p className="text-neutral-600">Competitor not found</p>
          <Button variant="outline" onClick={handleBack} className="mt-4">
            Go Back
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`${competitor.title ? competitor.title + ' ' : ''}${competitor.first_name} ${competitor.last_name}`}
        subtitle="Competitor Performance Profile"
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

      <div className="space-y-6">
        {/* Competitor Info Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <div className="p-4 bg-primary-100 rounded-xl">
                <User className="w-12 h-12 text-primary-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-neutral-900">
                    {competitor.title && `${competitor.title} `}
                    {competitor.first_name} {competitor.last_name}
                  </h2>
                  <Badge variant={competitor.gender === 'F' ? 'warning' : 'info'}>
                    {competitor.gender === 'F' ? 'Female' : 'Male'}
                  </Badge>
                </div>
                <div className="flex items-center gap-6 text-neutral-600">
                  {competitor.birth_year && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Born {competitor.birth_year}</span>
                    </div>
                  )}
                  {competitor.country && (
                    <div className="flex items-center gap-1">
                      <Flag className="w-4 h-4" />
                      <span>{competitor.country}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>ID: {competitor.id}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Trophy className="w-5 h-5 text-primary-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {stats?.total_competitions || 0}
                  </p>
                  <p className="text-sm text-neutral-600">Competitions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {stats?.total_races || 0}
                  </p>
                  <p className="text-sm text-neutral-600">Races</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {bestSeedPoints !== null ? bestSeedPoints.toFixed(2) : '-'}
                  </p>
                  <p className="text-sm text-neutral-600">Best Seed Pts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {completionRate}%
                  </p>
                  <p className="text-sm text-neutral-600">Completion Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Race History & Charts */}
        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="history" className="w-full">
              <div className="border-b px-4">
                <TabsList>
                  <TabsTrigger value="history">Race History</TabsTrigger>
                  <TabsTrigger value="charts">Performance Charts</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="history" className="p-0">
                {raceHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                    <p className="text-neutral-600">No race history found for this competitor.</p>
                  </div>
                ) : (
                  <DataTable columns={raceHistoryColumns} data={raceHistory} />
                )}
              </TabsContent>

              <TabsContent value="charts" className="p-6">
                {chartData.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                    <p className="text-neutral-600">No completed races to chart.</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                      Average Performance by Race Type
                    </h3>
                    <p className="text-sm text-neutral-600 mb-4">
                      Comparison of average seed points across different disciplines.
                    </p>
                    <PerformanceChart data={chartData} />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
