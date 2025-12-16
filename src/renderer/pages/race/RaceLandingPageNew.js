import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Plus, 
  Eye, 
  Trophy,
  Calendar,
  MapPin,
  ArrowLeft,
  ChartBar,
  Users,
  User
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function RaceLandingPageNew() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  const fetchRaces = async () => {
    setLoading(true);
    const query = `
      SELECT race_id AS id, race_name, race_type, is_team, race_date, venue, number_runs
      FROM races
      WHERE competition_id = ?
      ORDER BY race_date
    `;
    const params = [competitionId];

    try {
      const result = await window.api.select(query, params);
      setRaces(result);
    } catch (error) {
      console.error('Failed to fetch races:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRaces();
  }, [competitionId]);

  const columns = [
    {
      header: 'Race Name',
      accessorKey: 'race_name',
      cell: ({ row }) => (
        <div className="font-medium text-neutral-900">
          {row.original.race_name}
        </div>
      ),
    },
    {
      header: 'Type',
      accessorKey: 'race_type',
      cell: ({ row }) => (
        <span className={cn(
          'px-2 py-1 rounded-md text-xs font-medium',
          row.original.race_type === 'Slalom' && 'bg-blue-100 text-blue-700',
          row.original.race_type === 'Giant Slalom' && 'bg-purple-100 text-purple-700',
          row.original.race_type === 'Super G' && 'bg-orange-100 text-orange-700',
          row.original.race_type === 'Downhill' && 'bg-red-100 text-red-700',
          row.original.race_type === 'Alpine Combined' && 'bg-green-100 text-green-700',
        )}>
          {row.original.race_type}
        </span>
      ),
    },
    {
      header: 'Format',
      accessorKey: 'is_team',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.is_team ? (
            <>
              <Users className="w-4 h-4 text-primary-600" />
              <span className="text-sm">Team</span>
            </>
          ) : (
            <>
              <User className="w-4 h-4 text-neutral-600" />
              <span className="text-sm">Individual</span>
            </>
          )}
        </div>
      ),
    },
    {
      header: 'Date',
      accessorKey: 'race_date',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <span className="text-sm">
            {row.original.race_date 
              ? new Date(row.original.race_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })
              : 'TBD'
            }
          </span>
        </div>
      ),
    },
    {
      header: 'Venue',
      accessorKey: 'venue',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-neutral-400" />
          <span className="text-sm">{row.original.venue || 'TBD'}</span>
        </div>
      ),
    },
    {
      header: 'Runs',
      accessorKey: 'number_runs',
      cell: ({ row }) => (
        <span className="px-2 py-1 bg-neutral-100 rounded-md text-sm font-medium">
          {row.original.number_runs} {row.original.number_runs === 1 ? 'run' : 'runs'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/competition/${competitionId}/race/${row.original.id}`);
            }}
            leftIcon={<Eye className="w-3 h-3" />}
          >
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/competition/${competitionId}/race/${row.original.id}/results`);
            }}
            leftIcon={<ChartBar className="w-3 h-3" />}
          >
            Results
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Races"
        subtitle="Manage competition races and events"
        actions={
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => navigate(`/competition/${competitionId}/race/new`)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Race
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

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary-700">{races.length}</p>
              <p className="text-sm text-neutral-600">Total Races</p>
            </div>
            <Trophy className="w-8 h-8 text-primary-300" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-success">
                {races.filter(r => r.is_team).length}
              </p>
              <p className="text-sm text-neutral-600">Team Races</p>
            </div>
            <Users className="w-8 h-8 text-success/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-info">
                {races.filter(r => !r.is_team).length}
              </p>
              <p className="text-sm text-neutral-600">Individual</p>
            </div>
            <User className="w-8 h-8 text-info/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-warning">
                {[...new Set(races.map(r => r.race_type))].length}
              </p>
              <p className="text-sm text-neutral-600">Race Types</p>
            </div>
            <ChartBar className="w-8 h-8 text-warning/30" />
          </div>
        </Card>
      </div>

      {/* Races Table */}
      <Card>
        <CardContent noPadding>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">Loading races...</div>
            </div>
          ) : races.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Trophy className="w-12 h-12 text-neutral-300" />
              <p className="text-neutral-500">No races created yet</p>
              <Button
                variant="primary"
                onClick={() => navigate(`/competition/${competitionId}/race/new`)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create First Race
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={races}
              onRowClick={(row) => navigate(`/competition/${competitionId}/race/${row.id}`)}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}