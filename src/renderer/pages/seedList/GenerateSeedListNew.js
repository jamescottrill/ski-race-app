import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Hash,
  Download,
  ArrowLeft,
  Calculator,
  FileText,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge,
  SimpleSelect,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { fetchSeedList } from '../../utils/FetchSeedList';

function GenerateSeedListNew() {
  const { competitionId } = useParams();
  const [seedList, setSeedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRace, setSelectedRace] = useState('');
  const [races, setRaces] = useState([]);
  const [generationStatus, setGenerationStatus] = useState(null);
  const navigate = useNavigate();
  const handleBack = useBackButton();

  useEffect(() => {
    fetchRaces();
  }, [competitionId]);

  const fetchRaces = async () => {
    try {
      const query = `
        SELECT race_id, race_name, race_type, is_team
        FROM races
        WHERE competition_id = ?
        ORDER BY race_date
      `;
      const result = await window.api.select(query, [competitionId]);
      setRaces(result);
    } catch (error) {
      console.error('Failed to fetch races:', error);
    }
  };

  const handleGenerateSeedList = async () => {
    if (!selectedRace) {
      setGenerationStatus({ type: 'error', message: 'Please select a race first' });
      return;
    }

    setLoading(true);
    setGenerationStatus({ type: 'info', message: 'Generating seed list...' });

    try {
      const seeds = await fetchSeedList(competitionId);
      setSeedList(seeds);
      setGenerationStatus({ type: 'success', message: `Generated seed list with ${seeds.length} competitors` });
    } catch (error) {
      console.error('Failed to generate seed list:', error);
      setGenerationStatus({ type: 'error', message: 'Failed to generate seed list' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    // PDF export logic would go here
    setGenerationStatus({ type: 'info', message: 'PDF export coming soon' });
  };

  const columns = [
    {
      header: 'Rank',
      accessorKey: 'rank',
      cell: ({ row, table }) => {
        const rank = table.getSortedRowModel().rows.indexOf(row) + 1;
        return (
          <div className="font-bold text-lg text-primary-700">
            #{rank}
          </div>
        );
      },
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-neutral-900">
            {row.original.first_name} {row.original.last_name}
          </div>
          {row.original.regiment && (
            <div className="text-xs text-neutral-500">{row.original.regiment}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Category',
      accessorKey: 'category',
      cell: ({ row }) => {
        const categories = [];
        if (row.original.gender === 'F') categories.push('F');
        if (row.original.is_junior) categories.push('J');
        if (row.original.is_senior) categories.push('S');
        if (row.original.is_veteran) categories.push('V');
        if (row.original.is_novice) categories.push('N');
        if (row.original.is_reserve) categories.push('R');

        return (
          <div className="flex gap-1">
            {categories.map(cat => (
              <Badge key={cat} variant="info" size="sm">
                {cat}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      header: 'Seed Points',
      accessorKey: 'totalSeed',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary-400" />
          <span className="font-mono font-bold text-lg">
            {row.original.totalSeed?.toFixed(2) || '0.00'}
          </span>
        </div>
      ),
    },
    {
      header: 'Breakdown',
      accessorKey: 'breakdown',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Arrival:</span>
            <span className="font-mono">{row.original.arrival_seed || 0}</span>
          </div>
          {row.original.army_seed && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">Army:</span>
              <span className="font-mono">{row.original.army_seed}</span>
            </div>
          )}
          {row.original.penalty && (
            <div className="flex items-center gap-2 text-danger">
              <span className="text-neutral-500">Penalty:</span>
              <span className="font-mono">+{row.original.penalty}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => {
        if (row.original.is_reserve) {
          return <Badge variant="warning">Reserve</Badge>;
        }
        return <Badge variant="success">Active</Badge>;
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Generate Seed List"
        subtitle="Calculate and export competitor seed rankings"
        actions={
          <div className="flex gap-3">
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

      {/* Control Panel */}
      <Card className="mb-6">
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <SimpleSelect
                label="Select Race"
                value={selectedRace}
                onChange={(e) => setSelectedRace(e.target.value)}
                placeholder="Choose a race to generate seed list..."
              >
                <option value="">Select a race</option>
                {races.map((race) => (
                  <option key={race.race_id} value={race.race_id}>
                    {race.race_name} - {race.race_type} {race.is_team && '(Team)'}
                  </option>
                ))}
              </SimpleSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="primary"
                onClick={handleGenerateSeedList}
                disabled={loading || !selectedRace}
                leftIcon={<Calculator className="w-4 h-4" />}
              >
                Generate
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={seedList.length === 0}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Export PDF
              </Button>
            </div>
          </div>

          {/* Status Message */}
          {generationStatus && (
            <div className={cn(
              'mt-4 p-3 rounded-lg flex items-center gap-2',
              generationStatus.type === 'success' && 'bg-success/10 text-success',
              generationStatus.type === 'error' && 'bg-danger/10 text-danger',
              generationStatus.type === 'info' && 'bg-info/10 text-info'
            )}>
              {generationStatus.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {generationStatus.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {generationStatus.type === 'info' && <FileText className="w-5 h-5" />}
              <span className="font-medium">{generationStatus.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary-700">{seedList.length}</p>
              <p className="text-sm text-neutral-600">Total Competitors</p>
            </div>
            <Hash className="w-8 h-8 text-primary-300" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-success">
                {seedList.filter(s => s.is_novice).length}
              </p>
              <p className="text-sm text-neutral-600">Novice</p>
            </div>
            <AlertCircle className="w-8 h-8 text-success/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-warning">
                {seedList.filter(s => s.is_reserve).length}
              </p>
              <p className="text-sm text-neutral-600">Reserve</p>
            </div>
            <AlertCircle className="w-8 h-8 text-warning/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-info">
                {seedList.length > 0 ? Math.min(...seedList.map(s => s.totalSeed || 0)).toFixed(2) : '0.00'}
              </p>
              <p className="text-sm text-neutral-600">Best Seed</p>
            </div>
            <Calculator className="w-8 h-8 text-info/30" />
          </div>
        </Card>
      </div>

      {/* Seed List Table */}
      <Card>
        <CardContent noPadding>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">Calculating seed points...</div>
            </div>
          ) : seedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Calculator className="w-12 h-12 text-neutral-300" />
              <p className="text-neutral-500">No seed list generated yet</p>
              <p className="text-sm text-neutral-400">Select a race and click Generate to create seed list</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={seedList}
              pageSize={50}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default GenerateSeedListNew;
