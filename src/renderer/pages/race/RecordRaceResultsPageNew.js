import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Save,
  ArrowLeft,
  Trophy,
  AlertCircle,
  CheckCircle,
  Timer
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  TextField,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  DataTable,
  Badge,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

function RecordRaceResultsPageNew() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [activeTab, setActiveTab] = useState('run1');
  const [raceDetails, setRaceDetails] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [times, setTimes] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRaceDetails = async () => {
    try {
      const query = `
        SELECT race_name, race_type, number_runs, is_team, is_seeding_race
        FROM races 
        WHERE race_id = ? AND competition_id = ?
      `;
      const result = await window.api.select(query, [raceId, competitionId]);
      if (result.length > 0) {
        setRaceDetails(result[0]);
      }
    } catch (error) {
      console.error('Failed to fetch race details:', error);
    }
  };

  const fetchCompetitors = async () => {
    try {
      // Get competitors and their existing times
      const query = `
        SELECT 
          p.id as competitor_id,
          p.first_name,
          p.last_name,
          rc.bib_number,
          cc.regiment,
          rr.run_1_time,
          rr.run_2_time,
          rr.dnf_run_1,
          rr.dnf_run_2,
          rr.dsq_run_1,
          rr.dsq_run_2
        FROM people p
        INNER JOIN competition_competitor cc ON p.id = cc.racer_id
        INNER JOIN race_competitor rc ON p.id = rc.racer_id AND rc.race_id = ? AND rc.competition_id = ?
        LEFT JOIN race_results rr ON rr.competitor_id = p.id AND rr.race_id = ?
        WHERE cc.competition_id = ?
        ORDER BY rc.bib_number
      `;
      const result = await window.api.select(query, [raceId, competitionId, raceId, competitionId]);
      setCompetitors(result);
      
      // Initialize times state
      const initialTimes = {};
      result.forEach(comp => {
        initialTimes[comp.competitor_id] = {
          run1: comp.run_1_time || '',
          run2: comp.run_2_time || '',
          dnf1: comp.dnf_run_1 === 1,
          dnf2: comp.dnf_run_2 === 1,
          dsq1: comp.dsq_run_1 === 1,
          dsq2: comp.dsq_run_2 === 1,
        };
      });
      setTimes(initialTimes);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRaceDetails();
    fetchCompetitors();
  }, [raceId, competitionId]);

  const handleTimeChange = (competitorId, run, value) => {
    setTimes(prev => ({
      ...prev,
      [competitorId]: {
        ...prev[competitorId],
        [run]: value
      }
    }));
  };

  const handleStatusChange = (competitorId, statusType, value) => {
    setTimes(prev => ({
      ...prev,
      [competitorId]: {
        ...prev[competitorId],
        [statusType]: value
      }
    }));
  };

  const saveTime = async (competitorId) => {
    try {
      const competitorTimes = times[competitorId];
      
      // Check if result exists
      const checkQuery = `
        SELECT COUNT(*) as count 
        FROM race_results 
        WHERE race_id = ? AND competitor_id = ?
      `;
      const exists = await window.api.select(checkQuery, [raceId, competitorId]);
      
      if (exists[0].count > 0) {
        // Update existing
        const updateQuery = `
          UPDATE race_results 
          SET run_1_time = ?, run_2_time = ?, 
              dnf_run_1 = ?, dnf_run_2 = ?, 
              dsq_run_1 = ?, dsq_run_2 = ?
          WHERE race_id = ? AND competitor_id = ?
        `;
        await window.api.update(updateQuery, [
          competitorTimes.run1 || null,
          competitorTimes.run2 || null,
          competitorTimes.dnf1 ? 1 : 0,
          competitorTimes.dnf2 ? 1 : 0,
          competitorTimes.dsq1 ? 1 : 0,
          competitorTimes.dsq2 ? 1 : 0,
          raceId,
          competitorId
        ]);
      } else {
        // Insert new
        const insertQuery = `
          INSERT INTO race_results (
            race_id, competitor_id, run_1_time, run_2_time,
            dnf_run_1, dnf_run_2, dsq_run_1, dsq_run_2
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await window.api.insert(insertQuery, [
          raceId,
          competitorId,
          competitorTimes.run1 || null,
          competitorTimes.run2 || null,
          competitorTimes.dnf1 ? 1 : 0,
          competitorTimes.dnf2 ? 1 : 0,
          competitorTimes.dsq1 ? 1 : 0,
          competitorTimes.dsq2 ? 1 : 0
        ]);
      }
      
      setSaveStatus({ [competitorId]: 'success' });
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error('Failed to save time:', error);
      setSaveStatus({ [competitorId]: 'error' });
    }
  };

  const saveAllTimes = async () => {
    setSaveStatus({ all: 'saving' });
    try {
      for (const competitor of competitors) {
        await saveTime(competitor.competitor_id);
      }
      setSaveStatus({ all: 'success' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save all times:', error);
      setSaveStatus({ all: 'error' });
    }
  };

  const run1Columns = [
    {
      header: 'Bib',
      accessorKey: 'bib_number',
      cell: ({ row }) => (
        <div className="font-bold text-lg">{row.original.bib_number || '-'}</div>
      ),
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </div>
          <div className="text-xs text-neutral-500">{row.original.regiment}</div>
        </div>
      ),
    },
    {
      header: 'Run 1 Time',
      accessorKey: 'run1_time',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <TextField
            placeholder="MM:SS.HH"
            value={times[row.original.competitor_id]?.run1 || ''}
            onChange={(e) => handleTimeChange(row.original.competitor_id, 'run1', e.target.value)}
            className="w-32"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={times[row.original.competitor_id]?.dnf1 ? 'danger' : 'outline'}
              onClick={() => handleStatusChange(row.original.competitor_id, 'dnf1', !times[row.original.competitor_id]?.dnf1)}
            >
              DNF
            </Button>
            <Button
              size="sm"
              variant={times[row.original.competitor_id]?.dsq1 ? 'danger' : 'outline'}
              onClick={() => handleStatusChange(row.original.competitor_id, 'dsq1', !times[row.original.competitor_id]?.dsq1)}
            >
              DSQ
            </Button>
          </div>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => saveTime(row.original.competitor_id)}
            leftIcon={<Save className="w-3 h-3" />}
          >
            Save
          </Button>
          {saveStatus && saveStatus[row.original.competitor_id] === 'success' && (
            <CheckCircle className="w-4 h-4 text-success" />
          )}
          {saveStatus && saveStatus[row.original.competitor_id] === 'error' && (
            <AlertCircle className="w-4 h-4 text-danger" />
          )}
        </div>
      ),
    },
  ];

  const run2Columns = [
    ...run1Columns.slice(0, 2),
    {
      header: 'Run 2 Time',
      accessorKey: 'run2_time',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <TextField
            placeholder="MM:SS.HH"
            value={times[row.original.competitor_id]?.run2 || ''}
            onChange={(e) => handleTimeChange(row.original.competitor_id, 'run2', e.target.value)}
            className="w-32"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={times[row.original.competitor_id]?.dnf2 ? 'danger' : 'outline'}
              onClick={() => handleStatusChange(row.original.competitor_id, 'dnf2', !times[row.original.competitor_id]?.dnf2)}
            >
              DNF
            </Button>
            <Button
              size="sm"
              variant={times[row.original.competitor_id]?.dsq2 ? 'danger' : 'outline'}
              onClick={() => handleStatusChange(row.original.competitor_id, 'dsq2', !times[row.original.competitor_id]?.dsq2)}
            >
              DSQ
            </Button>
          </div>
        </div>
      ),
    },
    run1Columns[3],
  ];

  if (loading) {
    return (
      <PageContainer>
        <PageHeader
          title="Record Race Results"
          subtitle="Loading race details..."
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
        <Card>
          <CardContent>
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">Loading...</div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Record Race Results"
        subtitle={raceDetails?.race_name || 'Enter race times'}
        actions={
          <div className="flex gap-3">
            <Button
              variant="success"
              onClick={saveAllTimes}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save All Times
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate(`/competition/${competitionId}/race/${raceId}/results`)}
              leftIcon={<Trophy className="w-4 h-4" />}
            >
              View Results
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

      {/* Race Info */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Race Type</p>
              <p className="text-lg font-bold">{raceDetails?.race_type}</p>
            </div>
            <Trophy className="w-8 h-8 text-primary-300" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Number of Runs</p>
              <p className="text-lg font-bold">{raceDetails?.number_runs}</p>
            </div>
            <Timer className="w-8 h-8 text-info/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Competitors</p>
              <p className="text-lg font-bold">{competitors.length}</p>
            </div>
            <Clock className="w-8 h-8 text-success/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Status</p>
              {saveStatus?.all === 'saving' && <Badge variant="info">Saving...</Badge>}
              {saveStatus?.all === 'success' && <Badge variant="success">Saved</Badge>}
              {saveStatus?.all === 'error' && <Badge variant="danger">Error</Badge>}
              {!saveStatus?.all && <Badge variant="warning">Recording</Badge>}
            </div>
          </div>
        </Card>
      </div>

      {/* Time Entry */}
      <Card>
        <CardContent noPadding>
          {raceDetails?.number_runs === 2 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start border-b">
                <TabsTrigger value="run1">Run 1</TabsTrigger>
                <TabsTrigger value="run2">Run 2</TabsTrigger>
              </TabsList>
              <TabsContent value="run1" className="mt-0">
                <DataTable
                  columns={run1Columns}
                  data={competitors}
                  pageSize={100}
                />
              </TabsContent>
              <TabsContent value="run2" className="mt-0">
                <DataTable
                  columns={run2Columns}
                  data={competitors}
                  pageSize={100}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <DataTable
              columns={run1Columns}
              data={competitors}
              pageSize={100}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default RecordRaceResultsPageNew;