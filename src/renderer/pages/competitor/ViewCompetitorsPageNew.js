import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Users,
  Edit,
  ArrowLeft,
  UserCheck,
  Award,
  Shield,
  ChevronRight,
  User,
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
import { calculateCategory } from '../../utils/CompetitorManagement';

export default function ViewCompetitorsPageNew() {
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();

  const fetchCompetitors = async () => {
    setLoading(true);
    const query = `
      SELECT p.id, p.first_name, p.last_name, p.gender, p.birth_year, p.id AS service_number, p.country,
             cc.regiment, cc.is_novice, cc.is_reserve, cc.is_junior, cc.is_senior, cc.is_veteran, cc.title
      FROM people p
      INNER JOIN competition_competitor cc ON p.id = cc.racer_id
      WHERE cc.competition_id = ?
      ORDER BY first_name
    `;

    try {
      const result = await window.api.select(query, [competitionId]);
      setCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitors();
  }, [competitionId]);

  const columns = [
    {
      header: 'Name',
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-neutral-900">
            {row.original.first_name} {row.original.last_name}
          </div>
          {row.original.title && (
            <div className="text-xs text-neutral-500">{row.original.title}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Gender',
      accessorKey: 'gender',
      cell: ({ row }) => (
        <Badge variant={row.original.gender === 'M' ? 'info' : 'warning'}>
          {row.original.gender === 'M' ? 'Male' : 'Female'}
        </Badge>
      ),
    },
    {
      header: 'Regiment/Unit',
      accessorKey: 'regiment',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary-400" />
          <span className="text-sm">{row.original.regiment || 'Not assigned'}</span>
        </div>
      ),
    },
    {
      header: 'Category',
      accessorKey: 'category',
      cell: ({ row }) => {
        const category = calculateCategory(row.original);
        const getCategoryColor = (cat) => {
          if (cat.includes('Novice')) return 'success';
          if (cat.includes('Junior')) return 'info';
          if (cat.includes('Senior')) return 'primary';
          if (cat.includes('Veteran')) return 'warning';
          return 'default';
        };
        return (
          <Badge variant={getCategoryColor(category)}>
            {category}
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/competition/${competitionId}/competitor/${row.original.id}/profile`);
            }}
            leftIcon={<User className="w-3 h-3" />}
          >
            Profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/competition/${competitionId}/competitor/${row.original.id}/edit`);
            }}
            leftIcon={<Edit className="w-3 h-3" />}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  // Calculate stats
  const stats = {
    total: competitors.length,
    male: competitors.filter(c => c.gender === 'M').length,
    female: competitors.filter(c => c.gender === 'F').length,
    novice: competitors.filter(c => c.is_novice).length,
  };

  return (
    <PageContainer>
      <PageHeader
        title="View Competitors"
        subtitle={`${competitors.length} competitors registered`}
        actions={
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => navigate(`/competition/${competitionId}/competitor/new`)}
              leftIcon={<Users className="w-4 h-4" />}
            >
              Add Competitor
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
              <p className="text-2xl font-bold text-primary-700">{stats.total}</p>
              <p className="text-sm text-neutral-600">Total Athletes</p>
            </div>
            <Users className="w-8 h-8 text-primary-300" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-info">{stats.male}</p>
              <p className="text-sm text-neutral-600">Male</p>
            </div>
            <UserCheck className="w-8 h-8 text-info/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-warning">{stats.female}</p>
              <p className="text-sm text-neutral-600">Female</p>
            </div>
            <UserCheck className="w-8 h-8 text-warning/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-success">{stats.novice}</p>
              <p className="text-sm text-neutral-600">Novice</p>
            </div>
            <Award className="w-8 h-8 text-success/30" />
          </div>
        </Card>
      </div>

      {/* Competitors Table */}
      <Card>
        <CardContent noPadding>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">Loading competitors...</div>
            </div>
          ) : competitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Users className="w-12 h-12 text-neutral-300" />
              <p className="text-neutral-500">No competitors registered yet</p>
              <Button
                variant="primary"
                onClick={() => navigate(`/competition/${competitionId}/competitor/new`)}
                leftIcon={<Users className="w-4 h-4" />}
              >
                Register First Competitor
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={competitors}
              onRowClick={(row) => navigate(`/competition/${competitionId}/competitor/${row.id}/edit`)}
              pageSize={25}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
