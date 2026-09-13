import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Info,
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
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import {
  buildImportRows,
  buildImportOperations,
} from '../../utils/RaceResultsImport';
import {
  handleDatabaseError,
  showSuccess,
  showWarning,
} from '../../utils/ErrorHandler';

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
    status: '',
  });
  const [previewData, setPreviewData] = useState([]);
  const [importStatus, setImportStatus] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
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
      },
    });
  };

  const autoDetectColumns = (headers, data) => {
    const lowerHeaders = headers.map((h) => h.toLowerCase());
    const mapping = { bib: '', time: '', time1: '', time2: '', status: '' };

    lowerHeaders.forEach((header, index) => {
      const originalHeader = headers[index];
      if (
        header.includes('bib') ||
        header.includes('number') ||
        header === 'no' ||
        header === '#'
      ) {
        mapping.bib = originalHeader;
      } else if (
        header.includes('time1') ||
        header.includes('run1') ||
        header.includes('run 1')
      ) {
        mapping.time1 = originalHeader;
      } else if (
        header.includes('time2') ||
        header.includes('run2') ||
        header.includes('run 2')
      ) {
        mapping.time2 = originalHeader;
      } else if (header.includes('time') && !mapping.time) {
        mapping.time = originalHeader;
      } else if (
        header.includes('status') ||
        header.includes('dnf') ||
        header.includes('dsq')
      ) {
        mapping.status = originalHeader;
      }
    });

    if (mapping.time1 && mapping.time2) {
      setImportMode('both');
    }

    setColumnMapping(mapping);
  };

  const generatePreview = useCallback(() => {
    if (!csvData || !columnMapping.bib) return;

    setPreviewData(
      buildImportRows({
        csvData,
        columnMapping,
        importMode,
        selectedRun,
        competitors,
      }),
    );
  }, [csvData, columnMapping, importMode, selectedRun, competitors]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const handleImport = async () => {
    const importable = previewData.filter((row) => row.importable);
    if (importable.length === 0) return;

    setImportStatus({ type: 'importing', message: 'Importing results...' });
    const skippedCount = previewData.length - importable.length;

    try {
      // One transaction: either every result lands or none does
      await window.api.transaction(
        buildImportOperations({ competitionId, raceId, rows: importable }),
      );
      const resultCount = importable.reduce(
        (total, row) => total + Object.keys(row.runs).length,
        0,
      );
      const summary = `Imported ${resultCount} result(s) for ${importable.length} competitor(s)`;
      setImportStatus({
        type: 'complete',
        message:
          skippedCount > 0
            ? `${summary}. ${skippedCount} row(s) were skipped, see the problems listed above.`
            : summary,
      });
      showSuccess(summary);
      if (skippedCount > 0) showWarning(`${skippedCount} row(s) skipped`);
    } catch (error) {
      handleDatabaseError('import race results', error);
      setImportStatus({
        type: 'error',
        message: `Import failed and nothing was written: ${error.message}`,
      });
    }
  };

  const renderRun = (run) => {
    if (!run) return <span className="text-neutral-400">-</span>;
    if (run.status) return <Badge variant="warning">{run.status}</Badge>;
    return <span className="font-mono">{run.time.toFixed(2)}</span>;
  };

  const previewColumns = [
    {
      header: 'Bib',
      accessorKey: 'bib',
      cell: ({ row }) => (
        <span className="font-mono font-bold">{row.original.bib}</span>
      ),
    },
    {
      header: 'Competitor',
      accessorKey: 'competitorName',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.competitor ? (
            <CheckCircle className="w-4 h-4 text-success" />
          ) : (
            <AlertCircle className="w-4 h-4 text-danger" />
          )}
          <span className={row.original.competitor ? '' : 'text-danger'}>
            {row.original.competitorName}
          </span>
        </div>
      ),
    },
    {
      header: 'Run 1',
      accessorKey: 'runs.1',
      cell: ({ row }) => renderRun(row.original.runs[1]),
    },
    {
      header: 'Run 2',
      accessorKey: 'runs.2',
      cell: ({ row }) => renderRun(row.original.runs[2]),
    },
    {
      header: 'Problems',
      accessorKey: 'problems',
      cell: ({ row }) =>
        row.original.problems.length > 0 ? (
          <span className="text-danger text-sm">
            {row.original.problems.join('; ')}
          </span>
        ) : (
          <span className="text-neutral-400">-</span>
        ),
    },
  ];

  const importableCount = previewData.filter((r) => r.importable).length;
  const problemRows = previewData.filter((r) => !r.importable);

  return (
    <PageContainer>
      <PageHeader
        title="Import Race Results"
        subtitle={
          raceDetails
            ? `${raceDetails.race_name} - ${raceDetails.race_type}`
            : 'Loading...'
        }
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
            <h3 className="text-lg font-semibold mb-4">
              Step 1: Upload CSV File
            </h3>
            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
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
                  <p className="text-sm text-neutral-500">
                    CSV file with bib numbers and times
                  </p>
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
              <h3 className="text-lg font-semibold mb-4">
                Step 2: Configure Import
              </h3>

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
                    onChange={(e) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        bib: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                  >
                    <option value="">Select column...</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
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
                      onChange={(e) =>
                        setColumnMapping((prev) => ({
                          ...prev,
                          time: e.target.value,
                          time1: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                    >
                      <option value="">Select column...</option>
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
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
                        onChange={(e) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            time1: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                      >
                        <option value="">Select column...</option>
                        {csvHeaders.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Run 2 Time Column
                      </label>
                      <select
                        value={columnMapping.time2}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            time2: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                      >
                        <option value="">Select column...</option>
                        {csvHeaders.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
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
                    onChange={(e) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                  >
                    <option value="">None</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-md flex items-start gap-2">
                <Info className="w-5 h-5 text-info mt-0.5" />
                <div className="text-sm text-neutral-600">
                  <p className="font-medium">Time Format</p>
                  <p>
                    Accepts: seconds (e.g., 45.23), minutes:seconds (e.g.,
                    1:23.45), or status codes (DNF, DSQ, DNS)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {previewData.length > 0 && (
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Step 3: Preview & Import
                </h3>
                <div className="flex gap-3">
                  <Badge variant="success">{importableCount} ready</Badge>
                  {problemRows.length > 0 && (
                    <Badge variant="danger">
                      {problemRows.length} with problems
                    </Badge>
                  )}
                </div>
              </div>

              {problemRows.length > 0 && (
                <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-sm">
                  <p className="font-medium text-danger mb-1">
                    {problemRows.length} row(s) will be skipped:
                  </p>
                  <ul className="list-disc list-inside text-neutral-700 space-y-0.5">
                    {problemRows.slice(0, 20).map((row) => (
                      <li key={row.rowIndex}>
                        Row {row.rowNumber} (bib{' '}
                        {row.bib === '' ? '?' : row.bib}):{' '}
                        {row.problems.join('; ')}
                      </li>
                    ))}
                    {problemRows.length > 20 && (
                      <li>... and {problemRows.length - 20} more</li>
                    )}
                  </ul>
                </div>
              )}

              <DataTable
                columns={previewColumns}
                data={previewData}
                pageSize={10}
              />

              {importStatus && (
                <div
                  className={`mt-4 p-3 rounded-md flex items-center gap-2 ${
                    importStatus.type === 'error'
                      ? 'bg-danger/10 border border-danger/20 text-danger'
                      : importStatus.type === 'complete'
                        ? 'bg-success/10 border border-success/20 text-success'
                        : 'bg-info/10 border border-info/20 text-info'
                  }`}
                >
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
                  disabled={
                    importableCount === 0 || importStatus?.type === 'importing'
                  }
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Import {importableCount} Competitor(s)
                </Button>
                {importStatus?.type === 'complete' && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `/competition/${competitionId}/race/${raceId}/results`,
                      )
                    }
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
