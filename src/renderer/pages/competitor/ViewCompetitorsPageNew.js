import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  UserX,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge,
  TextField,
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  SimpleSelect,
  Label,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { calculateCategory } from '../../utils/CompetitorManagement';
import { hashServiceNumber } from '../../utils/hashUtils';

export default function ViewCompetitorsPageNew() {
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [hashedSearchTerm, setHashedSearchTerm] = useState('');
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawCompetitor, setWithdrawCompetitor] = useState(null);
  const [completedRaces, setCompletedRaces] = useState([]);
  const [lastIncludedRaceId, setLastIncludedRaceId] = useState('');
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();

  // Hash the search term for service number comparison
  useEffect(() => {
    const updateHashedSearchTerm = async () => {
      if (searchTerm.trim()) {
        const hashed = await hashServiceNumber(searchTerm);
        setHashedSearchTerm(hashed || '');
      } else {
        setHashedSearchTerm('');
      }
    };
    updateHashedSearchTerm();
  }, [searchTerm]);

  const fetchCompetitors = async () => {
    setLoading(true);
    const query = `
      SELECT p.id, p.first_name, p.last_name, p.gender, p.birth_year, p.id AS service_number, p.country,
             cc.regiment, cc.is_novice, cc.is_reserve, cc.is_junior, cc.is_senior, cc.is_veteran, cc.title,
             cc.is_withdrawn
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

  const fetchCompletedRaces = async () => {
    try {
      const races = await window.api.select(`
        SELECT DISTINCT r.race_id, r.race_name, r.race_date
        FROM races r
        INNER JOIN race_run rr ON r.race_id = rr.race_id AND r.competition_id = rr.competition_id
        WHERE r.competition_id = ? AND rr.is_complete = 1
        ORDER BY r.race_date DESC
      `, [competitionId]);
      setCompletedRaces(races);
    } catch (error) {
      console.error('Failed to fetch completed races:', error);
    }
  };

  useEffect(() => {
    fetchCompetitors();
    fetchCompletedRaces();
  }, [competitionId]);

  const openWithdrawModal = useCallback((e, competitor) => {
    e.stopPropagation();
    setWithdrawCompetitor(competitor);
    setLastIncludedRaceId('');
    setWithdrawModalOpen(true);
  }, []);

  const handleWithdrawConfirm = async () => {
    if (!withdrawCompetitor) return;
    try {
      await window.api.insert(
        'UPDATE competition_competitor SET is_withdrawn = 1, last_included_race_id = ? WHERE racer_id = ? AND competition_id = ?',
        [lastIncludedRaceId || null, withdrawCompetitor.id, competitionId]
      );
      setWithdrawModalOpen(false);
      setWithdrawCompetitor(null);
      fetchCompetitors();
    } catch (error) {
      console.error('Failed to withdraw competitor:', error);
    }
  };

  const handleReinstate = useCallback(async (e, competitorId) => {
    e.stopPropagation();
    try {
      await window.api.insert(
        'UPDATE competition_competitor SET is_withdrawn = 0, last_included_race_id = NULL WHERE racer_id = ? AND competition_id = ?',
        [competitorId, competitionId]
      );
      fetchCompetitors();
    } catch (error) {
      console.error('Failed to reinstate competitor:', error);
    }
  }, [competitionId]);

  const activeCompetitors = useMemo(() =>
    competitors.filter(c => !c.is_withdrawn || c.is_withdrawn === 0),
    [competitors]
  );

  const withdrawnCompetitors = useMemo(() =>
    competitors.filter(c => c.is_withdrawn && c.is_withdrawn !== 0),
    [competitors]
  );

  const displayedCompetitors = useMemo(() => {
    const baseList = activeTab === 'active' ? activeCompetitors : withdrawnCompetitors;
    if (!searchTerm.trim()) return baseList;
    const term = searchTerm.toLowerCase();
    return baseList.filter(c =>
      c.first_name?.toLowerCase().includes(term) ||
      c.last_name?.toLowerCase().includes(term) ||
      c.regiment?.toLowerCase().includes(term) ||
      (hashedSearchTerm && c.service_number === hashedSearchTerm)
    );
  }, [activeTab, activeCompetitors, withdrawnCompetitors, searchTerm, hashedSearchTerm]);

  const columns = useMemo(() => [
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
      cell: ({ row }) => {
        const isWithdrawn = row.original.is_withdrawn && row.original.is_withdrawn !== 0;
        return (
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
            {!isWithdrawn ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-warning hover:text-warning hover:bg-warning/10"
                onClick={(e) => openWithdrawModal(e, row.original)}
                leftIcon={<UserX className="w-3 h-3" />}
              >
                Withdraw
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-success hover:text-success hover:bg-success/10"
                onClick={(e) => handleReinstate(e, row.original.id)}
                leftIcon={<RotateCcw className="w-3 h-3" />}
              >
                Reinstate
              </Button>
            )}
          </div>
        );
      },
    },
  ], [competitionId, navigate, openWithdrawModal, handleReinstate]);

  // Calculate stats (based on active competitors only)
  const stats = {
    total: activeCompetitors.length,
    male: activeCompetitors.filter(c => c.gender === 'M').length,
    female: activeCompetitors.filter(c => c.gender === 'F').length,
    novice: activeCompetitors.filter(c => c.is_novice).length,
    withdrawn: withdrawnCompetitors.length,
  };

  return (
    <PageContainer>
      <PageHeader
        title="View Competitors"
        subtitle={`${activeCompetitors.length} active competitors${withdrawnCompetitors.length > 0 ? `, ${withdrawnCompetitors.length} withdrawn` : ''}`}
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

      {/* Tabs and Search */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'active' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('active')}
            leftIcon={<Users className="w-4 h-4" />}
          >
            Active ({activeCompetitors.length})
          </Button>
          <Button
            variant={activeTab === 'withdrawn' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('withdrawn')}
            leftIcon={<UserX className="w-4 h-4" />}
          >
            Withdrawn ({withdrawnCompetitors.length})
          </Button>
        </div>
        <TextField
          placeholder="Search by name, regiment, or service number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="w-80"
        />
      </div>

      {/* Competitors Table */}
      <Card>
        <CardContent noPadding>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">Loading competitors...</div>
            </div>
          ) : displayedCompetitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Users className="w-12 h-12 text-neutral-300" />
              <p className="text-neutral-500">
                {activeTab === 'active' ? 'No competitors registered yet' : 'No withdrawn competitors'}
              </p>
              {activeTab === 'active' && (
                <Button
                  variant="primary"
                  onClick={() => navigate(`/competition/${competitionId}/competitor/new`)}
                  leftIcon={<Users className="w-4 h-4" />}
                >
                  Register First Competitor
                </Button>
              )}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={displayedCompetitors}
              onRowClick={(row) => navigate(`/competition/${competitionId}/competitor/${row.id}/edit`)}
              pageSize={25}
            />
          )}
        </CardContent>
      </Card>

      {/* Withdraw Modal */}
      <Modal open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Withdraw Competitor</ModalTitle>
            <ModalDescription>
              {withdrawCompetitor && (
                <>Withdrawing {withdrawCompetitor.first_name} {withdrawCompetitor.last_name}</>
              )}
            </ModalDescription>
          </ModalHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-neutral-600">
              This competitor will be removed from future seed lists and start lists.
              Their past race results will be preserved.
            </p>

            <div className="space-y-2">
              <Label htmlFor="lastIncludedRace">Last race to include in seed lists</Label>
              <SimpleSelect
                id="lastIncludedRace"
                value={lastIncludedRaceId}
                onChange={(e) => setLastIncludedRaceId(e.target.value)}
              >
                <option value="">None (exclude from all seed list calculations)</option>
                {completedRaces.map(race => (
                  <option key={race.race_id} value={race.race_id}>
                    {race.race_name} ({new Date(race.race_date).toLocaleDateString()})
                  </option>
                ))}
              </SimpleSelect>
              <p className="text-xs text-neutral-500">
                The competitor will appear in seed list calculations up to and including this race.
                This helps preserve accurate penalty point calculations for other competitors.
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={handleWithdrawConfirm}
              leftIcon={<UserX className="w-4 h-4" />}
            >
              Withdraw
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageContainer>
  );
}
