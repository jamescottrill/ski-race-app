import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Users,
  Calculator,
  CheckCircle,
  AlertCircle,
  Search,
  ChevronRight
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  SimpleSelect,
  TextField,
  Label,
  Checkbox,
  Badge
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { fetchSeedList } from '../../utils/FetchSeedList';
import { calculateCPP, applyCPPToSeedList } from '../../utils/CPPCalculation';
import toast from 'react-hot-toast';

export default function ImportCompetitorsFromCompetitionPage() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();

  const [step, setStep] = useState(1);
  const [competitions, setCompetitions] = useState([]);
  const [sourceCompetitionId, setSourceCompetitionId] = useState('');
  const [sourceCompetition, setSourceCompetition] = useState(null);
  const [races, setRaces] = useState([]);
  const [seedList, setSeedList] = useState([]);
  const [cppResult, setCppResult] = useState(null);
  const [manualPenalty, setManualPenalty] = useState(0);
  const [finalSeedList, setFinalSeedList] = useState([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [existingCompetitors, setExistingCompetitors] = useState([]);

  useEffect(() => {
    fetchCompetitions();
    fetchExistingCompetitors();
  }, [competitionId]);

  const fetchCompetitions = async () => {
    try {
      const result = await window.api.select(
        `WITH current_comp AS (SELECT season FROM competitions WHERE id = ?) SELECT id, competition_name, c.season
         FROM competitions c
         INNER JOIN current_comp cc ON c.season = cc.season
         WHERE id != ?`,
        [competitionId,competitionId]
      );
      setCompetitions(result);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
    }
  };

  const fetchExistingCompetitors = async () => {
    try {
      const result = await window.api.select(
        `SELECT racer_id FROM competition_competitor WHERE competition_id = ?`,
        [competitionId]
      );
      setExistingCompetitors(result.map(r => r.racer_id));
    } catch (error) {
      console.error('Failed to fetch existing competitors:', error);
    }
  };

  const handleSelectCompetition = async () => {
    if (!sourceCompetitionId) {
      toast.error('Please select a source competition');
      return;
    }

    setLoading(true);
    try {
      const compResult = await window.api.select(
        `SELECT * FROM competitions WHERE id = ?`,
        [sourceCompetitionId]
      );
      if (compResult.length > 0) {
        setSourceCompetition(compResult[0]);
      }
      console.log(sourceCompetitionId);
      const racesResult = await window.api.select(
        `SELECT DISTINCT r.race_id AS id, r.race_name AS text, r.race_date AS raceDate
         FROM races r
         WHERE r.competition_id = ?
           AND NOT r.is_training
           AND NOT r.is_seeding
         ORDER BY r.race_date`,
        [sourceCompetitionId]
      );
      console.log(racesResult);
      setRaces(racesResult);

      if (racesResult.length === 0) {
        toast.error('No completed races found in this competition');
        setLoading(false);
        return;
      }

      let seedListData;
      if (racesResult.length > 3) {
        seedListData = await fetchSeedList(
          sourceCompetitionId,
          racesResult.filter((e) => !e.isSeeding).map((e) => e.id)
        );
      } else {
        seedListData = await fetchSeedList(
          sourceCompetitionId,
          racesResult.map((e) => e.id)
        );
      }

      setSeedList(seedListData);

      const cpp = await calculateCPP(sourceCompetitionId, seedListData);
      setCppResult(cpp);

      if (cpp.success) {
        const withCpp = applyCPPToSeedList(seedListData, cpp.cpp);
        setFinalSeedList(withCpp);
      } else {
        setFinalSeedList(seedListData.map(entry => ({
          ...entry,
          cpp_applied: 0,
          original_seed_points: entry.seed_points,
          final_seed_points: entry.seed_points
        })));
      }

      setStep(2);
    } catch (error) {
      console.error('Failed to load competition data:', error);
      toast.error('Failed to load competition data');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyManualPenalty = () => {
    const penalty = parseFloat(manualPenalty) || 0;
    const totalCpp = (cppResult?.cpp || 0) + penalty;

    const updated = seedList.map(entry => ({
      ...entry,
      cpp_applied: totalCpp,
      manual_penalty: penalty,
      original_seed_points: entry.seed_points,
      final_seed_points: entry.seed_points + totalCpp
    }));

    setFinalSeedList(updated);
    toast.success(`Applied CPP (${cppResult?.cpp?.toFixed(2) || 0}) + Manual Penalty (${penalty}) = ${totalCpp.toFixed(2)}`);
  };

  const handleToggleCompetitor = (racerId) => {
    setSelectedCompetitors(prev => {
      if (prev.includes(racerId)) {
        return prev.filter(id => id !== racerId);
      }
      return [...prev, racerId];
    });
  };

  const handleSelectAll = () => {
    const availableCompetitors = filteredSeedList
      .filter(c => !existingCompetitors.includes(c.racer_id))
      .map(c => c.racer_id);
    setSelectedCompetitors(availableCompetitors);
  };

  const handleDeselectAll = () => {
    setSelectedCompetitors([]);
  };

  const handleImport = async () => {
    if (selectedCompetitors.length === 0) {
      toast.error('Please select at least one competitor to import');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const racerId of selectedCompetitors) {
      const competitor = finalSeedList.find(c => c.racer_id === racerId);
      if (!competitor) continue;

      try {
        const existing = await window.api.select(
          `SELECT racer_id FROM competition_competitor WHERE competition_id = ? AND racer_id = ?`,
          [competitionId, racerId]
        );

        if (existing.length > 0) {
          errorCount++;
          continue;
        }

        const currentYear = new Date().getFullYear();
        const age = currentYear - parseInt(competitor.birth_year || 2000, 10);
        const isJunior = age < 20;
        const isSenior = age >= 20 && age < 35;
        const isVeteran = age >= 35;

        await window.api.insert(
          `INSERT INTO competition_competitor (
            competition_id, racer_id, arrival_corps_seed, arrival_army_seed,
            is_novice, is_junior, is_senior, is_veteran, is_reserve, is_female,
            regiment, title
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            competitionId,
            racerId,
            competitor.final_seed_points,
            null,
            0,
            isJunior ? 1 : 0,
            isSenior ? 1 : 0,
            isVeteran ? 1 : 0,
            0,
            competitor.gender === 'F' ? 1 : 0,
            competitor.regiment || competitor.team_name || '',
            competitor.title || ''
          ]
        );
        successCount++;
      } catch (error) {
        console.error('Failed to import competitor:', racerId, error);
        errorCount++;
      }
    }

    setImporting(false);

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} competitor(s)`);
      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} competitor(s)`);
      }
      navigate(`/competition/${competitionId}/competitor/list`);
    } else {
      toast.error('Failed to import any competitors');
    }
  };

  const filteredSeedList = useMemo(() => {
    if (!searchTerm.trim()) return finalSeedList;
    const term = searchTerm.toLowerCase();
    return finalSeedList.filter(c =>
      c.last_name?.toLowerCase().includes(term) ||
      c.first_name?.toLowerCase().includes(term)
    );
  }, [finalSeedList, searchTerm]);

  const columns = [
    {
      header: 'Select',
      id: 'select',
      cell: ({ row }) => {
        const isExisting = existingCompetitors.includes(row.original.racer_id);
        return (
          <Checkbox
            checked={selectedCompetitors.includes(row.original.racer_id)}
            onChange={() => handleToggleCompetitor(row.original.racer_id)}
            disabled={isExisting}
          />
        );
      }
    },
    {
      header: 'Position',
      accessorKey: 'position',
      cell: ({ row }) => (
        <div className="font-mono text-center">{row.original.position}</div>
      )
    },
    {
      header: 'Name',
      accessorKey: 'last_name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.last_name?.toUpperCase()} {row.original.first_name}
          </div>
          {existingCompetitors.includes(row.original.racer_id) && (
            <Badge variant="warning" className="mt-1">Already registered</Badge>
          )}
        </div>
      )
    },
    {
      header: 'Raw Seed',
      accessorKey: 'original_seed_points',
      cell: ({ row }) => (
        <div className="font-mono text-center">
          {row.original.original_seed_points?.toFixed(2) || row.original.seed_points?.toFixed(2)}
        </div>
      )
    },
    {
      header: 'CPP Applied',
      accessorKey: 'cpp_applied',
      cell: ({ row }) => (
        <div className="font-mono text-center">
          {row.original.cpp_applied?.toFixed(2) || '0.00'}
        </div>
      )
    },
    {
      header: 'Final Seed',
      accessorKey: 'final_seed_points',
      cell: ({ row }) => (
        <div className="font-mono text-center font-bold text-primary-700">
          {row.original.final_seed_points?.toFixed(2)}
        </div>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Import Competitors from Competition"
        subtitle="Import competitors with their finalised seed points"
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

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary-700' : 'text-neutral-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-neutral-200'}`}>
            1
          </div>
          <span className="font-medium">Select Competition</span>
        </div>
        <ChevronRight className="w-5 h-5 text-neutral-400" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary-700' : 'text-neutral-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-neutral-200'}`}>
            2
          </div>
          <span className="font-medium">Review & Select Competitors</span>
        </div>
        <ChevronRight className="w-5 h-5 text-neutral-400" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary-700' : 'text-neutral-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-primary-600 text-white' : 'bg-neutral-200'}`}>
            3
          </div>
          <span className="font-medium">Import</span>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">Select Source Competition</h3>
            <p className="text-neutral-600 mb-6">
              Choose a previous competition to import competitors from. The final seed list will be generated
              with CPP (Championship Penalty Points) applied.
            </p>

            <div className="max-w-md">
              <Label htmlFor="source-competition">Source Competition</Label>
              <SimpleSelect
                id="source-competition"
                value={sourceCompetitionId}
                onChange={(e) => setSourceCompetitionId(e.target.value)}
              >
                <option value="">Select a competition...</option>
                {competitions.map(comp => (
                  <option key={comp.id} value={comp.id}>
                    {comp.competition_name} ({comp.season})
                  </option>
                ))}
              </SimpleSelect>
            </div>

            <div className="mt-6">
              <Button
                variant="primary"
                onClick={handleSelectCompetition}
                disabled={!sourceCompetitionId || loading}
                leftIcon={loading ? null : <ChevronRight className="w-4 h-4" />}
              >
                {loading ? 'Loading...' : 'Continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <>
          {/* CPP Information Card */}
          <Card className="mb-6">
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary-500" />
                    CPP Calculation for {sourceCompetition?.competition_name}
                  </h3>
                  {cppResult?.success ? (
                    <div className="space-y-2">
                      <p className="text-neutral-600">
                        Formula: {cppResult.formula}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="success">
                          CPP: {cppResult.cpp.toFixed(2)}
                        </Badge>
                        <span className="text-sm text-neutral-500">
                          ({cppResult.skiersUsed} skiers used)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-warning">
                      <AlertCircle className="w-5 h-5" />
                      <span>{cppResult?.error || 'CPP could not be calculated'}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-end gap-4">
                  <div>
                    <Label htmlFor="manual-penalty">Manual Penalty</Label>
                    <TextField
                      id="manual-penalty"
                      type="number"
                      step="0.01"
                      value={manualPenalty}
                      onChange={(e) => setManualPenalty(e.target.value)}
                      placeholder="0.00"
                      className="w-32"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleApplyManualPenalty}
                  >
                    Apply Penalty
                  </Button>
                </div>
              </div>

              {manualPenalty > 0 && (
                <div className="mt-4 p-3 bg-warning/10 rounded-lg">
                  <p className="text-sm">
                    <strong>Total adjustment:</strong> CPP ({cppResult?.cpp?.toFixed(2) || 0}) + Manual Penalty ({parseFloat(manualPenalty).toFixed(2)}) = <strong>{((cppResult?.cpp || 0) + parseFloat(manualPenalty)).toFixed(2)}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Competitor Selection */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-500" />
                  Select Competitors to Import
                </h3>
                <div className="flex items-center gap-4">
                  <TextField
                    placeholder="Search competitors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    className="w-64"
                  />
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="mb-4">
                <Badge variant="primary">
                  {selectedCompetitors.length} competitor(s) selected
                </Badge>
              </div>

              <DataTable
                columns={columns}
                data={filteredSeedList}
                pageSize={20}
              />

              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={selectedCompetitors.length === 0 || importing}
                  leftIcon={importing ? null : <Download className="w-4 h-4" />}
                >
                  {importing ? 'Importing...' : `Import ${selectedCompetitors.length} Competitor(s)`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
