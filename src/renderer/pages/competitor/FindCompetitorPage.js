import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  User,
  Trophy,
  ChevronRight,
  Users,
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  DataTable,
} from '../../design-system';
import { getAllCompetitors, searchCompetitors } from '../../queries/CompetitorHistory';

export default function FindCompetitorPage() {
  const navigate = useNavigate();
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    try {
      setLoading(true);
      const result = await getAllCompetitors();
      setCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompetitors = useMemo(() => {
    if (!searchTerm.trim()) {
      return competitors;
    }
    const term = searchTerm.toLowerCase();
    return competitors.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(term) ||
      c.first_name?.toLowerCase().includes(term) ||
      c.last_name?.toLowerCase().includes(term)
    );
  }, [competitors, searchTerm]);

  const columns = [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-neutral-400" />
          <span className="font-medium">
            {row.original.title && `${row.original.title} `}
            {row.original.first_name} {row.original.last_name}
          </span>
        </div>
      ),
    },
    {
      header: 'Gender',
      accessorKey: 'gender',
      cell: ({ row }) => (
        <Badge variant={row.original.gender === 'F' ? 'warning' : 'info'}>
          {row.original.gender === 'F' ? 'Female' : 'Male'}
        </Badge>
      ),
    },
    {
      header: 'Birth Year',
      accessorKey: 'birth_year',
    },
    {
      header: 'Country',
      accessorKey: 'country',
    },
    {
      header: 'Competitions',
      accessorKey: 'competition_count',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>{row.original.competition_count || 0}</span>
        </div>
      ),
    },
    {
      header: '',
      accessorKey: 'actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/competitor/${row.original.id}/profile`);
          }}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  const handleRowClick = (row) => {
    navigate(`/competitor/${row.id}/profile`);
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-500">Loading competitors...</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Find Competitor"
        subtitle="Search and view competitor performance history"
        actions={
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Users className="w-5 h-5 text-primary-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">{competitors.length}</p>
                  <p className="text-sm text-neutral-600">Total Competitors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Search className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">{filteredCompetitors.length}</p>
                  <p className="text-sm text-neutral-600">Matching Results</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardContent className="p-0">
            {filteredCompetitors.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-600">
                  {searchTerm ? 'No competitors found matching your search.' : 'No competitors in database.'}
                </p>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={filteredCompetitors}
                onRowClick={handleRowClick}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
