import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  Save,
  ArrowLeft,
  Trophy,
  AlertCircle,
  CheckCircle,
  Timer,
  Upload,
  Settings,
  ChevronDown,
  ChevronUp
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
  SimpleSelect
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import {
  convertRaceTime,
  convertHumanTime,
  formatTime,
} from '../../utils/TimeUtils';

function RecordRaceResultsPageNew() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [activeTab, setActiveTab] = useState('1');
  const [raceDetails, setRaceDetails] = useState(null);
  const [raceRuns, setRaceRuns] = useState([]);
  const [competitors, setCompetitors] = useState({});
  const [runDetails, setRunDetails] = useState({});
  const [people, setPeople] = useState([]);
  const [showCourseDetails, setShowCourseDetails] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRaceDetails = async () => {
    try {
      const query = `
        SELECT race_name, race_type, number_runs, is_team, is_seeding
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

  const fetchRaceRuns = async () => {
    try {
      const query = `
        SELECT run_id, run_number, COALESCE(is_complete, 0) AS is_complete
        FROM race_run
        WHERE race_id = ? AND competition_id = ?
        ORDER BY run_number
      `;
      const result = await window.api.select(query, [raceId, competitionId]);
      setRaceRuns(result);

      const notCompleted = result.filter(r => !r.is_complete);
      if (notCompleted.length > 0) {
        setActiveTab(String(notCompleted[0].run_number));
      } else if (result.length > 0) {
        setActiveTab(String(result[0].run_number));
      }
    } catch (error) {
      console.error('Failed to fetch race runs:', error);
    }
  };

  const fetchPeople = async () => {
    try {
      const query = `SELECT id, first_name, last_name FROM people ORDER BY last_name, first_name`;
      const result = await window.api.select(query);
      setPeople(result);
    } catch (error) {
      console.error('Failed to fetch people:', error);
    }
  };

  const fetchRunDetails = async (runNumber) => {
    try {
      const query = `
        SELECT
          course_setter,
          number_gates,
          turning_gates,
          start_time,
          forerunner_a,
          forerunner_b,
          forerunner_c,
          forerunner_d
        FROM race_run
        WHERE race_id = ? AND competition_id = ? AND run_number = ?
      `;
      const result = await window.api.select(query, [raceId, competitionId, runNumber]);
      if (result.length > 0) {
        setRunDetails(prev => ({
          ...prev,
          [runNumber]: {
            courseSetter: result[0].course_setter || '',
            numberGates: result[0].number_gates || '',
            turningGates: result[0].turning_gates || '',
            startTime: result[0].start_time || '',
            forerunner1: result[0].forerunner_a || '',
            forerunner2: result[0].forerunner_b || '',
            forerunner3: result[0].forerunner_c || '',
            forerunner4: result[0].forerunner_d || ''
          }
        }));
      } else {
        setRunDetails(prev => ({
          ...prev,
          [runNumber]: {
            courseSetter: '',
            numberGates: '',
            turningGates: '',
            startTime: '',
            forerunner1: '',
            forerunner2: '',
            forerunner3: '',
            forerunner4: ''
          }
        }));
      }
    } catch (error) {
      console.error('Failed to fetch run details:', error);
    }
  };

  const handleRunDetailChange = (runNumber, field, value) => {
    setRunDetails(prev => ({
      ...prev,
      [runNumber]: {
        ...prev[runNumber],
        [field]: value
      }
    }));
  };

  const saveRunDetails = async (runNumber) => {
    try {
      const details = runDetails[runNumber];
      const query = `
        UPDATE race_run
        SET course_setter = ?,
            number_gates = ?,
            turning_gates = ?,
            start_time = ?,
            forerunner_a = ?,
            forerunner_b = ?,
            forerunner_c = ?,
            forerunner_d = ?
        WHERE race_id = ? AND competition_id = ? AND run_number = ?
      `;
      await window.api.insert(query, [
        details.courseSetter || null,
        details.numberGates || null,
        details.turningGates || null,
        details.startTime || null,
        details.forerunner1 || null,
        details.forerunner2 || null,
        details.forerunner3 || null,
        details.forerunner4 || null,
        raceId,
        competitionId,
        runNumber
      ]);
      setSaveStatus({ type: 'success', message: `Run ${runNumber} course details saved` });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save run details:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save course details' });
    }
  };

  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person ? `${person.first_name} ${person.last_name}` : '';
  };

  const fetchCompetitorsForRun = async (runNumber) => {
    try {
      let query;
      let params;

      if (runNumber === 1) {
        query = `
          SELECT
            p.id as competitor_id,
            p.first_name,
            p.last_name,
            rc.bib_number,
            cc.regiment,
            rr.race_time,
            rr.is_dnf,
            rr.is_dsq,
            rr.is_dns,
            rr.is_ns,
            rr.dsq_gate,
            rr.dsq_reason,
            NULL as prev_race_time
          FROM people p
          INNER JOIN competition_competitor cc ON p.id = cc.racer_id AND cc.competition_id = ?
          INNER JOIN race_competitor rc ON p.id = rc.racer_id AND rc.race_id = ? AND rc.competition_id = ?
          LEFT JOIN race_results rr ON rr.racer_id = p.id AND rr.race_id = ? AND rr.competition_id = ? AND rr.run_number = ?
          ORDER BY rc.bib_number
        `;
        params = [competitionId, raceId, competitionId, raceId, competitionId, runNumber];
      } else {
        query = `
          SELECT
            p.id as competitor_id,
            p.first_name,
            p.last_name,
            rc.bib_number,
            cc.regiment,
            rr.race_time,
            rr.is_dnf,
            rr.is_dsq,
            rr.is_dns,
            rr.is_ns,
            rr.dsq_gate,
            rr.dsq_reason,
            rr_prev.race_time as prev_race_time,
            rr_prev.is_dnf as prev_is_dnf,
            rr_prev.is_dsq as prev_is_dsq,
            rr_prev.is_dns as prev_is_dns,
            rr_prev.is_ns as prev_is_ns
          FROM people p
          INNER JOIN competition_competitor cc ON p.id = cc.racer_id AND cc.competition_id = ?
          INNER JOIN race_competitor rc ON p.id = rc.racer_id AND rc.race_id = ? AND rc.competition_id = ?
          LEFT JOIN race_results rr ON rr.racer_id = p.id AND rr.race_id = ? AND rr.competition_id = ? AND rr.run_number = ?
          LEFT JOIN race_results rr_prev ON rr_prev.racer_id = p.id AND rr_prev.race_id = ? AND rr_prev.competition_id = ? AND rr_prev.run_number = ?
          WHERE EXISTS (SELECT 1 FROM race_results rr2 WHERE rr2.racer_id = p.id AND rr2.race_id = ? AND rr2.competition_id = ? AND rr2.run_number = ?)
          ORDER BY rr_prev.race_time ASC NULLS LAST, rc.bib_number ASC
        `;
        params = [
          competitionId, raceId, competitionId,
          raceId, competitionId, runNumber,
          raceId, competitionId, runNumber - 1,
          raceId, competitionId, runNumber
        ];
      }

      let result = await window.api.select(query, params);

      if (runNumber > 1 && result.length > 0) {
        const finishedCompetitors = result.filter(c => c.prev_race_time != null);
        const unfinishedCompetitors = result.filter(c => c.prev_race_time == null);

        const top15 = finishedCompetitors.slice(0, 15).reverse();
        const restFinished = finishedCompetitors.slice(15);

        unfinishedCompetitors.sort((a, b) => (a.bib_number || 0) - (b.bib_number || 0));

        result = [...top15, ...restFinished, ...unfinishedCompetitors];
      }

      const competitorData = result.map(comp => ({
        ...comp,
        raceTime: convertRaceTime(comp.race_time) || '',
        status: comp.is_dns ? 'DNS' :
                comp.is_dnf ? 'DNF' :
                comp.is_dsq ? 'DSQ' :
                comp.is_ns ? 'NS' :
                comp.race_time ? 'Finished' : '',
        dsqGate: comp.dsq_gate || '',
        dsqReason: comp.dsq_reason || ''
      }));

      setCompetitors(prev => ({
        ...prev,
        [runNumber]: competitorData
      }));
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchRaceDetails();
      await fetchRaceRuns();
      await fetchPeople();
      setLoading(false);
    };
    init();
  }, [raceId, competitionId]);

  useEffect(() => {
    if (activeTab) {
      const runNumber = parseInt(activeTab, 10);
      if (!competitors[activeTab]) {
        fetchCompetitorsForRun(runNumber);
      }
      if (!runDetails[activeTab]) {
        fetchRunDetails(runNumber);
      }
    }
  }, [activeTab]);

  const handleTimeChange = (runNumber, competitorId, value) => {
    setCompetitors(prev => ({
      ...prev,
      [runNumber]: prev[runNumber].map(c =>
        c.competitor_id === competitorId ? { ...c, raceTime: value } : c
      )
    }));
  };

  const handleTimeBlur = async (runNumber, competitorId, value) => {
    let formattedValue = value.padStart(6, '0');
    const timeRegex = /^([0-5]?[0-9])(:|\.)?([0-5][0-9])\.?\d{0,2}$/;
    if (!timeRegex.test(formattedValue) && formattedValue !== '000000') return;

    formattedValue = formatTime(formattedValue);
    const timeInSeconds = convertHumanTime(formattedValue);

    setCompetitors(prev => ({
      ...prev,
      [runNumber]: prev[runNumber].map(c =>
        c.competitor_id === competitorId ? {
          ...c,
          raceTime: formattedValue,
          status: formattedValue ? 'Finished' : c.status
        } : c
      )
    }));

    await updateField(competitorId, runNumber, 'race_time', timeInSeconds);
    if (formattedValue) {
      await updateField(competitorId, runNumber, 'is_dnf', 0);
      await updateField(competitorId, runNumber, 'is_dsq', 0);
      await updateField(competitorId, runNumber, 'is_dns', 0);
      await updateField(competitorId, runNumber, 'is_ns', 0);
    }
  };

  const handleStatusChange = async (runNumber, competitorId, newStatus) => {
    setCompetitors(prev => ({
      ...prev,
      [runNumber]: prev[runNumber].map(c =>
        c.competitor_id === competitorId ? {
          ...c,
          status: newStatus,
          dsqGate: newStatus === 'DSQ' ? c.dsqGate : '',
          dsqReason: newStatus === 'DSQ' ? c.dsqReason : ''
        } : c
      )
    }));

    await updateField(competitorId, runNumber, 'is_dns', newStatus === 'DNS' ? 1 : 0);
    await updateField(competitorId, runNumber, 'is_dnf', newStatus === 'DNF' ? 1 : 0);
    await updateField(competitorId, runNumber, 'is_dsq', newStatus === 'DSQ' ? 1 : 0);
    await updateField(competitorId, runNumber, 'is_ns', newStatus === 'NS' ? 1 : 0);
  };

  const handleDsqFieldChange = async (runNumber, competitorId, field, value) => {
    const dbField = field === 'dsqGate' ? 'dsq_gate' : 'dsq_reason';

    setCompetitors(prev => ({
      ...prev,
      [runNumber]: prev[runNumber].map(c =>
        c.competitor_id === competitorId ? { ...c, [field]: value } : c
      )
    }));

    await updateField(competitorId, runNumber, dbField, value);
  };

  const updateField = async (competitorId, runNumber, field, value) => {
    try {
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM race_results
        WHERE competition_id = ? AND race_id = ? AND run_number = ? AND racer_id = ?
      `;
      const exists = await window.api.select(checkQuery, [competitionId, raceId, runNumber, competitorId]);

      if (exists[0].count > 0) {
        const updateQuery = `
          UPDATE race_results
          SET ${field} = ?
          WHERE competition_id = ? AND race_id = ? AND run_number = ? AND racer_id = ?
        `;
        await window.api.insert(updateQuery, [value, competitionId, raceId, runNumber, competitorId]);
      } else {
        const insertQuery = `
          INSERT INTO race_results (competition_id, race_id, run_number, racer_id, ${field})
          VALUES (?, ?, ?, ?, ?)
        `;
        await window.api.insert(insertQuery, [competitionId, raceId, runNumber, competitorId, value]);
      }
    } catch (error) {
      console.error('Failed to update field:', error);
    }
  };

  const markRunComplete = async (runNumber) => {
    try {
      const query = `UPDATE race_run SET is_complete = 1 WHERE competition_id = ? AND race_id = ? AND run_number = ?`;
      await window.api.insert(query, [competitionId, raceId, runNumber]);

      setRaceRuns(prev => prev.map(r =>
        r.run_number === runNumber ? { ...r, is_complete: 1 } : r
      ));

      const nextRun = runNumber + 1;
      if (nextRun <= (raceDetails?.number_runs || 1)) {
        await createNextRunResults(runNumber, nextRun);
      }

      setSaveStatus({ type: 'success', message: `Run ${runNumber} marked complete` });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to mark run complete:', error);
      setSaveStatus({ type: 'error', message: 'Failed to mark run complete' });
    }
  };

  const createNextRunResults = async (currentRun, nextRun) => {
    try {
      const isSeedingRace = raceDetails?.is_seeding === 1 || raceDetails?.is_seeding === true;
      const allCompetitors = competitors[currentRun] || [];

      let competitorsForNextRun;
      if (isSeedingRace) {
        competitorsForNextRun = allCompetitors;
      } else {
        competitorsForNextRun = allCompetitors.filter(c => c.status === 'Finished');
      }

      const deleteQuery = `DELETE FROM race_results WHERE competition_id = ? AND race_id = ? AND run_number = ?`;
      await window.api.delete(deleteQuery, [competitionId, raceId, nextRun]);

      for (const comp of competitorsForNextRun) {
        const insertQuery = `
          INSERT INTO race_results (competition_id, race_id, run_number, racer_id)
          VALUES (?, ?, ?, ?)
        `;
        await window.api.insert(insertQuery, [competitionId, raceId, nextRun, comp.competitor_id]);
      }

      await fetchCompetitorsForRun(nextRun);
    } catch (error) {
      console.error('Failed to create next run results:', error);
    }
  };

  const getColumns = (runNumber) => [
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
            {row.original.last_name?.toUpperCase()}, {row.original.first_name}
          </div>
          <div className="text-xs text-neutral-500">{row.original.regiment}</div>
        </div>
      ),
    },
    {
      header: 'Time',
      accessorKey: 'raceTime',
      cell: ({ row }) => (
        <TextField
          placeholder="MM:SS.SS"
          value={row.original.raceTime || ''}
          onChange={(e) => handleTimeChange(runNumber, row.original.competitor_id, e.target.value)}
          onBlur={(e) => handleTimeBlur(runNumber, row.original.competitor_id, e.target.value)}
          className="w-32"
        />
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <div className="flex gap-1">
          {['Finished', 'DNS', 'DNF', 'DSQ', 'NS'].map(status => (
            <Button
              key={status}
              size="sm"
              variant={row.original.status === status ?
                (status === 'Finished' ? 'success' : 'danger') : 'outline'}
              onClick={() => handleStatusChange(runNumber, row.original.competitor_id, status)}
            >
              {status === 'Finished' ? 'FIN' : status}
            </Button>
          ))}
        </div>
      ),
    },
    {
      header: 'DSQ Details',
      accessorKey: 'dsq',
      cell: ({ row }) => row.original.status === 'DSQ' ? (
        <div className="flex gap-2">
          <TextField
            placeholder="Gate #"
            value={row.original.dsqGate || ''}
            onChange={(e) => handleDsqFieldChange(runNumber, row.original.competitor_id, 'dsqGate', e.target.value)}
            className="w-20"
          />
          <TextField
            placeholder="Reason"
            value={row.original.dsqReason || ''}
            onChange={(e) => handleDsqFieldChange(runNumber, row.original.competitor_id, 'dsqReason', e.target.value)}
            className="w-32"
          />
        </div>
      ) : <span className="text-neutral-400">-</span>,
    },
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

  const currentRunCompetitors = competitors[activeTab] || [];
  const currentRun = raceRuns.find(r => String(r.run_number) === activeTab);

  return (
    <PageContainer>
      <PageHeader
        title="Record Race Results"
        subtitle={raceDetails?.race_name || 'Enter race times'}
        actions={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/competition/${competitionId}/race/${raceId}/results/import`)}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Import CSV
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
              <p className="text-lg font-bold">{currentRunCompetitors.length}</p>
            </div>
            <Clock className="w-8 h-8 text-success/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Run Status</p>
              {currentRun?.is_complete ? (
                <Badge variant="success">Complete</Badge>
              ) : (
                <Badge variant="warning">In Progress</Badge>
              )}
            </div>
          </div>
        </Card>
      </div>

      {saveStatus && (
        <div className={`mb-4 p-3 rounded-md flex items-center gap-2 ${
          saveStatus.type === 'error' ? 'bg-danger/10 border border-danger/20 text-danger' :
          'bg-success/10 border border-success/20 text-success'
        }`}>
          {saveStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{saveStatus.message}</span>
        </div>
      )}

      <Card>
        <CardContent noPadding>
          {raceRuns.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start border-b">
                {raceRuns.map(run => (
                  <TabsTrigger key={run.run_number} value={String(run.run_number)}>
                    Run {run.run_number}
                    {run.is_complete ? (
                      <CheckCircle className="w-4 h-4 ml-2 text-success" />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
              {raceRuns.map(run => (
                <TabsContent
                  key={run.run_number}
                  value={String(run.run_number)}
                  className="mt-0"
                >
                  {/* Course Details Section */}
                  <div className="border-b">
                    <button
                      type="button"
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-50"
                      onClick={() => setShowCourseDetails(prev => ({
                        ...prev,
                        [run.run_number]: !prev[run.run_number]
                      }))}
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-neutral-500" />
                        <span className="font-semibold">Course Details</span>
                        {runDetails[run.run_number]?.courseSetter && (
                          <span className="text-sm text-neutral-500">
                            - {getPersonName(runDetails[run.run_number].courseSetter)}
                          </span>
                        )}
                      </div>
                      {showCourseDetails[run.run_number] ? (
                        <ChevronUp className="w-5 h-5 text-neutral-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-neutral-400" />
                      )}
                    </button>

                    {showCourseDetails[run.run_number] && runDetails[run.run_number] && (
                      <div className="p-4 bg-neutral-50 border-t">
                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              Course Setter
                            </label>
                            <SimpleSelect
                              value={runDetails[run.run_number].courseSetter}
                              onChange={(e) => handleRunDetailChange(run.run_number, 'courseSetter', e.target.value)}
                            >
                              <option value="">Select...</option>
                              {people.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.first_name} {p.last_name}
                                </option>
                              ))}
                            </SimpleSelect>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              Number of Gates
                            </label>
                            <TextField
                              type="number"
                              value={runDetails[run.run_number].numberGates}
                              onChange={(e) => handleRunDetailChange(run.run_number, 'numberGates', e.target.value)}
                              placeholder="e.g., 55"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              Turning Gates
                            </label>
                            <TextField
                              type="number"
                              value={runDetails[run.run_number].turningGates}
                              onChange={(e) => handleRunDetailChange(run.run_number, 'turningGates', e.target.value)}
                              placeholder="e.g., 53"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                              Start Time
                            </label>
                            <TextField
                              value={runDetails[run.run_number].startTime}
                              onChange={(e) => handleRunDetailChange(run.run_number, 'startTime', e.target.value)}
                              placeholder="HH:MM"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-4">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i}>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Forerunner {i}
                              </label>
                              <SimpleSelect
                                value={runDetails[run.run_number][`forerunner${i}`]}
                                onChange={(e) => handleRunDetailChange(run.run_number, `forerunner${i}`, e.target.value)}
                              >
                                <option value="">Select...</option>
                                {people.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.first_name} {p.last_name}
                                  </option>
                                ))}
                              </SimpleSelect>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end">
                          <Button
                            variant="primary"
                            onClick={() => saveRunDetails(run.run_number)}
                            leftIcon={<Save className="w-4 h-4" />}
                          >
                            Save Course Details
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {competitors[run.run_number] ? (
                    <>
                      <DataTable
                        columns={getColumns(run.run_number)}
                        data={competitors[run.run_number]}
                        pageSize={100}
                      />
                      <div className="p-4 border-t flex justify-end">
                        <Button
                          variant="success"
                          onClick={() => markRunComplete(run.run_number)}
                          disabled={run.is_complete}
                          leftIcon={<Save className="w-4 h-4" />}
                        >
                          {run.is_complete ? 'Run Complete' : 'Mark Run Complete'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-neutral-500">
                      Loading competitors...
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="p-8 text-center text-neutral-500">
              No runs found for this race. Please ensure the race has been set up correctly.
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default RecordRaceResultsPageNew;
