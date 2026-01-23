import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Hash,
  Download,
  ArrowLeft,
  Calculator,
  FileText,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Save,
  Search
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
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { fetchSeedList } from '../../utils/FetchSeedList';
import { generatePDF } from '../../pdfs/SeedList';
import {
  calculateCPP,
  applyCPPToSeedList,
  storeCPPResult,
  storeFinalSeedList,
  getStoredCPP
} from '../../utils/CPPCalculation';
import toast from 'react-hot-toast';

function GenerateSeedListNew() {
  const { competitionId } = useParams();
  const [seedList, setSeedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRaces, setSelectedRaces] = useState([]);
  const [races, setRaces] = useState([]);
  const [generationStatus, setGenerationStatus] = useState(null);
  const [cppResult, setCppResult] = useState(null);
  const [cppCalculating, setCppCalculating] = useState(false);
  const [showCPPSection, setShowCPPSection] = useState(false);
  const [storedCPP, setStoredCPP] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const handleBack = useBackButton();

  const filteredSeedList = seedList.filter((competitor) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    const fullName = `${competitor.first_name || ''} ${competitor.last_name || ''}`.toLowerCase();
    const reverseName = `${competitor.last_name || ''} ${competitor.first_name || ''}`.toLowerCase();
    return fullName.includes(search) || reverseName.includes(search);
  });

  useEffect(() => {
    fetchCompletedRaces();
    loadStoredCPP();
  }, [competitionId]);

  const loadStoredCPP = async () => {
    const stored = await getStoredCPP(competitionId);
    setStoredCPP(stored);
  };

  const handleCalculateCPP = async () => {
    if (seedList.length === 0) {
      toast.error('Generate a seed list first');
      return;
    }

    setCppCalculating(true);
    try {
      const result = await calculateCPP(competitionId, seedList);
      setCppResult(result);
      setShowCPPSection(true);

      if (!result.success) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('CPP calculation failed:', error);
      toast.error('CPP calculation failed');
    } finally {
      setCppCalculating(false);
    }
  };

  const handleFinaliseSeedList = async () => {
    if (!cppResult || !cppResult.success) {
      toast.error('Calculate CPP first');
      return;
    }

    try {
      // Apply CPP to seed list
      const finalisedList = applyCPPToSeedList(seedList, cppResult.cpp);

      // Store CPP result
      await storeCPPResult(competitionId, cppResult);

      // Store finalised seed list
      const storeResult = await storeFinalSeedList(competitionId, finalisedList);

      if (storeResult.success) {
        toast.success(`Finalised seed list with ${storeResult.successCount} entries`);
        loadStoredCPP();
      } else {
        toast.error(`Stored with ${storeResult.errorCount} errors`);
      }
    } catch (error) {
      console.error('Failed to finalise seed list:', error);
      toast.error('Failed to finalise seed list');
    }
  };

  const fetchCompletedRaces = async () => {
    try {
      const query = `
        SELECT
          DISTINCT rr.race_id AS id, r.race_name AS text, r.race_date AS raceDate, r.is_seeding AS isSeeding
        FROM race_run rr
          INNER JOIN races r ON r.race_id = rr.race_id
        WHERE rr.competition_id = ? AND NOT r.is_training AND rr.is_complete
        ORDER BY r.race_date ASC
      `;
      const result = await window.api.select(query, [competitionId]);
      setRaces(result);

      if (result.length > 0) {
        const initialSelected = result.length > 3
          ? result.filter(e => !e.isSeeding).map(e => e.id)
          : result.map(e => e.id);
        setSelectedRaces(initialSelected);

        if (initialSelected.length > 0) {
          await loadSeedList(initialSelected);
        }
      }
    } catch (error) {
      console.error('Failed to fetch races:', error);
    }
  };

  const loadSeedList = async (raceIds) => {
    setLoading(true);
    setGenerationStatus({ type: 'info', message: 'Generating seed list...' });

    try {
      const seeds = await fetchSeedList(competitionId, raceIds);
      setSeedList(seeds);
      setGenerationStatus({ type: 'success', message: `Generated seed list with ${seeds.length} competitors` });
    } catch (error) {
      console.error('Failed to generate seed list:', error);
      setGenerationStatus({ type: 'error', message: 'Failed to generate seed list' });
    } finally {
      setLoading(false);
    }
  };

  const handleRaceToggle = async (raceId) => {
    const newSelected = selectedRaces.includes(raceId)
      ? selectedRaces.filter(id => id !== raceId)
      : [...selectedRaces, raceId];

    setSelectedRaces(newSelected);

    if (newSelected.length > 0) {
      await loadSeedList(newSelected);
    } else {
      setSeedList([]);
    }
  };

  const handleExportPDF = () => {
    if (seedList.length === 0) {
      setGenerationStatus({ type: 'error', message: 'No seed list to export' });
      return;
    }

    const selectedRaceData = races.filter(r => selectedRaces.includes(r.id));
    const hasInitial = seedList.length > 0 && seedList[0].initial !== undefined;
    generatePDF(seedList, selectedRaceData, null, hasInitial);
    setGenerationStatus({ type: 'success', message: 'PDF export started' });
  };

  // Check if seed list has 'initial' column (when no seeding race exists)
  const hasInitialColumn = seedList.length > 0 && seedList[0].initial !== undefined;

  const columns = [
    {
      header: 'Pos',
      accessorKey: 'position',
      cell: ({ row }) => (
        <div className="font-bold text-lg text-primary-700">
          {row.original.position}
        </div>
      ),
    },
    {
      header: 'Rank',
      accessorKey: 'title',
      cell: ({ row }) => (
        <div className="text-sm">{row.original.title}</div>
      ),
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-neutral-900">
            {row.original.last_name?.toUpperCase()} {row.original.first_name}
          </div>
          {row.original.team_name && (
            <div className="text-xs text-neutral-500">{row.original.team_name}</div>
          )}
        </div>
      ),
    },
    // Add 'Initial' column if no seeding race exists
    ...(hasInitialColumn ? [{
      header: 'Initial',
      accessorKey: 'initial',
      cell: ({ row }) => {
        const points = row.original.initial;
        return (
          <div className="font-mono text-center">
            {points != null ? Math.round(points*100,2)/100 : '-'}
          </div>
        );
      },
    }] : []),
    ...races
      .filter(r => selectedRaces.includes(r.id))
      .map(race => ({
        header: race.text,
        accessorKey: race.id,
        cell: ({ row }) => {
          const points = row.original[race.id];
          const hasPenalty = row.original[`${race.id}-penalty`];
          return (
            <div className="font-mono text-center">
              {points != null ? (hasPenalty ? `${points}*` : points) : '-'}
            </div>
          );
        },
      })),
    {
      header: 'Overall Points',
      accessorKey: 'seed_points',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary-400" />
          <span className="font-mono font-bold text-lg">
            {row.original.seed_points?.toFixed(2) || '0.00'}
          </span>
        </div>
      ),
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
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-900 mb-3">
                {selectedRaces.length === 0
                  ? 'Select races to include'
                  : `Seed List after ${selectedRaces.length} Race${selectedRaces.length > 1 ? 's' : ''}`}
              </h3>
              {races.length === 0 ? (
                <p className="text-neutral-500 text-sm">No completed races found</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {races.map((race) => (
                    <label
                      key={race.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                        selectedRaces.includes(race.id)
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'bg-white border-neutral-200 hover:border-neutral-300'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRaces.includes(race.id)}
                        onChange={() => handleRaceToggle(race.id)}
                        className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium">{race.text}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-start gap-2 ml-4">
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
                {seedList.length > 0 ? Math.min(...seedList.map(s => s.seed_points || 0)).toFixed(2) : '0.00'}
              </p>
              <p className="text-sm text-neutral-600">Best Seed</p>
            </div>
            <Calculator className="w-8 h-8 text-info/30" />
          </div>
        </Card>
      </div>

      {/* CPP Section */}
      {seedList.length > 0 && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-neutral-900">Championship Penalty Points (CPP)</h3>
                {storedCPP && (
                  <Badge variant="success">
                    Previously calculated: {storedCPP.cpp_value?.toFixed(2)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleCalculateCPP}
                  disabled={cppCalculating || seedList.length === 0}
                  leftIcon={<Calculator className="w-4 h-4" />}
                >
                  {cppCalculating ? 'Calculating...' : 'Calculate CPP'}
                </Button>
                {cppResult?.success && (
                  <Button
                    variant="primary"
                    onClick={handleFinaliseSeedList}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Finalise Seed List
                  </Button>
                )}
              </div>
            </div>

            {showCPPSection && cppResult && (
              <div className={cn(
                'p-4 rounded-lg',
                cppResult.success ? 'bg-success/10' : 'bg-danger/10'
              )}>
                {cppResult.success ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-4">
                      <div className="text-center">
                        <p className="text-sm text-neutral-600">T1 (AASL Sum)</p>
                        <p className="text-xl font-bold">{cppResult.t1?.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-neutral-600">T2 (AASL Sum)</p>
                        <p className="text-xl font-bold">{cppResult.t2?.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-neutral-600">T3 (Seed Sum)</p>
                        <p className="text-xl font-bold">{cppResult.t3?.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-neutral-600">Divisor</p>
                        <p className="text-xl font-bold">{cppResult.divisor}</p>
                      </div>
                      <div className="text-center bg-primary-100 rounded-lg p-2">
                        <p className="text-sm text-primary-700">CPP Value</p>
                        <p className="text-2xl font-bold text-primary-700">{cppResult.cpp?.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="text-sm text-neutral-600 space-y-3">
                      <div>
                        <p className="font-medium mb-2">T1 Skiers (lowest AASL on seed list):</p>
                        <div className="flex flex-wrap gap-2">
                          {cppResult.t1Skiers?.map((skier, idx) => (
                            <Badge key={idx} variant="outline">
                              {skier.name} (AASL: {skier.aasl_points?.toFixed(2)})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="font-medium mb-2">T2/T3 Skiers (lowest AASL in top 10):</p>
                        <div className="flex flex-wrap gap-2">
                          {cppResult.t2Skiers?.map((skier, idx) => (
                            <Badge key={idx} variant="outline">
                              {skier.name} (AASL: {skier.aasl_points?.toFixed(2)}, Seed: {skier.seed_points?.toFixed(2)})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-500 font-mono">
                      Formula: {cppResult.formula}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-danger-600">
                    <AlertCircle className="w-5 h-5" />
                    <p>{cppResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <p className="text-sm text-neutral-400">
                {races.length === 0
                  ? 'Complete at least one race to generate a seed list'
                  : 'Select races above to generate the seed list'}
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-neutral-200">
                <TextField
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="max-w-sm"
                />
                {searchTerm && (
                  <p className="text-sm text-neutral-500 mt-2">
                    Showing {filteredSeedList.length} of {seedList.length} competitors
                  </p>
                )}
              </div>
              <DataTable
                columns={columns}
                data={filteredSeedList}
                pageSize={50}
              />
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default GenerateSeedListNew;
