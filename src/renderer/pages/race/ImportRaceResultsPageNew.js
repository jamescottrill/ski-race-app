import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import Papa from 'papaparse';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge,
  DataTable,
  Select
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function ImportRaceResultsPageNew() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();

  const [raceDetails, setRaceDetails] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [importMode, setImportMode] = useState('single');
  const [selectedRun, setSelectedRun] = useState('1');
  const [columnMapping, setColumnMapping] = useState({
    bib: '',
    time: '',
    time1: '',
    time2: '',
    status: ''
  });
  const [previewData, setPreviewData] = useState([]);
  const [importStatus, setImportStatus] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchRaceDetails();
    fetchCompetitors();
  }, [competitionId, raceId]);

  const fetchRaceDetails = async () => {
    try {
      const query = `
        SELECT race_name, race_type, number_runs
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
      const query = `
        SELECT
          p.id as competitor_id,
          p.first_name,
          p.last_name,
          rc.bib_number
        FROM people p
        INNER JOIN race_competitor rc ON p.id = rc.racer_id
          AND rc.race_id = ? AND rc.competition_id = ?
        ORDER BY rc.bib_number
      `;
      const result = await window.api.select(query, [raceId, competitionId]);
      setCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const processFile = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        setCsvHeaders(results.meta.fields || []);
        autoDetectColumns(results.meta.fields || [], results.data);
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        setImportStatus({ type: 'error', message: 'Failed to parse CSV file' });
      }
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      processFile(file);
    } else {
      setImportStatus({ type: 'error', message: 'Please drop a CSV file' });
    }
  };

  const autoDetectColumns = (headers, data) => {
    const lowerHeaders = headers.map(h => h.toLowerCase());
    const mapping = { bib: '', time: '', time1: '', time2: '', status: '' };

    lowerHeaders.forEach((header, index) => {
      const originalHeader = headers[index];
      if (header.includes('bib') || header.includes('number') || header === 'no' || header === '#') {
        mapping.bib = originalHeader;
      } else if (header.includes('time1') || header.includes('run1') || header.includes('run 1')) {
        mapping.time1 = originalHeader;
      } else if (header.includes('time2') || header.includes('run2') || header.includes('run 2')) {
        mapping.time2 = originalHeader;
      } else if (header.includes('time') && !mapping.time) {
        mapping.time = originalHeader;
      } else if (header.includes('status') || header.includes('dnf') || header.includes('dsq')) {
        mapping.status = originalHeader;
      }
    });

    if (mapping.time1 && mapping.time2) {
      setImportMode('both');
    }

    setColumnMapping(mapping);
  };

  const parseTime = (timeStr) => {
    if (!timeStr || timeStr === '') return null;

    const str = String(timeStr).trim().toUpperCase();

    if (str === 'DNF' || str === 'DSQ' || str === 'DNS' || str === 'NS') {
      return { status: str, time: null };
    }

    const cleaned = str.replace(',', '.');

    if (cleaned.includes(':')) {
      const parts = cleaned.split(':');
      if (parts.length === 2) {
        const minutes = parseFloat(parts[0]) || 0;
        const seconds = parseFloat(parts[1]) || 0;
        return { status: null, time: (minutes * 60 + seconds).toFixed(2) };
      }
    }

    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      return { status: null, time: parsed.toFixed(2) };
    }

    return null;
  };

  const generatePreview = useCallback(() => {
    if (!csvData || !columnMapping.bib) return;

    const bibToCompetitor = {};
    competitors.forEach(c => {
      bibToCompetitor[c.bib_number] = c;
    });

    const preview = csvData.map((row, index) => {
      const bibValue = row[columnMapping.bib];
      const bib = parseInt(bibValue, 10);
      const competitor = bibToCompetitor[bib];

      let time1Data = null;
      let time2Data = null;

      if (importMode === 'single') {
        const timeCol = columnMapping.time || columnMapping.time1;
        if (timeCol && row[timeCol]) {
          const parsed = parseTime(row[timeCol]);
          if (selectedRun === '1') {
            time1Data = parsed;
          } else {
            time2Data = parsed;
          }
        }
      } else {
        if (columnMapping.time1 && row[columnMapping.time1]) {
          time1Data = parseTime(row[columnMapping.time1]);
        }
        if (columnMapping.time2 && row[columnMapping.time2]) {
          time2Data = parseTime(row[columnMapping.time2]);
        }
      }

      let statusOverride = null;
      if (columnMapping.status && row[columnMapping.status]) {
        const statusVal = String(row[columnMapping.status]).toUpperCase().trim();
        if (['DNF', 'DSQ', 'DNS', 'NS'].includes(statusVal)) {
          statusOverride = statusVal;
        }
      }

      return {
        rowIndex: index,
        bib,
        competitor,
        matched: !!competitor,
        competitorName: competitor ? `${competitor.last_name}, ${competitor.first_name}` : 'Not found',
        time1: time1Data?.time || null,
        time2: time2Data?.time || null,
        status1: statusOverride || time1Data?.status || null,
        status2: statusOverride || time2Data?.status || null,
        rawData: row
      };
    });

    setPreviewData(preview);
  }, [csvData, columnMapping, importMode, selectedRun, competitors]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const ensureRaceRunExists = async (runNumber) => {
    const checkRunQuery = `
      SELECT COUNT(*) as count
      FROM race_run
      WHERE competition_id = ? AND race_id = ? AND run_number = ?
    `;
    const runExists = await window.api.select(checkRunQuery, [competitionId, raceId, runNumber]);

    if (runExists[0].count === 0) {
      const runId = `${raceId}-run-${runNumber}`;
      const insertRunQuery = `
        INSERT INTO race_run (competition_id, race_id, run_id, run_number, is_complete)
        VALUES (?, ?, ?, ?, 0)
      `;
      await window.api.insert(insertRunQuery, [competitionId, raceId, runId, runNumber]);
    }
  };

  const importRunResult = async (racerId, runNumber, time, status) => {
    await ensureRaceRunExists(runNumber);

    const checkQuery = `
      SELECT COUNT(*) as count
      FROM race_results
      WHERE competition_id = ? AND race_id = ? AND run_number = ? AND racer_id = ?
    `;
    const exists = await window.api.select(checkQuery, [competitionId, raceId, runNumber, racerId]);

    const isDnf = status === 'DNF' ? 1 : 0;
    const isDsq = status === 'DSQ' ? 1 : 0;
    const isDns = status === 'DNS' ? 1 : 0;
    const isNs = status === 'NS' ? 1 : 0;

    if (exists[0].count > 0) {
      const updateQuery = `
        UPDATE race_results
        SET race_time = ?, is_dnf = ?, is_dsq = ?, is_dns = ?, is_ns = ?
        WHERE competition_id = ? AND race_id = ? AND run_number = ? AND racer_id = ?
      `;
      await window.api.insert(updateQuery, [
        time, isDnf, isDsq, isDns, isNs,
        competitionId, raceId, runNumber, racerId
      ]);
    } else {
      const insertQuery = `
        INSERT INTO race_results (
          competition_id, race_id, run_number, racer_id,
          race_time, is_dnf, is_dsq, is_dns, is_ns
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await window.api.insert(insertQuery, [
        competitionId, raceId, runNumber, racerId,
        time, isDnf, isDsq, isDns, isNs
      ]);
    }
  };

  const handleImport = async () => {
    if (!previewData.length) return;

    setImportStatus({ type: 'importing', message: 'Importing results...' });

    let successCount = 0;
    let errorCount = 0;

    for (const row of previewData) {
      if (!row.matched) {
        errorCount++;
        continue;
      }

      try {
        const racerId = row.competitor.competitor_id;

        if (importMode === 'single') {
          const runNumber = parseInt(selectedRun, 10);
          const time = runNumber === 1 ? row.time1 : row.time2;
          const status = runNumber === 1 ? row.status1 : row.status2;

          if (time !== null || status !== null) {
            await importRunResult(racerId, runNumber, time, status);
          }
        } else {
          if (row.time1 !== null || row.status1 !== null) {
            await importRunResult(racerId, 1, row.time1, row.status1);
          }
          if (row.time2 !== null || row.status2 !== null) {
            await importRunResult(racerId, 2, row.time2, row.status2);
          }
        }
        successCount++;
      } catch (error) {
        console.error('Failed to import row:', error);
        errorCount++;
      }
    }

    setImportStatus({
      type: 'complete',
      message: `Import complete: ${successCount} successful, ${errorCount} failed`
    });
  };

  const previewColumns = [
    {
      header: 'Bib',
      accessorKey: 'bib',
      cell: ({ row }) => (
        <span className="font-mono font-bold">{row.original.bib}</span>
      )
    },
    {
      header: 'Competitor',
      accessorKey: 'competitorName',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.matched ? (
            <CheckCircle className="w-4 h-4 text-success" />
          ) : (
            <AlertCircle className="w-4 h-4 text-danger" />
          )}
          <span className={row.original.matched ? '' : 'text-danger'}>
            {row.original.competitorName}
          </span>
        </div>
      )
    },
    {
      header: 'Run 1',
      accessorKey: 'time1',
      cell: ({ row }) => {
        const { time1, status1 } = row.original;
        if (status1) return <Badge variant="warning">{status1}</Badge>;
        if (time1) return <span className="font-mono">{time1}</span>;
        return <span className="text-neutral-400">-</span>;
      }
    },
    {
      header: 'Run 2',
      accessorKey: 'time2',
      cell: ({ row }) => {
        const { time2, status2 } = row.original;
        if (status2) return <Badge variant="warning">{status2}</Badge>;
        if (time2) return <span className="font-mono">{time2}</span>;
        return <span className="text-neutral-400">-</span>;
      }
    }
  ];

  const matchedCount = previewData.filter(r => r.matched).length;
  const unmatchedCount = previewData.filter(r => !r.matched).length;

  return (
    <PageContainer>
      <PageHeader
        title="Import Race Results"
        subtitle={raceDetails ? `${raceDetails.race_name} - ${raceDetails.race_type}` : 'Loading...'}
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
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">Step 1: Upload CSV File</h3>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-neutral-300'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <FileSpreadsheet className="w-12 h-12 text-neutral-400" />
                <div>
                  <p className="font-medium text-neutral-700">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-neutral-500">CSV file with bib numbers and times</p>
                </div>
                <Button variant="outline" as="span">
                  <Upload className="w-4 h-4 mr-2" />
                  Select File
                </Button>
              </label>
            </div>

            {csvData && (
              <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-md flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span>Loaded {csvData.length} rows from CSV</span>
              </div>
            )}
          </CardContent>
        </Card>

        {csvData && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold mb-4">Step 2: Configure Import</h3>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Import Mode
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="importMode"
                        value="single"
                        checked={importMode === 'single'}
                        onChange={(e) => setImportMode(e.target.value)}
                        className="text-primary-600"
                      />
                      <span>Single Run</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="importMode"
                        value="both"
                        checked={importMode === 'both'}
                        onChange={(e) => setImportMode(e.target.value)}
                        className="text-primary-600"
                      />
                      <span>Both Runs</span>
                    </label>
                  </div>
                </div>

                {importMode === 'single' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Which Run?
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="selectedRun"
                          value="1"
                          checked={selectedRun === '1'}
                          onChange={(e) => setSelectedRun(e.target.value)}
                          className="text-primary-600"
                        />
                        <span>Run 1</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="selectedRun"
                          value="2"
                          checked={selectedRun === '2'}
                          onChange={(e) => setSelectedRun(e.target.value)}
                          className="text-primary-600"
                        />
                        <span>Run 2</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Bib Number Column *
                  </label>
                  <select
                    value={columnMapping.bib}
                    onChange={(e) => setColumnMapping(prev => ({ ...prev, bib: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                  >
                    <option value="">Select column...</option>
                    {csvHeaders.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>

                {importMode === 'single' ? (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Time Column *
                    </label>
                    <select
                      value={columnMapping.time || columnMapping.time1}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, time: e.target.value, time1: e.target.value }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                    >
                      <option value="">Select column...</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Run 1 Time Column
                      </label>
                      <select
                        value={columnMapping.time1}
                        onChange={(e) => setColumnMapping(prev => ({ ...prev, time1: e.target.value }))}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                      >
                        <option value="">Select column...</option>
                        {csvHeaders.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Run 2 Time Column
                      </label>
                      <select
                        value={columnMapping.time2}
                        onChange={(e) => setColumnMapping(prev => ({ ...prev, time2: e.target.value }))}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                      >
                        <option value="">Select column...</option>
                        {csvHeaders.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Status Column (optional)
                  </label>
                  <select
                    value={columnMapping.status}
                    onChange={(e) => setColumnMapping(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                  >
                    <option value="">None</option>
                    {csvHeaders.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-md flex items-start gap-2">
                <Info className="w-5 h-5 text-info mt-0.5" />
                <div className="text-sm text-neutral-600">
                  <p className="font-medium">Time Format</p>
                  <p>Accepts: seconds (e.g., 45.23), minutes:seconds (e.g., 1:23.45), or status codes (DNF, DSQ, DNS)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {previewData.length > 0 && (
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Step 3: Preview & Import</h3>
                <div className="flex gap-3">
                  <Badge variant="success">{matchedCount} matched</Badge>
                  {unmatchedCount > 0 && (
                    <Badge variant="danger">{unmatchedCount} not found</Badge>
                  )}
                </div>
              </div>

              <DataTable
                columns={previewColumns}
                data={previewData}
                pageSize={10}
              />

              {importStatus && (
                <div className={`mt-4 p-3 rounded-md flex items-center gap-2 ${
                  importStatus.type === 'error' ? 'bg-danger/10 border border-danger/20 text-danger' :
                  importStatus.type === 'complete' ? 'bg-success/10 border border-success/20 text-success' :
                  'bg-info/10 border border-info/20 text-info'
                }`}>
                  {importStatus.type === 'complete' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : importStatus.type === 'error' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={matchedCount === 0 || importStatus?.type === 'importing'}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Import {matchedCount} Results
                </Button>
                {importStatus?.type === 'complete' && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/competition/${competitionId}/race/${raceId}/results`)}
                  >
                    View Results
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
